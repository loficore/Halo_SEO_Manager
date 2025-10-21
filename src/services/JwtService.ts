/**
 * JWT 令牌服务类
 * @fileoverview 提供 JWT 令牌的生成、验证和刷新功能
 * @author SEO Manager Team
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TempTokenPayload,
  TokenPair,
  TokenVerificationResult,
  TokenRefreshResult,
  TokenConfig,
  TokenType,
} from '../types/token';

/**
 * JWT 令牌服务类
 * @class JwtService
 * @description 负责处理 JWT 令牌的生成、验证、刷新和管理
 */
export class JwtService {
  /**
   * JWT 配置选项
   * @private
   * @type {TokenConfig}
   */
  private config: TokenConfig;

  /**
   * 令牌黑名单存储（内存中，生产环境应使用数据库）
   * @private
   * @type {Set<string>}
   */
  private tokenBlacklist: Set<string> = new Set();

  /**
   * 用户令牌版本映射（用于强制令牌失效）
   * @private
   * @type {Map<string, number>}
   */
  private userTokenVersions: Map<string, number> = new Map();

  /**
   * 创建 JwtService 实例
   * @constructor
   * @param {Partial<TokenConfig>} [config] - 可选的配置选项
   */
  constructor(config?: Partial<TokenConfig>) {
    // 默认配置
    this.config = {
      accessTokenExpiry: 15 * 60, // 15分钟
      refreshTokenExpiry: 7 * 24 * 60 * 60, // 7天
      tempTokenExpiry: 5 * 60, // 5分钟
      secret: process.env.JWT_SECRET || 'default-secret-key',
      algorithm: 'HS256',
      issuer: process.env.JWT_ISSUER || 'seo-manager',
      audience: process.env.JWT_AUDIENCE || 'seo-manager-client',
      ...config,
    };
  }

