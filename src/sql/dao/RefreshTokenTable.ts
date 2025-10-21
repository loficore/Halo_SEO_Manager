import { Database } from 'sqlite';
import {
  INSERT_REFRESH_TOKEN,
  GET_REFRESH_TOKEN_BY_ID,
  GET_REFRESH_TOKEN_BY_HASH,
  GET_VALID_REFRESH_TOKENS_BY_USER_ID,
  GET_ALL_REFRESH_TOKENS_BY_USER_ID,
  REVOKE_REFRESH_TOKEN,
  REVOKE_REFRESH_TOKEN_BY_HASH,
  REVOKE_ALL_REFRESH_TOKENS_BY_USER_ID,
  REVOKE_ALL_REFRESH_TOKENS_EXCEPT,
  DELETE_EXPIRED_REFRESH_TOKENS,
  DELETE_REVOKED_REFRESH_TOKENS,
  UPDATE_REFRESH_TOKEN_EXPIRY,
  CHECK_REFRESH_TOKEN_VALID,
  COUNT_VALID_REFRESH_TOKENS_BY_USER_ID,
  GET_EXPIRING_REFRESH_TOKENS,
  CLEANUP_INVALID_REFRESH_TOKENS,
} from './refreshTokens.sql';

/**
 * 刷新令牌数据访问对象
 * 负责管理 refresh_tokens 表的 CRUD 操作
 */
export class RefreshTokenTable {
  /**
   * 构造函数
   * @param db SQLite 数据库实例
   */
  constructor(private db: Database) {}

