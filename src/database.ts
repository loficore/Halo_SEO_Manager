/**
 * 数据库管理模块
 * 负责SQLite数据库的初始化和数据操作
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs'; // Import fs module for file system operations
import { log } from './logger';
import * as BetterSqlite3 from 'better-sqlite3'; // Import better-sqlite3 for backup functionality
import { INITIAL_SCHEMA } from './sql/migrations/V1__initial_schema.sql';
import {
  REFRESH_TOKENS_SCHEMA,
  MIGRATION_VERSION,
} from './sql/migrations/V2__add_refresh_tokens.sql';
import { ArticleData } from './haloClient'; // Import ArticleData type

// Import DAO classes
import { ArticleTable } from './sql/dao/ArticleTable';
import { UserTable } from './sql/dao/UserTable';
import { ApiKeyTable } from './sql/dao/ApiKeyTable';
import { SettingsTable } from './sql/dao/SettingsTable';
import { ScheduledTaskTable } from './sql/dao/ScheduledTaskTable';
import { SeoRunTable } from './sql/dao/SeoRunTable';
import { RefreshTokenTable } from './sql/dao/RefreshTokenTable';

/**
 * @description 数据库管理类。负责SQLite数据库的初始化、迁移、事务编排和跨表逻辑。具体的表操作委托给相应的 DAO 类。
 * @description English: Database manager class. Responsible for SQLite database initialization, migrations, transaction orchestration, and cross-table logic. Specific table operations are delegated to corresponding DAO classes.
 */
