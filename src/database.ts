/**
 * 数据库管理模块
 * 负责SQLite数据库的初始化和数据操作
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { log } from './logger'; // Import the unified logger

// 中文注释：数据库管理类
// English comment: Database manager class
export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  /**
   * 中文注释：初始化数据库管理器
   * English comment: Initialize database manager
   * @param dbPath 数据库文件路径 / Database file path
   */
  constructor(dbPath: string = 'seo_manager.db') {
    this.dbPath = dbPath;
  }

  /**
   * 中文注释：初始化数据库和表
   * English comment: Initialize database and tables
   */
  async initDatabase(): Promise<void> {
    try {
      // 中文注释：打开数据库连接
      // English comment: Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // 中文注释：创建articles表
      // English comment: Create articles table
      await this.db.exec(`
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
      `);

      // 中文注释：创建索引以提高查询性能
      // English comment: Create indexes to improve query performance
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_article_id ON articles(article_id);
        CREATE INDEX IF NOT EXISTS idx_content_hash ON articles(content_hash);
        CREATE INDEX IF NOT EXISTS idx_updated_at ON articles(updated_at);
      `);

      // 中文注释：创建seo_runs表
      // English comment: Create seo_runs table
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS seo_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_id TEXT NOT NULL,
          run_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          seo_title TEXT,
          seo_description TEXT,
          seo_keywords TEXT,
          status TEXT,
          error_message TEXT,
          llm_calls INTEGER DEFAULT 0,
          token_usage INTEGER DEFAULT 0,
          duration_ms INTEGER DEFAULT 0,
          optimization_attempts INTEGER DEFAULT 0,
          model_version TEXT,
          FOREIGN KEY (article_id) REFERENCES articles (article_id)
        )
      `);

      // 中文注释：创建settings表
      // English comment: Create settings table
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT,
          description TEXT
        )
      `);

      // 中文注释：初始化默认设置
      // English comment: Initialize default settings
      await this.initializeDefaultSettings();
      
      log('info', 'Database', 'Database initialized successfully.');
    } catch (error: any) {
      log('error', 'Database', 'Error initializing database:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：初始化默认设置
   * English comment: Initialize default settings
   */
  private async initializeDefaultSettings(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const defaultSettings = [
      { key: 'min_content_length', value: '100', description: 'Minimum content length for SEO optimization' },
      { key: 'max_content_length', value: '50000', description: 'Maximum content length for SEO optimization' },
      { key: 'min_days_since_last_optimization', value: '7', description: 'Minimum days since last optimization' },
      { key: 'force_reoptimize', value: 'false', description: 'Force re-optimization of all articles' }
    ];

    for (const setting of defaultSettings) {
      await this.db.run(`
        INSERT OR IGNORE INTO settings (key, value, description)
        VALUES (?, ?, ?)
      `, [setting.key, setting.value, setting.description]);
    }
  }

  /**
   * 中文注释：保存文章数据
   * English comment: Save article data
   * @param articleData 文章数据 / Article data
   */
  async saveArticle(articleData: any): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.run(`
        INSERT OR REPLACE INTO articles (
          article_id, title, content, excerpt, tags, categories, url, slug, content_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        articleData.article_id,
        articleData.title,
        articleData.content,
        articleData.excerpt,
        articleData.tags,
        articleData.categories,
        articleData.url,
        articleData.slug,
        articleData.content_hash
      ]);
      log('info', 'Database', `Article saved/updated successfully: ${articleData.article_id}`, { articleId: articleData.article_id });
    } catch (error: any) {
      log('error', 'Database', `Error saving article: ${articleData.article_id}`, {
        articleId: articleData.article_id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：获取所有文章
   * English comment: Get all articles
   */
  async getAllArticles(): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const articles = await this.db.all('SELECT * FROM articles ORDER BY updated_at DESC');
      log('debug', 'Database', `Retrieved ${articles.length} articles from database.`);
      return articles;
    } catch (error: any) {
      log('error', 'Database', 'Error getting all articles:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：根据文章ID获取文章
   * English comment: Get article by ID
   * @param articleId 文章ID / Article ID
   */
  async getArticleById(articleId: string): Promise<any> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const article = await this.db.get('SELECT * FROM articles WHERE article_id = ?', [articleId]);
      log('debug', 'Database', `Retrieved article by ID: ${articleId}`, { articleId: articleId, found: !!article });
      return article;
    } catch (error: any) {
      log('error', 'Database', `Error getting article by ID: ${articleId}`, {
        articleId: articleId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async syncArticles(articles: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
  
    log('info', 'Database', 'Starting article synchronization...');
  
    try {
      // 获取数据库中所有文章的 article_id 和 content_hash
      const existingArticles = await this.db.all('SELECT article_id, content_hash FROM articles');
      const existingArticleMap = new Map(existingArticles.map(a => [a.article_id, a.content_hash]));
      const incomingArticleIds = new Set(articles.map(a => a.article_id));
  
      let addedCount = 0;
      let updatedCount = 0;
  
      // 插入或更新文章
      for (const article of articles) {
        const existingHash = existingArticleMap.get(article.article_id);
        if (existingHash === undefined) {
          // 新文章，插入
          await this.saveArticle(article);
          addedCount++;
        } else if (existingHash !== article.content_hash) {
          // 文章内容已变更，更新
          await this.saveArticle(article);
          updatedCount++;
        }
      }
  
      // 删除不存在于 Halo 的文章
      const articlesToDelete = existingArticles
        .filter(a => !incomingArticleIds.has(a.article_id))
        .map(a => a.article_id);
  
      if (articlesToDelete.length > 0) {
        const placeholders = articlesToDelete.map(() => '?').join(',');
        await this.db.run(`DELETE FROM articles WHERE article_id IN (${placeholders})`, articlesToDelete);
        log('info', 'Database', `Deleted ${articlesToDelete.length} articles that no longer exist in Halo.`, { deleted_ids: articlesToDelete });
      }
  
      log('info', 'Database', `Article synchronization finished. Added: ${addedCount}, Updated: ${updatedCount}, Deleted: ${articlesToDelete.length}.`);
    } catch (error: any) {
      log('error', 'Database', 'Error during article synchronization:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：获取需要优化的文章
   * English comment: Get articles that need optimization""
   * 
   */
  async getArticlesForOptimization(): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // 中文注释：获取设置值
      // English comment: Get setting values
      const minDaysResult = await this.db.get(
        "SELECT value FROM settings WHERE key = 'min_days_since_last_optimization'"
      );
      const forceReoptimizeResult = await this.db.get(
        "SELECT value FROM settings WHERE key = 'force_reoptimize'"
      );

      const minDays = minDaysResult ? parseInt(minDaysResult.value) : 7;
      const forceReoptimize = forceReoptimizeResult ? forceReoptimizeResult.value === 'true' : false;

      // 中文注释：构建复杂的查询逻辑，判断文章是否需要优化
      // English comment: Build complex query logic to determine if articles need optimization
      const query = `
        SELECT
          a.*
        FROM
          articles AS a
        LEFT JOIN (
          SELECT
            article_id,
            MAX(run_timestamp) AS last_run_timestamp
          FROM
            seo_runs
          WHERE status = 'success' -- 只考虑成功的优化运行
          GROUP BY
            article_id
        ) AS sr ON a.article_id = sr.article_id
        WHERE
          (?) = 'true' -- forceReoptimize
          OR sr.article_id IS NULL -- 从未优化过
          OR a.updated_at > sr.last_run_timestamp -- 内容在上次优化后有变更
          OR sr.last_run_timestamp < datetime('now', '-' || ? || ' days') -- 距上次优化已超过设定天数
        ORDER BY
          a.updated_at ASC;
      `;

      log('debug', 'Database', `Executing optimization query with forceReoptimize=${forceReoptimize} and minDays=${minDays}.`);
      const articles = await this.db.all(query, [forceReoptimize.toString(), minDays.toString()]);
      log('info', 'Database', `Found ${articles.length} articles for optimization.`, { count: articles.length });
      return articles;
    } catch (error: any) {
      log('error', 'Database', 'Error getting articles for optimization:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：记录SEO运行结果
   * English comment: Record SEO run result
   * @param articleId 文章ID / Article ID
   * @param seoData SEO数据 / SEO data
   * @param status 状态 / Status
   * @param errorMessage 错误信息 / Error message
   */
  async recordSeoRun(
    articleId: string,
    seoData: any,
    status: string,
    errorMessage: string | null = null,
    llmCalls: number = 0,
    tokenUsage: number = 0,
    durationMs: number = 0,
    optimizationAttempts: number = 0,
    modelVersion: string | null = null
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.run(`
        INSERT INTO seo_runs (
          article_id, seo_title, seo_description, seo_keywords, status, error_message,
          llm_calls, token_usage, duration_ms, optimization_attempts, model_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        articleId,
        seoData.title || null,
        seoData.description || null,
        seoData.keywords ? JSON.stringify(seoData.keywords) : null,
        status,
        errorMessage,
        llmCalls,
        tokenUsage,
        durationMs,
        optimizationAttempts,
        modelVersion
      ]);
      log('info', 'Database', `SEO run recorded for article ID: ${articleId} with status: ${status}.`, { articleId: articleId, status: status });
    } catch (error: any) {
      log('error', 'Database', `Error recording SEO run for article ID: ${articleId}:`, {
        articleId: articleId,
        status: status,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：获取设置值
   * English comment: Get setting value
   * @param key 设置键 / Setting key
   */
  async getSetting(key: string): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.db.get('SELECT value FROM settings WHERE key = ?', [key]);
      log('debug', 'Database', `Retrieved setting '${key}': ${result ? result.value : 'null'}`, { key: key, value: result ? result.value : null });
      return result ? result.value : null;
    } catch (error: any) {
      log('error', 'Database', `Error getting setting '${key}':`, {
        key: key,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：设置设置值
   * English comment: Set setting value
   * @param key 设置键 / Setting key
   * @param value 设置值 / Setting value
   */
  async setSetting(key: string, value: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      await this.db.run(`
        INSERT OR REPLACE INTO settings (key, value)
        VALUES (?, ?)
      `, [key, value]);
      log('info', 'Database', `Setting '${key}' updated to '${value}'.`, { key: key, value: value });
    } catch (error: any) {
      log('error', 'Database', `Error setting setting '${key}' to '${value}':`, {
        key: key,
        value: value,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 中文注释：关闭数据库连接
   * English comment: Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      log('info', 'Database', 'Database connection closed.', { dbPath: this.dbPath });
    }
  }
}

// 中文注释：导出默认实例
// English comment: Export default instance
export default new DatabaseManager();