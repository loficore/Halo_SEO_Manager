export const INSERT_OR_REPLACE_ARTICLE = `
  INSERT OR REPLACE INTO articles (
    article_id, title, content, excerpt, tags, categories, url, slug, content_hash
  ) VALUES (:article_id, :title, :content, :excerpt, :tags, :categories, :url, :slug, :content_hash)
`;

export const GET_ALL_ARTICLES =
  'SELECT * FROM articles ORDER BY updated_at DESC';

export const GET_ARTICLE_BY_ID =
  'SELECT * FROM articles WHERE article_id = :article_id';

export const GET_EXISTING_ARTICLE_HASHES =
  'SELECT article_id, content_hash FROM articles';

export const DELETE_ARTICLES_BY_IDS = (placeholders: string) =>
  `DELETE FROM articles WHERE article_id IN (${placeholders})`;

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
    :force_reoptimize = 'true'
    OR sr.article_id IS NULL
    OR a.updated_at > sr.last_run_timestamp
    OR sr.last_run_timestamp < datetime('now', '-' || :min_days || ' days')
  ORDER BY
    a.updated_at ASC;
`;