export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  // DAO instances
  public articles: ArticleTable;
  public users: UserTable;
  public apiKeys: ApiKeyTable;
  public settings: SettingsTable;
  public scheduledTasks: ScheduledTaskTable;
  public seoRuns: SeoRunTable;
  public refreshTokens: RefreshTokenTable;

  /**
   * 中文注释：初始化数据库管理器
   * English comment: Initialize database manager
   * @param dbPath 数据库文件路径 / Database file path
   */
  constructor(dbPath: string = 'seo_manager.db') {
    this.dbPath = dbPath;
    // DAO instances will be initialized after the database connection is established
    this.articles = null as unknown as ArticleTable;
    this.users = null as unknown as UserTable;
    this.apiKeys = null as unknown as ApiKeyTable;
    this.settings = null as unknown as SettingsTable;
    this.scheduledTasks = null as unknown as ScheduledTaskTable;
    this.seoRuns = null as unknown as SeoRunTable;
    this.refreshTokens = null as unknown as RefreshTokenTable;
  }

  /**
   * @description 初始化数据库连接，运行迁移，并实例化所有 DAO。
   * @description English: Initialize database connection, run migrations, and instantiate all DAOs.
   * @returns {Promise<void>}
   */
  async initDatabase(): Promise<void> {
    try {
      // 中文注释：打开数据库连接
      // English comment: Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database,
      });

      // Run migrations
      await this.runMigrations();

      // Initialize DAOs
      this.articles = new ArticleTable(this.db);
      this.users = new UserTable(this.db);
      this.apiKeys = new ApiKeyTable(this.db);
      this.settings = new SettingsTable(this.db);
      this.scheduledTasks = new ScheduledTaskTable(this.db);
      this.seoRuns = new SeoRunTable(this.db);
      this.refreshTokens = new RefreshTokenTable(this.db);

      log('info', 'Database', 'Database initialized successfully.');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', 'Database', 'Error initializing database:', {
        error: errorMessage,
        stack: errorStack,
      });
      throw error;
    }
  }

  /**
   * @description 运行数据库迁移。
   * @description English: Run database migrations.
   * @returns {Promise<void>}
   */
  private async runMigrations(): Promise<void> {
    // Create schema_migrations table if it doesn't exist
    await this.db!.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Run migrations in order
    const migrations = [
      { version: 'V1__initial_schema', sql: INITIAL_SCHEMA },
      { version: MIGRATION_VERSION, sql: REFRESH_TOKENS_SCHEMA },
    ];

    for (const migration of migrations) {
      const result = await this.db!.get(
        'SELECT version FROM schema_migrations WHERE version = ?',
        [migration.version],
      );

      if (!result) {
        log('info', 'Database', `Applying migration: ${migration.version}`);
        await this.db!.exec(migration.sql);
        await this.db!.run(
          'INSERT INTO schema_migrations (version) VALUES (?)',
          [migration.version],
        );
        log(
          'info',
          'Database',
          `Migration ${migration.version} applied successfully.`,
        );
      } else {
        log(
          'info',
          'Database',
          `Migration ${migration.version} already applied.`,
        );
      }
    }
  }

  /**
   * @description 在事务中执行一个函数。如果函数抛出错误，事务将回滚。
   * @description English: Execute a function within a transaction. If the function throws an error, the transaction will be rolled back.
   * @param fn 要在事务中执行的函数 / The function to execute within the transaction
   * @returns {Promise<T>} 函数的结果 / The result of the function
   */
  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.db.exec('BEGIN;');
    try {
      const result = await fn();
      await this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  /**
   * @description 关闭数据库连接。
   * @description English: Close database connection.
   * @returns {Promise<void>}
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      log('info', 'Database', 'Database connection closed.', {
        dbPath: this.dbPath,
      });
    }
  }

  /**
   * @description 重置数据库，删除数据库文件并重新初始化。仅用于测试环境。
   * @description English: Resets the database, deletes the database file, and re-initializes it. For testing environment only.
   * @returns {Promise<void>}
   */
  async resetDatabase(): Promise<void> {
    log(
      'warn',
      'Database',
      `Resetting database at ${this.dbPath}. This should only be used in test environments.`,
    );
    if (this.db) {
      await this.close();
    }
    if (fs.existsSync(this.dbPath)) {
      fs.unlinkSync(this.dbPath);
      log('info', 'Database', `Deleted database file: ${this.dbPath}`);
    }
    await this.initDatabase();
    log('info', 'Database', 'Database reset and re-initialized successfully.');
  }

  /**
   * @description 执行数据库备份到指定文件。
   * @description English: Perform a database backup to a specified file.
   * @param {string} backupPath - 备份文件的目标路径。
   * @returns {Promise<void>}
   */
  async backupDatabase(backupPath: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    // BetterSqlite3 的 backup 方法需要直接的数据库对象，而不是 sqlite 模块封装的
    const nativeDb = (this.db as unknown as { _db: BetterSqlite3.Database })
      ._db;
    if (!nativeDb) {
      throw new Error(
        'Native SQLite database object not available for backup.',
      );
    }

    try {
      // 确保备份目录存在
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      await new Promise<void>((resolve, reject) => {
        nativeDb
          .backup(backupPath, {
            progress: (info: {
              totalPages: number;
              remainingPages: number;
            }) => {
              const percentage = (
                ((info.totalPages - info.remainingPages) / info.totalPages) *
                100
              ).toFixed(1);
              log(
                'debug',
                'Database',
                `Backup progress: ${percentage}% (${info.remainingPages} pages remaining).`,
                {
                  backupPath,
                  percentage: parseFloat(percentage),
                  remainingPages: info.remainingPages,
                  totalPages: info.totalPages,
                },
              );
              return 0; // 返回0表示不暂停，继续备份
            },
          })
          .then(() => {
            log(
              'info',
              'Database',
              `Database backup successfully created at: ${backupPath}`,
              { backupPath },
            );
            resolve();
          })
          .catch((err: Error) => {
            log(
              'error',
              'Database',
              `Error during database backup to ${backupPath}:`,
              {
                backupPath,
                error: err.message,
                stack: err.stack,
              },
            );
            reject(err);
          });
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', 'Database', `Failed to backup database to ${backupPath}:`, {
        backupPath,
        error: errorMessage,
        stack: errorStack,
      });
      throw error;
    }
  }

  /**
   * @description 同步文章数据到数据库
   * @description English: Sync article data to database
   * @param {ArticleData[]} articles - 文章数据数组 / Array of article data
   * @returns {Promise<void>}
   */
  async syncArticles(articles: ArticleData[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.runInTransaction(async () => {
      for (const article of articles) {
        await this.articles.saveArticle(article);
      }
    });

    log('info', 'Database', `Synced ${articles.length} articles to database.`);
  }

  /**
   * @description 获取需要优化的文章
   * @description English: Get articles that need optimization
   * @param {boolean} forceReoptimize - 是否强制重新优化 / Whether to force re-optimization
   * @param {number} minDays - 最小天数 / Minimum days
   * @returns {Promise<ArticleData[]>}
   */
  async getArticlesForOptimization(
    forceReoptimize = false,
    minDays = 7,
  ): Promise<ArticleData[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return await this.articles.getArticlesForOptimization(
      forceReoptimize,
      minDays,
    );
  }

  /**
   * @description 记录SEO运行结果
   * @description English: Record SEO run result
   * @param {string} articleId - 文章ID / Article ID
   * @param {object} seoData - SEO数据 / SEO data
   * @param {string} status - 状态 / Status
   * @param {string|null} errorMessage - 错误信息 / Error message
   * @param {number} llmCalls - LLM调用次数 / LLM call count
   * @param {number} tokenUsage - Token使用量 / Token usage
   * @param {number} durationMs - 持续时间（毫秒） / Duration in milliseconds
   * @param {number} optimizationAttempts - 优化尝试次数 / Optimization attempt count
   * @param {string|null} modelVersion - 模型版本 / Model version
   * @returns {Promise<void>}
   */
  async recordSeoRun(
    articleId: string,
    seoData: {
      title?: string;
      description?: string;
      keywords?: string;
      slug?: string;
    },
    status: string,
    errorMessage: string | null,
    llmCalls: number,
    tokenUsage: number,
    durationMs: number,
    optimizationAttempts: number,
    modelVersion: string | null,
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const seoRunId = `seo_run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.seoRuns.createSeoRun({
      id: seoRunId,
      user_id: 'system', // 系统生成的任务
      article_id: articleId,
      llm_model: modelVersion || 'unknown',
      optimization_params: JSON.stringify({
        llmCalls,
        tokenUsage,
        durationMs,
        optimizationAttempts,
        seoData,
      }),
      status,
      start_time: new Date(Date.now() - durationMs),
      end_time: new Date(),
      report: status === 'success' ? JSON.stringify(seoData) : undefined,
      error_message: errorMessage || undefined,
      retry_count: optimizationAttempts - 1,
    });

    log(
      'info',
      'Database',
      `Recorded SEO run for article ${articleId} with status: ${status}`,
    );
  }
}

// 中文注释：导出默认实例
// English comment: Export default instance
export default new DatabaseManager();
