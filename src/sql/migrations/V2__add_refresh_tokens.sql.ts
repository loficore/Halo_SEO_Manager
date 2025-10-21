/**
 * 数据库迁移 V2：添加 refresh_tokens 表
 * 用于存储用户的刷新令牌，支持令牌撤销和过期管理
 */

export const REFRESH_TOKENS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
    revoked_at DATETIME,
    revoked_reason TEXT,
    device_info TEXT, -- JSON 字符串，存储设备信息
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  -- 创建索引以提高查询性能
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_revoked ON refresh_tokens(is_revoked);
`;

// 迁移版本号
export const MIGRATION_VERSION = 'V2__add_refresh_tokens';
