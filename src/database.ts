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

// Import DAO classes
import { ArticleTable } from './sql/dao/ArticleTable';
import { UserTable } from './sql/dao/UserTable';
import { ApiKeyTable } from './sql/dao/ApiKeyTable';
import { SettingsTable } from './sql/dao/SettingsTable';
import { ScheduledTaskTable } from './sql/dao/ScheduledTaskTable';
import { SeoRunTable } from './sql/dao/SeoRunTable';

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

  /**
   * 中文注释：初始化数据库管理器
   * English comment: Initialize database manager
   * @param dbPath 数据库文件路径 / Database file path
   */
  constructor(dbPath: string = 'seo_manager.db') {
    this.dbPath = dbPath;
    // DAO instances will be initialized after the database connection is established
    this.articles = null as any;
    this.users = null as any;
    this.apiKeys = null as any;
    this.settings = null as any;
    this.scheduledTasks = null as any;
    this.seoRuns = null as any;
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

      log('info', 'Database', 'Database initialized successfully.');
    } catch (error: any) {
      log('error', 'Database', 'Error initializing database:', {
        error: error.message,
        stack: error.stack,
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

    // For now, we only have one migration: V1__initial_schema
    // In the future, we can scan the migrations directory and apply them in order.
    const migrationVersion = 'V1__initial_schema';
    const result = await this.db!.get('SELECT version FROM schema_migrations WHERE version = ?', [migrationVersion]);

    if (!result) {
      log('info', 'Database', `Applying migration: ${migrationVersion}`);
      await this.db!.exec(INITIAL_SCHEMA);
      await this.db!.run('INSERT INTO schema_migrations (version) VALUES (?)', [migrationVersion]);
      log('info', 'Database', `Migration ${migrationVersion} applied successfully.`);
    } else {
      log('info', 'Database', `Migration ${migrationVersion} already applied.`);
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
    const nativeDb = (this.db as any)._db as BetterSqlite3.Database;
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
    } catch (error: any) {
      log('error', 'Database', `Failed to backup database to ${backupPath}:`, {
        backupPath,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}

// 中文注释：导出默认实例
// English comment: Export default instance
export default new DatabaseManager();
