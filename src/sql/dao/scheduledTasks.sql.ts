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
  VALUES (:id, :user_id, :article_id, :schedule_cron, :llm_model, :optimization_params, :status)
`;

export const GET_SCHEDULED_TASK_BY_ID =
  'SELECT * FROM scheduled_tasks WHERE id = :id';

export const GET_SCHEDULED_TASKS_BY_USER_ID =
  'SELECT * FROM scheduled_tasks WHERE user_id = :user_id ORDER BY created_at DESC';

export const GET_ALL_SCHEDULED_TASKS =
  'SELECT * FROM scheduled_tasks ORDER BY created_at DESC';

export const UPDATE_SCHEDULED_TASK = `
  UPDATE scheduled_tasks
  SET schedule_cron = :schedule_cron, llm_model = :llm_model, optimization_params = :optimization_params, status = :status, updated_at = CURRENT_TIMESTAMP
  WHERE id = :id AND user_id = :user_id
`;

export const DELETE_SCHEDULED_TASK_BY_ID =
  'DELETE FROM scheduled_tasks WHERE id = :id AND user_id = :user_id';
