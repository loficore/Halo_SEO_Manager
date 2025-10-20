export const CREATE_API_KEYS_TABLE = `
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g., 'LLM', 'HALO'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  )
`;

export const INSERT_API_KEY = `
  INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, type)
  VALUES (:id, :user_id, :name, :key_hash, :key_prefix, :type)
`;

export const GET_API_KEYS_BY_USER_ID =
  'SELECT id, user_id, name, key_prefix, type, created_at, updated_at FROM api_keys WHERE user_id = :user_id ORDER BY created_at DESC';

export const GET_API_KEY_BY_ID =
  'SELECT id, user_id, name, key_hash, key_prefix, type, created_at, updated_at FROM api_keys WHERE id = :id';

export const GET_API_KEY_BY_HASH =
  'SELECT id, user_id, name, key_hash, key_prefix, type, created_at, updated_at FROM api_keys WHERE key_hash = :key_hash';

export const UPDATE_API_KEY = `
  UPDATE api_keys
  SET name = :name, key_hash = :key_hash, key_prefix = :key_prefix, type = :type, updated_at = CURRENT_TIMESTAMP
  WHERE id = :id AND user_id = :user_id
`;

export const DELETE_API_KEY_BY_ID =
  'DELETE FROM api_keys WHERE id = :id AND user_id = :user_id';
