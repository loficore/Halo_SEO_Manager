/**
 * @description 集中管理所有SQL语句的模块。
 * @description English: Module for centralizing all SQL statements.
 */

// Articles 表相关的SQL
export const CREATE_ARTICLES_TABLE = `
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    excerpt TEXT,
    tags TEXT,
    categories TEXT,
    url TEXT,
    slug TEXT,
    content_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

export const CREATE_ARTICLES_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_article_id ON articles(article_id);
  CREATE INDEX IF NOT EXISTS idx_content_hash ON articles(content_hash);
  CREATE INDEX IF NOT EXISTS idx_updated_at ON articles(updated_at);
`;

export const INSERT_OR_REPLACE_ARTICLE = `
  INSERT OR REPLACE INTO articles (
    article_id, title, content, excerpt, tags, categories, url, slug, content_hash
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const GET_ALL_ARTICLES = 'SELECT * FROM articles ORDER BY updated_at DESC';

export const GET_ARTICLE_BY_ID = 'SELECT * FROM articles WHERE article_id = ?';

export const GET_EXISTING_ARTICLE_HASHES = 'SELECT article_id, content_hash FROM articles';

export const DELETE_ARTICLES_BY_IDS = (placeholders: string) => `DELETE FROM articles WHERE article_id IN (${placeholders})`;


// Seo Runs 表相关的SQL
export const CREATE_SEO_RUNS_TABLE = `
  CREATE TABLE IF NOT EXISTS seo_runs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    optimization_params TEXT NOT NULL, -- JSON 字符串
    status TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    report TEXT, -- JSON 字符串
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles (article_id) ON DELETE CASCADE
  )
`;

export const INSERT_SEO_RUN = `
  INSERT INTO seo_runs (
    id, user_id, article_id, llm_model, optimization_params, status,
    start_time, end_time, report, error_message, retry_count
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const GET_SEO_RUN_BY_ID = 'SELECT * FROM seo_runs WHERE id = ?';

export const GET_SEO_RUNS_BY_USER_ID = 'SELECT * FROM seo_runs WHERE user_id = ? ORDER BY created_at DESC';

export const UPDATE_SEO_RUN_STATUS_AND_REPORT = `
  UPDATE seo_runs
  SET status = ?, end_time = ?, report = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

// Users 表相关的SQL
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
  VALUES (?, ?, ?, ?, ?, ?)
`;

export const GET_USER_BY_USERNAME = 'SELECT * FROM users WHERE username = ?';

export const GET_USER_BY_ID = 'SELECT * FROM users WHERE id = ?';

export const UPDATE_USER_MFA_SECRET = `
  UPDATE users
  SET mfa_secret = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

export const UPDATE_USER_ROLE = `
  UPDATE users
  SET role = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`;

export const GET_ALL_USERS = 'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC';

export const DELETE_USER_BY_ID = 'DELETE FROM users WHERE id = ?';

export const COUNT_ADMIN_USERS = "SELECT COUNT(*) FROM users WHERE role = 'admin'";

// API Keys 表相关的SQL
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
  VALUES (?, ?, ?, ?, ?, ?)
`;

export const GET_API_KEYS_BY_USER_ID = 'SELECT id, user_id, name, key_prefix, type, created_at, updated_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC';

export const GET_API_KEY_BY_ID = 'SELECT id, user_id, name, key_hash, key_prefix, type, created_at, updated_at FROM api_keys WHERE id = ?';

export const UPDATE_API_KEY = `
  UPDATE api_keys
  SET name = ?, key_hash = ?, key_prefix = ?, type = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND user_id = ?
`;

export const DELETE_API_KEY_BY_ID = 'DELETE FROM api_keys WHERE id = ? AND user_id = ?';

// Settings 表相关的SQL
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
  VALUES (?, ?)
`;

export const GET_SETTING_BY_KEY = 'SELECT value FROM settings WHERE key = ?';

export const GET_ALL_SETTINGS = 'SELECT key, value FROM settings';


// Scheduled Tasks 表相关的SQL
export const CREATE_SCHEDULED_TASKS_TABLE = `
  CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    schedule_cron TEXT NOT NULL,
    llm_model TEXT NOT NULL,
    optimization_params TEXT NOT NULL, -- JSON 字符串
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles (article_id) ON DELETE CASCADE
  )
`;

export const INSERT_SCHEDULED_TASK = `
  INSERT INTO scheduled_tasks (id, user_id, article_id, schedule_cron, llm_model, optimization_params, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export const GET_SCHEDULED_TASK_BY_ID = 'SELECT * FROM scheduled_tasks WHERE id = ?';

export const GET_SCHEDULED_TASKS_BY_USER_ID = 'SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY created_at DESC';

export const GET_ALL_SCHEDULED_TASKS = 'SELECT * FROM scheduled_tasks ORDER BY created_at DESC';

export const UPDATE_SCHEDULED_TASK = `
  UPDATE scheduled_tasks
  SET schedule_cron = ?, llm_model = ?, optimization_params = ?, status = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ? AND user_id = ?
`;

export const DELETE_SCHEDULED_TASK_BY_ID = 'DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?';

// Optimization Query
export const GET_ARTICLES_FOR_OPTIMIZATION = `
  SELECT
    a.*
  FROM
    articles AS a
  LEFT JOIN (
    SELECT
      article_id,
      MAX(start_time) AS last_run_timestamp
    FROM
      seo_runs
    WHERE status = 'COMPLETED'
    GROUP BY
      article_id
  ) AS sr ON a.article_id = sr.article_id
  WHERE
    (?) = 'true' -- force_reoptimize
    OR sr.article_id IS NULL
    OR a.updated_at > sr.last_run_timestamp
    OR sr.last_run_timestamp < datetime('now', '-' || ? || ' days') -- min_days_since_last_optimization
  ORDER BY
    a.updated_at ASC;
`;