  /**
   * 生成访问令牌
   * @public
   * @param {Object} payload - 令牌载荷数据
   * @param {string} payload.userId - 用户ID
   * @param {string} payload.username - 用户名
   * @param {string} payload.role - 用户角色
   * @returns {string} 访问令牌
   */
  public generateAccessToken(payload: {
    userId: string;
    username: string;
    role: string;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = now + this.config.accessTokenExpiry;

    const tokenPayload: AccessTokenPayload = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      type: TokenType.ACCESS,
      iat: now,
      exp: expiresIn,
      jti: uuidv4(),
    };

    return jwt.sign(tokenPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * 生成刷新令牌
   * @public
   * @param {string} userId - 用户ID
   * @returns {string} 刷新令牌
   */
  public generateRefreshToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = now + this.config.refreshTokenExpiry;

    // 获取或创建用户令牌版本
    const currentVersion = this.userTokenVersions.get(userId) || 0;

    const tokenPayload: RefreshTokenPayload = {
      userId,
      type: TokenType.REFRESH,
      iat: now,
      exp: expiresIn,
      jti: uuidv4(),
      version: currentVersion,
    };

    return jwt.sign(tokenPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * 生成临时令牌（用于多因素认证）
   * @public
   * @param {string} userId - 用户ID
   * @returns {string} 临时令牌
   */
  public generateTempToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = now + this.config.tempTokenExpiry;

    const tokenPayload: TempTokenPayload = {
      userId,
      type: TokenType.TEMP,
      purpose: 'mfa_verification',
      iat: now,
      exp: expiresIn,
      jti: uuidv4(),
    };

    return jwt.sign(tokenPayload, this.config.secret, {
      algorithm: this.config.algorithm,
      issuer: this.config.issuer,
      audience: this.config.audience,
    });
  }

  /**
   * 生成令牌对（访问令牌和刷新令牌）
   * @public
   * @param {Object} payload - 令牌载荷数据
   * @param {string} payload.userId - 用户ID
   * @param {string} payload.username - 用户名
   * @param {string} payload.role - 用户角色
   * @returns {TokenPair} 令牌对
   */
  public generateTokenPair(payload: {
    userId: string;
    username: string;
    role: string;
  }): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload.userId);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: now + this.config.accessTokenExpiry,
      refreshTokenExpiresAt: now + this.config.refreshTokenExpiry,
      tokenType: 'Bearer',
    };
  }

  /**
   * 验证访问令牌
   * @public
   * @param {string} token - 要验证的令牌
   * @returns {TokenVerificationResult} 验证结果
   */
  public verifyAccessToken(token: string): TokenVerificationResult {
    try {
      // 检查令牌是否在黑名单中
      const decoded = jwt.decode(token) as AccessTokenPayload;
      if (decoded && this.tokenBlacklist.has(decoded.jti)) {
        return {
          valid: false,
          error: '令牌已被撤销',
          errorCode: 'TOKEN_REVOKED',
        };
      }

      // 验证令牌
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as AccessTokenPayload;

      // 检查令牌类型
      if (payload.type !== TokenType.ACCESS) {
        return {
          valid: false,
          error: '令牌类型不正确',
          errorCode: 'TOKEN_INVALID',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: '令牌已过期',
          errorCode: 'TOKEN_EXPIRED',
        };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: '令牌无效',
          errorCode: 'TOKEN_INVALID',
        };
      } else {
        return {
          valid: false,
          error: '令牌格式错误',
          errorCode: 'TOKEN_MALFORMED',
        };
      }
    }
  }

  /**
   * 验证刷新令牌
   * @public
   * @param {string} token - 要验证的令牌
   * @returns {TokenVerificationResult} 验证结果
   */
  public verifyRefreshToken(token: string): TokenVerificationResult {
    try {
      // 检查令牌是否在黑名单中
      const decoded = jwt.decode(token) as RefreshTokenPayload;
      if (decoded && this.tokenBlacklist.has(decoded.jti)) {
        return {
          valid: false,
          error: '令牌已被撤销',
          errorCode: 'TOKEN_REVOKED',
        };
      }

      // 验证令牌
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as RefreshTokenPayload;

      // 检查令牌类型
      if (payload.type !== TokenType.REFRESH) {
        return {
          valid: false,
          error: '令牌类型不正确',
          errorCode: 'TOKEN_INVALID',
        };
      }

      // 检查用户令牌版本
      const currentVersion = this.userTokenVersions.get(payload.userId) || 0;
      if (payload.version < currentVersion) {
        return {
          valid: false,
          error: '令牌版本过旧',
          errorCode: 'TOKEN_REVOKED',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: '刷新令牌已过期',
          errorCode: 'TOKEN_EXPIRED',
        };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: '刷新令牌无效',
          errorCode: 'TOKEN_INVALID',
        };
      } else {
        return {
          valid: false,
          error: '刷新令牌格式错误',
          errorCode: 'TOKEN_MALFORMED',
        };
      }
    }
  }

  /**
   * 验证临时令牌
   * @public
   * @param {string} token - 要验证的令牌
   * @returns {TokenVerificationResult} 验证结果
   */
  public verifyTempToken(token: string): TokenVerificationResult {
    try {
      // 检查令牌是否在黑名单中
      const decoded = jwt.decode(token) as TempTokenPayload;
      if (decoded && this.tokenBlacklist.has(decoded.jti)) {
        return {
          valid: false,
          error: '令牌已被撤销',
          errorCode: 'TOKEN_REVOKED',
        };
      }

      // 验证令牌
      const payload = jwt.verify(token, this.config.secret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as TempTokenPayload;

      // 检查令牌类型和用途
      if (
        payload.type !== TokenType.TEMP ||
        payload.purpose !== 'mfa_verification'
      ) {
        return {
          valid: false,
          error: '令牌类型或用途不正确',
          errorCode: 'TOKEN_INVALID',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: '临时令牌已过期',
          errorCode: 'TOKEN_EXPIRED',
        };
      } else if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: '临时令牌无效',
          errorCode: 'TOKEN_INVALID',
        };
      } else {
        return {
          valid: false,
          error: '临时令牌格式错误',
          errorCode: 'TOKEN_MALFORMED',
        };
      }
    }
  }

  /**
   * 刷新令牌对
   * @public
   * @param {string} refreshToken - 刷新令牌
   * @param {Object} userPayload - 用户载荷数据
   * @param {string} userPayload.userId - 用户ID
   * @param {string} userPayload.username - 用户名
   * @param {string} userPayload.role - 用户角色
   * @returns {TokenRefreshResult} 刷新结果
   */
  public refreshTokens(
    refreshToken: string,
    userPayload: {
      userId: string;
      username: string;
      role: string;
    },
  ): TokenRefreshResult {
    // 验证刷新令牌
    const verificationResult = this.verifyRefreshToken(refreshToken);
    if (!verificationResult.valid) {
      return {
        success: false,
        message: verificationResult.error,
        errorCode: verificationResult.errorCode as
          | 'REFRESH_TOKEN_EXPIRED'
          | 'REFRESH_TOKEN_INVALID'
          | 'REFRESH_TOKEN_REVOKED',
      };
    }

    const refreshPayload = verificationResult.payload as RefreshTokenPayload;

    // 确保用户ID匹配
    if (refreshPayload.userId !== userPayload.userId) {
      return {
        success: false,
        message: '用户ID不匹配',
        errorCode: 'REFRESH_TOKEN_INVALID',
      };
    }

    // 将旧的刷新令牌加入黑名单
    this.revokeToken(refreshPayload.jti);

    // 生成新的令牌对
    const newTokenPair = this.generateTokenPair(userPayload);

    return {
      success: true,
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
      tokenPair: newTokenPair,
    };
  }

  /**
   * 撤销令牌（将令牌加入黑名单）
   * @public
   * @param {string} jti - 令牌唯一标识符
   * @returns {void}
   */
  public revokeToken(jti: string): void {
    this.tokenBlacklist.add(jti);
  }

  /**
   * 撤销用户的所有令牌（通过增加令牌版本）
   * @public
   * @param {string} userId - 用户ID
   * @returns {void}
   */
  public revokeAllUserTokens(userId: string): void {
    const currentVersion = this.userTokenVersions.get(userId) || 0;
    this.userTokenVersions.set(userId, currentVersion + 1);
  }

  /**
   * 检查令牌是否被撤销
   * @public
   * @param {string} jti - 令牌唯一标识符
   * @returns {boolean} 令牌是否被撤销
   */
  public isTokenRevoked(jti: string): boolean {
    return this.tokenBlacklist.has(jti);
  }

  /**
   * 清理过期的黑名单令牌
   * @public
   * @returns {number} 清理的令牌数量
   */
  public cleanupExpiredTokens(): number {
    // 注意：在生产环境中，这应该是一个定时任务
    // 这里只是提供了接口，实际实现需要数据库支持
    return 0;
  }

  /**
   * 获取令牌配置
   * @public
   * @returns {TokenConfig} 当前令牌配置
   */
  public getConfig(): TokenConfig {
    return { ...this.config };
  }

  /**
   * 更新令牌配置
   * @public
   * @param {Partial<TokenConfig>} newConfig - 新的配置选项
   * @returns {void}
   */
  public updateConfig(newConfig: Partial<TokenConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
