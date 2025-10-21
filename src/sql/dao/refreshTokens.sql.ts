/**
 * refresh_tokens 表的 SQL 语句定义
 * 包含所有 CRUD 操作的 SQL 语句
 */

// 创建刷新令牌
export const INSERT_REFRESH_TOKEN = `
  INSERT INTO refresh_tokens (
    id, 
    user_id, 
    token_hash, 
    expires_at, 
    device_info, 
    ip_address, 
    user_agent
  ) VALUES (
    :id, 
    :user_id, 
    :token_hash, 
    :expires_at, 
    :device_info, 
    :ip_address, 
    :user_agent
  )
`;

// 根据 ID 查询刷新令牌
export const GET_REFRESH_TOKEN_BY_ID = `
  SELECT * FROM refresh_tokens 
  WHERE id = :id
`;

// 根据令牌哈希查询刷新令牌
export const GET_REFRESH_TOKEN_BY_HASH = `
  SELECT * FROM refresh_tokens 
  WHERE token_hash = :token_hash
`;

// 根据用户 ID 查询所有有效的刷新令牌
export const GET_VALID_REFRESH_TOKENS_BY_USER_ID = `
  SELECT * FROM refresh_tokens 
  WHERE user_id = :user_id 
    AND is_revoked = FALSE 
    AND expires_at > CURRENT_TIMESTAMP
  ORDER BY created_at DESC
`;

// 根据用户 ID 查询所有刷新令牌（包括已撤销的）
export const GET_ALL_REFRESH_TOKENS_BY_USER_ID = `
  SELECT * FROM refresh_tokens 
  WHERE user_id = :user_id
  ORDER BY created_at DESC
`;

// 撤销刷新令牌
export const REVOKE_REFRESH_TOKEN = `
  UPDATE refresh_tokens 
  SET is_revoked = TRUE, 
      revoked_at = CURRENT_TIMESTAMP, 
      revoked_reason = :revoked_reason,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = :id
`;

// 根据令牌哈希撤销刷新令牌
export const REVOKE_REFRESH_TOKEN_BY_HASH = `
  UPDATE refresh_tokens 
  SET is_revoked = TRUE, 
      revoked_at = CURRENT_TIMESTAMP, 
      revoked_reason = :revoked_reason,
      updated_at = CURRENT_TIMESTAMP
  WHERE token_hash = :token_hash
`;

// 撤销用户的所有刷新令牌
export const REVOKE_ALL_REFRESH_TOKENS_BY_USER_ID = `
  UPDATE refresh_tokens 
  SET is_revoked = TRUE, 
      revoked_at = CURRENT_TIMESTAMP, 
      revoked_reason = :revoked_reason,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = :user_id 
    AND is_revoked = FALSE
`;

// 撤销用户除指定令牌外的所有刷新令牌（用于登录时清理旧会话）
export const REVOKE_ALL_REFRESH_TOKENS_EXCEPT = `
  UPDATE refresh_tokens 
  SET is_revoked = TRUE, 
      revoked_at = CURRENT_TIMESTAMP, 
      revoked_reason = :revoked_reason,
      updated_at = CURRENT_TIMESTAMP
  WHERE user_id = :user_id 
    AND is_revoked = FALSE
    AND id != :except_id
`;

// 删除过期的刷新令牌
export const DELETE_EXPIRED_REFRESH_TOKENS = `
  DELETE FROM refresh_tokens 
  WHERE expires_at < CURRENT_TIMESTAMP
`;

// 删除已撤销的刷新令牌（保留一段时间用于审计）
export const DELETE_REVOKED_REFRESH_TOKENS = `
  DELETE FROM refresh_tokens 
  WHERE is_revoked = TRUE 
    AND revoked_at < datetime('now', '-30 days')
`;

// 更新刷新令牌的过期时间
export const UPDATE_REFRESH_TOKEN_EXPIRY = `
  UPDATE refresh_tokens 
  SET expires_at = :expires_at,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = :id
`;

// 检查刷新令牌是否有效
export const CHECK_REFRESH_TOKEN_VALID = `
  SELECT id, user_id, expires_at, is_revoked 
  FROM refresh_tokens 
  WHERE id = :id 
    AND token_hash = :token_hash
    AND is_revoked = FALSE 
    AND expires_at > CURRENT_TIMESTAMP
`;

// 统计用户的有效刷新令牌数量
export const COUNT_VALID_REFRESH_TOKENS_BY_USER_ID = `
  SELECT COUNT(*) as count 
  FROM refresh_tokens 
  WHERE user_id = :user_id 
    AND is_revoked = FALSE 
    AND expires_at > CURRENT_TIMESTAMP
`;

// 获取即将过期的刷新令牌（用于通知用户）
export const GET_EXPIRING_REFRESH_TOKENS = `
  SELECT * FROM refresh_tokens 
  WHERE is_revoked = FALSE 
    AND expires_at > CURRENT_TIMESTAMP 
    AND expires_at < datetime('now', '+7 days')
  ORDER BY expires_at ASC
`;

// 清理无效的刷新令牌（包括过期和已撤销的）
export const CLEANUP_INVALID_REFRESH_TOKENS = `
  DELETE FROM refresh_tokens 
  WHERE (is_revoked = TRUE AND revoked_at < datetime('now', '-30 days'))
     OR expires_at < CURRENT_TIMESTAMP
`;
