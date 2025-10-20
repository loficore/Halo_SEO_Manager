export const CREATE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT, -- 存储 JSON 字符串
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

export const INSERT_OR_REPLACE_SETTING = `
  INSERT OR REPLACE INTO settings (key, value)
  VALUES (:key, :value)
`;

export const GET_SETTING_BY_KEY = 'SELECT value FROM settings WHERE key = :key';

export const GET_ALL_SETTINGS = 'SELECT key, value FROM settings';
