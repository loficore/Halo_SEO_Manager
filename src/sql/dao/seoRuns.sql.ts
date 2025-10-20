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
  ) VALUES (:id, :user_id, :article_id, :llm_model, :optimization_params, :status,
            :start_time, :end_time, :report, :error_message, :retry_count)
`;

export const GET_SEO_RUN_BY_ID = 'SELECT * FROM seo_runs WHERE id = :id';

export const GET_SEO_RUNS_BY_USER_ID =
  'SELECT * FROM seo_runs WHERE user_id = :user_id ORDER BY created_at DESC';

export const UPDATE_SEO_RUN_STATUS_AND_REPORT = `
  UPDATE seo_runs
  SET status = :status, end_time = :end_time, report = :report, error_message = :error_message, updated_at = CURRENT_TIMESTAMP
  WHERE id = :id
`;

export const GET_ALL_SEO_RUNS = 'SELECT * FROM seo_runs';