  /**
   * 创建新的刷新令牌
   * @param token 刷新令牌对象
   * @returns Promise<void>
   */
  async createRefreshToken(token: {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    device_info?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<void> {
    await this.db.run(INSERT_REFRESH_TOKEN, {
      id: token.id,
      user_id: token.user_id,
      token_hash: token.token_hash,
      expires_at: token.expires_at.toISOString(),
      device_info: token.device_info || null,
      ip_address: token.ip_address || null,
      user_agent: token.user_agent || null,
    });
  }

  /**
   * 根据 ID 获取刷新令牌
   * @param id 刷新令牌 ID
   * @returns Promise<RefreshToken | null>
   */
  async getRefreshTokenById(id: string): Promise<RefreshToken | null> {
    const result = await this.db.get(GET_REFRESH_TOKEN_BY_ID, { id });
    return result || null;
  }

  /**
   * 根据令牌哈希获取刷新令牌
   * @param tokenHash 令牌哈希值
   * @returns Promise<RefreshToken | null>
   */
  async getRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.db.get(GET_REFRESH_TOKEN_BY_HASH, {
      token_hash: tokenHash,
    });
    return result || null;
  }

  /**
   * 获取用户的所有有效刷新令牌
   * @param userId 用户 ID
   * @returns Promise<RefreshToken[]>
   */
  async getValidRefreshTokensByUserId(userId: string): Promise<RefreshToken[]> {
    return await this.db.all(GET_VALID_REFRESH_TOKENS_BY_USER_ID, {
      user_id: userId,
    });
  }

  /**
   * 获取用户的所有刷新令牌（包括已撤销的）
   * @param userId 用户 ID
   * @returns Promise<RefreshToken[]>
   */
  async getAllRefreshTokensByUserId(userId: string): Promise<RefreshToken[]> {
    return await this.db.all(GET_ALL_REFRESH_TOKENS_BY_USER_ID, {
      user_id: userId,
    });
  }

  /**
   * 撤销指定的刷新令牌
   * @param id 刷新令牌 ID
   * @param reason 撤销原因
   * @returns Promise<void>
   */
  async revokeRefreshToken(
    id: string,
    reason: string = 'User logout',
  ): Promise<void> {
    await this.db.run(REVOKE_REFRESH_TOKEN, {
      id,
      revoked_reason: reason,
    });
  }

  /**
   * 根据令牌哈希撤销刷新令牌
   * @param tokenHash 令牌哈希值
   * @param reason 撤销原因
   * @returns Promise<void>
   */
  async revokeRefreshTokenByHash(
    tokenHash: string,
    reason: string = 'Token revoked',
  ): Promise<void> {
    await this.db.run(REVOKE_REFRESH_TOKEN_BY_HASH, {
      token_hash: tokenHash,
      revoked_reason: reason,
    });
  }

  /**
   * 撤销用户的所有刷新令牌
   * @param userId 用户 ID
   * @param reason 撤销原因
   * @returns Promise<void>
   */
  async revokeAllRefreshTokensByUserId(
    userId: string,
    reason: string = 'Security action',
  ): Promise<void> {
    await this.db.run(REVOKE_ALL_REFRESH_TOKENS_BY_USER_ID, {
      user_id: userId,
      revoked_reason: reason,
    });
  }

  /**
   * 撤销用户除指定令牌外的所有刷新令牌（用于登录时清理旧会话）
   * @param userId 用户 ID
   * @param exceptId 要保留的令牌 ID
   * @param reason 撤销原因
   * @returns Promise<void>
   */
  async revokeAllRefreshTokensExcept(
    userId: string,
    exceptId: string,
    reason: string = 'New login',
  ): Promise<void> {
    await this.db.run(REVOKE_ALL_REFRESH_TOKENS_EXCEPT, {
      user_id: userId,
      except_id: exceptId,
      revoked_reason: reason,
    });
  }

  /**
   * 删除过期的刷新令牌
   * @returns Promise<number> 删除的行数
   */
  async deleteExpiredRefreshTokens(): Promise<number> {
    const result = await this.db.run(DELETE_EXPIRED_REFRESH_TOKENS);
    return result.changes || 0;
  }

  /**
   * 删除已撤销超过 30 天的刷新令牌
   * @returns Promise<number> 删除的行数
   */
  async deleteRevokedRefreshTokens(): Promise<number> {
    const result = await this.db.run(DELETE_REVOKED_REFRESH_TOKENS);
    return result.changes || 0;
  }

  /**
   * 更新刷新令牌的过期时间
   * @param id 刷新令牌 ID
   * @param newExpiryAt 新的过期时间
   * @returns Promise<void>
   */
  async updateRefreshTokenExpiry(id: string, newExpiryAt: Date): Promise<void> {
    await this.db.run(UPDATE_REFRESH_TOKEN_EXPIRY, {
      id,
      expires_at: newExpiryAt.toISOString(),
    });
  }

  /**
   * 检查刷新令牌是否有效
   * @param id 刷新令牌 ID
   * @param tokenHash 令牌哈希值
   * @returns Promise<RefreshToken | null> 如果有效则返回令牌信息，否则返回 null
   */
  async checkRefreshTokenValid(
    id: string,
    tokenHash: string,
  ): Promise<RefreshToken | null> {
    const result = await this.db.get(CHECK_REFRESH_TOKEN_VALID, {
      id,
      token_hash: tokenHash,
    });
    return result || null;
  }

  /**
   * 统计用户的有效刷新令牌数量
   * @param userId 用户 ID
   * @returns Promise<number> 有效令牌数量
   */
  async countValidRefreshTokensByUserId(userId: string): Promise<number> {
    const result = await this.db.get(COUNT_VALID_REFRESH_TOKENS_BY_USER_ID, {
      user_id: userId,
    });
    return result?.count || 0;
  }

  /**
   * 获取即将过期（7天内）的刷新令牌
   * @returns Promise<RefreshToken[]>
   */
  async getExpiringRefreshTokens(): Promise<RefreshToken[]> {
    return await this.db.all(GET_EXPIRING_REFRESH_TOKENS);
  }

  /**
   * 清理无效的刷新令牌（包括过期和已撤销超过30天的）
   * @returns Promise<number> 删除的行数
   */
  async cleanupInvalidRefreshTokens(): Promise<number> {
    const result = await this.db.run(CLEANUP_INVALID_REFRESH_TOKENS);
    return result.changes || 0;
  }
}

/**
 * 刷新令牌数据类型
 */
export interface RefreshToken {
  /** 令牌 ID */
  id: string;
  /** 用户 ID */
  user_id: string;
  /** 令牌哈希值 */
  token_hash: string;
  /** 过期时间 */
  expires_at: string;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
  /** 是否已撤销 */
  is_revoked: boolean;
  /** 撤销时间 */
  revoked_at?: string;
  /** 撤销原因 */
  revoked_reason?: string;
  /** 设备信息（JSON 字符串） */
  device_info?: string;
  /** IP 地址 */
  ip_address?: string;
  /** 用户代理 */
  user_agent?: string;
}
