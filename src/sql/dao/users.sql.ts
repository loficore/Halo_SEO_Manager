export const CREATE_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    mfa_secret TEXT,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin', 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

export const INSERT_USER = `
  INSERT INTO users (id, username, email, password_hash, mfa_secret, role)
  VALUES (:id, :username, :email, :password_hash, :mfa_secret, :role)
`;

export const GET_USER_BY_USERNAME =
  'SELECT * FROM users WHERE username = :username';

export const GET_USER_BY_ID = 'SELECT * FROM users WHERE id = :id';

export const UPDATE_USER_MFA_SECRET = `
  UPDATE users
  SET mfa_secret = :mfa_secret, updated_at = CURRENT_TIMESTAMP
  WHERE id = :id
`;

export const UPDATE_USER_PASSWORD = `
  UPDATE users
  SET password_hash = :password_hash, updated_at = CURRENT_TIMESTAMP
  WHERE id = :id
`;

export const UPDATE_USER_ROLE = `
  UPDATE users
  SET role = :role, updated_at = CURRENT_TIMESTAMP
  WHERE id = :id
`;

export const GET_ALL_USERS =
  'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC';

export const DELETE_USER_BY_ID = 'DELETE FROM users WHERE id = :id';

export const COUNT_ADMIN_USERS =
  "SELECT COUNT(*) FROM users WHERE role = 'admin'";
