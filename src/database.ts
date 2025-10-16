/**
 * 数据库管理模块
 * 负责SQLite数据库的初始化和数据操作
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs'; // Import fs module for file system operations
import { log } from './logger';
import {
  CREATE_ARTICLES_TABLE,
  CREATE_ARTICLES_INDEXES,
  CREATE_SEO_RUNS_TABLE,
  CREATE_USERS_TABLE,
  CREATE_API_KEYS_TABLE,
  CREATE_SETTINGS_TABLE,
  CREATE_SCHEDULED_TASKS_TABLE,
  INSERT_OR_REPLACE_ARTICLE,
  GET_ALL_ARTICLES,
  GET_ARTICLE_BY_ID,
  GET_EXISTING_ARTICLE_HASHES,
  DELETE_ARTICLES_BY_IDS,
  GET_ARTICLES_FOR_OPTIMIZATION,
  INSERT_SEO_RUN,
  GET_SEO_RUN_BY_ID,
  GET_SEO_RUNS_BY_USER_ID,
  UPDATE_SEO_RUN_STATUS_AND_REPORT,
  INSERT_USER,
  GET_USER_BY_USERNAME,
  GET_USER_BY_ID,
  UPDATE_USER_MFA_SECRET,
  UPDATE_USER_ROLE,
  GET_ALL_USERS,
  DELETE_USER_BY_ID,
  COUNT_ADMIN_USERS,
  INSERT_API_KEY,
  GET_API_KEYS_BY_USER_ID,
  GET_API_KEY_BY_ID,
  UPDATE_API_KEY,
  DELETE_API_KEY_BY_ID,
  INSERT_OR_REPLACE_SETTING,
  GET_SETTING_BY_KEY,
  GET_ALL_SETTINGS,
  INSERT_SCHEDULED_TASK,
  GET_SCHEDULED_TASK_BY_ID,
  GET_SCHEDULED_TASKS_BY_USER_ID,
  GET_ALL_SCHEDULED_TASKS,
  UPDATE_SCHEDULED_TASK,
  DELETE_SCHEDULED_TASK_BY_ID,
} from './sql/statements'; // Import SQL statements
import * as BetterSqlite3 from 'better-sqlite3'; // Import better-sqlite3 for backup functionality
import { User, UserRole } from './types/user';
import { ApiKeyResponse, CreateApiKeyRequest, UpdateApiKeyRequest, ApiKeyType } from './types/apiKey';
import { SeoRun, SeoOptimizationReport, SeoRunResponse } from './types/optimization';
import { CreateTaskRequest, TaskResponse, UpdateTaskRequest, TaskStatus } from './types/task';
import { SystemSettings, SmtpConfig, LlmConfig, OptimizationParams } from './types/config';

/**
 * @description 数据库管理类。负责SQLite数据库的初始化和数据操作，包括文章、SEO运行记录、用户、API密钥、设置和计划任务的管理。
 * @description English: Database manager class. Responsible for SQLite database initialization and data operations, including managing articles, SEO run records, users, API keys, settings, and scheduled tasks.
 */
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
  * @description 初始化数据库和所有必要的表。
  * @description English: Initialize the database and all necessary tables.
  * @returns {Promise<void>}
  */
 async initDatabase(): Promise<void> {
   try {
     // 中文注释：打开数据库连接
     // English comment: Open database connection
     this.db = await open({
       filename: this.dbPath,
       driver: sqlite3.Database
     });

      await this.db.exec(CREATE_ARTICLES_TABLE);

      await this.db.exec(CREATE_ARTICLES_INDEXES);

      await this.db.exec(CREATE_SEO_RUNS_TABLE);

      await this.db.exec(CREATE_USERS_TABLE);
      await this.db.exec(CREATE_API_KEYS_TABLE);
      await this.db.exec(CREATE_SETTINGS_TABLE);
      await this.db.exec(CREATE_SCHEDULED_TASKS_TABLE);
      
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
  * @description 保存文章数据到数据库。如果文章已存在，则更新。
  * @description English: Save article data to the database. Updates if the article already exists.
  * @param {any} articleData - 要保存的文章数据。
  * @returns {Promise<void>}
  */
 async saveArticle(articleData: any): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     await this.db.run(INSERT_OR_REPLACE_ARTICLE, [
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
  * @description 获取所有文章。
  * @description English: Get all articles.
  * @returns {Promise<any[]>} 所有文章的数据数组。
  */
 async getAllArticles(): Promise<any[]> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     const articles = await this.db.all(GET_ALL_ARTICLES);
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
  * @description 根据文章ID获取文章。
  * @description English: Get article by ID.
  * @param {string} articleId - 文章的唯一ID。
  * @returns {Promise<any>} 文章数据，如果未找到则为undefined。
  */
 async getArticleById(articleId: string): Promise<any> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     const article = await this.db.get(GET_ARTICLE_BY_ID, [articleId]);
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

  /**
   * @description 同步文章数据，根据内容哈希判断是否需要更新，并删除Halo中不存在的文章。
   * @description English: Synchronize article data, update based on content hash, and delete articles no longer present in Halo.
   * @param {any[]} articles - 从Halo CMS获取的最新文章数据数组。
   * @returns {Promise<void>}
   */
  async syncArticles(articles: any[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
  
    log('info', 'Database', 'Starting article synchronization...');
  
    try {
      // 获取数据库中所有文章的 article_id 和 content_hash
      const existingArticles = await this.db.all(GET_EXISTING_ARTICLE_HASHES);
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
        await this.db.run(DELETE_ARTICLES_BY_IDS(placeholders), articlesToDelete);
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
  * @description 获取需要进行SEO优化的文章列表。
  * @description English: Get a list of articles that need SEO optimization.
  * @returns {Promise<any[]>} 需要优化的文章数据数组。
  */
 async getArticlesForOptimization(): Promise<any[]> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     // 中文注释：获取设置值
     // English comment: Get setting values
     const minDaysResult = await this.db.get(GET_SETTING_BY_KEY, ['min_days_since_last_optimization']);
     const forceReoptimizeResult = await this.db.get(GET_SETTING_BY_KEY, ['force_reoptimize']);

     const minDays = minDaysResult ? parseInt(minDaysResult.value) : 7;
     const forceReoptimize = forceReoptimizeResult ? forceReoptimizeResult.value === 'true' : false;

     log('debug', 'Database', `Executing optimization query with forceReoptimize=${forceReoptimize} and minDays=${minDays}.`);
     const articles = await this.db.all(GET_ARTICLES_FOR_OPTIMIZATION, [forceReoptimize.toString(), minDays.toString()]);
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
  * @description 记录SEO运行结果。
  * @description English: Record SEO run result.
  * @param {SeoRun} seoRun - SEO运行记录对象。
  * @returns {Promise<void>}
  */
 async createSeoRun(seoRun: SeoRun): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     await this.db.run(INSERT_SEO_RUN, [
       seoRun.id,
       seoRun.userId,
       seoRun.articleId,
       seoRun.llmModel,
       JSON.stringify(seoRun.optimizationParams),
       seoRun.status,
       seoRun.startTime.toISOString(),
       seoRun.endTime ? seoRun.endTime.toISOString() : null,
       seoRun.report ? JSON.stringify(seoRun.report) : null,
       seoRun.errorMessage,
       seoRun.retryCount,
     ]);
     log('info', 'Database', `SEO run recorded for article ID: ${seoRun.articleId} with status: ${seoRun.status}.`, { seoRunId: seoRun.id, articleId: seoRun.articleId, status: seoRun.status });
   } catch (error: any) {
     log('error', 'Database', `Error recording SEO run for article ID: ${seoRun.articleId}:`, {
       seoRunId: seoRun.id,
       articleId: seoRun.articleId,
       status: seoRun.status,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 根据ID获取SEO运行记录。
  * @description English: Get SEO run record by ID.
  * @param {string} id - SEO运行记录的ID。
  * @returns {Promise<SeoRun | null>} SEO运行记录对象，如果未找到则为null。
  */
 async getSeoRunById(id: string): Promise<SeoRun | null> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const result = await this.db.get(GET_SEO_RUN_BY_ID, [id]);
     if (!result) return null;
     return this.mapSeoRunFromDb(result);
   } catch (error: any) {
     log('error', 'Database', `Error getting SEO run by ID: ${id}:`, {
       id,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 获取指定用户的所有SEO运行记录。
  * @description English: Get all SEO run records for a specific user.
  * @param {string} userId - 用户ID。
  * @returns {Promise<SeoRun[]>} SEO运行记录数组。
  */
 async getSeoRunsByUserId(userId: string): Promise<SeoRun[]> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const results = await this.db.all(GET_SEO_RUNS_BY_USER_ID, [userId]);
     return results.map(this.mapSeoRunFromDb);
   } catch (error: any) {
     log('error', 'Database', `Error getting SEO runs for user ID: ${userId}:`, {
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 更新SEO运行记录的状态和报告。
  * @description English: Update the status and report of an SEO run record.
  * @param {string} id - SEO运行记录的ID。
  * @param {TaskStatus} status - 新的状态。
  * @param {SeoOptimizationReport | null} report - 优化报告。
  * @param {string | null} errorMessage - 错误信息。
  * @returns {Promise<void>}
  */
 async updateSeoRunStatusAndReport(
   id: string,
   status: TaskStatus,
   report: SeoOptimizationReport | null,
   errorMessage: string | null
 ): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     await this.db.run(UPDATE_SEO_RUN_STATUS_AND_REPORT, [
       status,
       new Date().toISOString(),
       report ? JSON.stringify(report) : null,
       errorMessage,
       id,
     ]);
     log('info', 'Database', `SEO run status and report updated for ID: ${id} to status: ${status}.`, { seoRunId: id, status });
   } catch (error: any) {
     log('error', 'Database', `Error updating SEO run status and report for ID: ${id}:`, {
       id,
       status,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 private mapSeoRunFromDb(dbResult: any): SeoRun {
   return {
     id: dbResult.id,
     userId: dbResult.user_id,
     articleId: dbResult.article_id,
     llmModel: dbResult.llm_model,
     optimizationParams: JSON.parse(dbResult.optimization_params),
     status: dbResult.status as TaskStatus,
     startTime: new Date(dbResult.start_time),
     endTime: dbResult.end_time ? new Date(dbResult.end_time) : undefined,
     report: dbResult.report ? JSON.parse(dbResult.report) : undefined,
     errorMessage: dbResult.error_message,
     retryCount: dbResult.retry_count,
     createdAt: new Date(dbResult.created_at),
     updatedAt: new Date(dbResult.updated_at),
   };
 }

 /**
  * @description 获取设置值。
  * @description English: Get a setting value.
  * @param {string} key - 设置键。
  * @returns {Promise<string | null>} 设置值，如果不存在则为null。
  */
 async getSetting(key: string): Promise<string | null> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     const result = await this.db.get(GET_SETTING_BY_KEY, [key]);
     log('debug', 'Database', `Retrieved setting '${key}': ${result ? result.value : 'null'}`, { key, value: result ? result.value : null });
     return result ? result.value : null;
   } catch (error: any) {
     log('error', 'Database', `Error getting setting '${key}':`, {
       key,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 设置指定用户的设置值，如果用户ID为null则设置全局设置。
  * @description English: Set a setting value for a specific user, or global setting if userId is null.
  * @param {string} key - 设置键。
  * @param {string} value - 设置值。
  * @returns {Promise<void>}
  */
 async setSetting(key: string, value: string): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }

   try {
     await this.db.run(INSERT_OR_REPLACE_SETTING, [key, value]);
     log('info', 'Database', `Setting '${key}' updated to '${value}'.`, { key, value });
   } catch (error: any) {
     log('error', 'Database', `Error setting setting '${key}' to '${value}':`, {
       key,
       value,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 获取所有设置。
  * @description English: Get all settings.
  * @returns {Promise<Record<string, string>>} 所有设置的键值对。
  */
   async getAllSettings(): Promise<Record<string, string>> {
     if (!this.db) {
       throw new Error('Database not initialized');
     }
     try {
       const results = await this.db.all(GET_ALL_SETTINGS);
       const settings: Record<string, string> = {};
       for (const row of results) {
         settings[row.key] = row.value;
       }
       log('debug', 'Database', `Retrieved all settings. Count: ${results.length}`);
       return settings;
     } catch (error: any) {
       log('error', 'Database', `Error getting all settings:`, {
         error: error.message,
         stack: error.stack
       });
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
     log('info', 'Database', 'Database connection closed.', { dbPath: this.dbPath });
   }
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
     throw new Error('Native SQLite database object not available for backup.');
   }

   try {
     // 确保备份目录存在
     const backupDir = path.dirname(backupPath);
     if (!fs.existsSync(backupDir)) {
       fs.mkdirSync(backupDir, { recursive: true });
     }

     await new Promise<void>((resolve, reject) => {
       nativeDb.backup(backupPath, {
         progress: (info: { totalPages: number; remainingPages: number }) => {
           const percentage = ((info.totalPages - info.remainingPages) / info.totalPages * 100).toFixed(1);
           log('debug', 'Database', `Backup progress: ${percentage}% (${info.remainingPages} pages remaining).`, {
             backupPath,
             percentage: parseFloat(percentage),
             remainingPages: info.remainingPages,
             totalPages: info.totalPages
           });
           return 0; // 返回0表示不暂停，继续备份
         }
       })
         .then(() => {
           log('info', 'Database', `Database backup successfully created at: ${backupPath}`, { backupPath });
           resolve();
         })
         .catch((err: Error) => {
           log('error', 'Database', `Error during database backup to ${backupPath}:`, {
             backupPath,
             error: err.message,
             stack: err.stack
           });
           reject(err);
         });
     });
   } catch (error: any) {
     log('error', 'Database', `Failed to backup database to ${backupPath}:`, {
       backupPath,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

/**
 * @description 根据用户名获取用户信息。
 * @description English: Get user information by username.
 * @param {string} username - 用户名。
 * @returns {Promise<User | null>} 用户对象，如果未找到则返回null。
 */
async getUserByUsername(username: string): Promise<User | null> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    const user = await this.db.get(GET_USER_BY_USERNAME, [username]);
    log('debug', 'Database', `Retrieved user by username: ${username}`, { username, found: !!user });
    return user ? this.mapUserFromDb(user) : null;
  } catch (error: any) {
    log('error', 'Database', `Error getting user by username: ${username}:`, {
      username,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 根据用户ID获取用户信息。
 * @description English: Get user information by user ID.
 * @param {string} id - 用户ID。
 * @returns {Promise<User | null>} 用户对象，如果未找到则返回null。
 */
async getUserById(id: string): Promise<User | null> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    const user = await this.db.get(GET_USER_BY_ID, [id]);
    log('debug', 'Database', `Retrieved user by ID: ${id}`, { userId: id, found: !!user });
    return user ? this.mapUserFromDb(user) : null;
  } catch (error: any) {
    log('error', 'Database', `Error getting user by ID: ${id}:`, {
      userId: id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 创建新用户。
 * @description English: Create a new user.
 * @param {User} user - 用户数据。
 * @returns {Promise<void>}
 */
async createUser(user: User): Promise<void> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    await this.db.run(INSERT_USER, [
      user.id,
      user.username,
      user.email || null,
      user.passwordHash,
      user.mfaSecret || null,
      user.role,
    ]);
    log('info', 'Database', `User created successfully: ${user.username}`, { userId: user.id });
  } catch (error: any) {
    log('error', 'Database', `Error creating user: ${user.username}:`, {
      username: user.username,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 删除用户。
 * @description English: Delete a user.
 * @param {string} id - 要删除的用户ID。
 * @returns {Promise<void>}
 */
async deleteUser(id: string): Promise<void> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    await this.db.run(DELETE_USER_BY_ID, [id]);
    log('info', 'Database', `User deleted successfully: ${id}`, { userId: id });
  } catch (error: any) {
    log('error', 'Database', `Error deleting user: ${id}:`, {
      userId: id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 更新用户的MFA密钥。
 * @description English: Update user's MFA secret.
 * @param {string} id - 用户ID。
 * @param {string | null} mfaSecret - MFA密钥，如果禁用MFA则为null。
 * @returns {Promise<void>}
 */
async updateUserMfaSecret(id: string, mfaSecret: string | null): Promise<void> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    await this.db.run(UPDATE_USER_MFA_SECRET, [mfaSecret, id]);
    log('info', 'Database', `User MFA secret updated for user: ${id}`, { userId: id, mfaSecret: mfaSecret ? 'set' : 'null' });
  } catch (error: any) {
    log('error', 'Database', `Error updating MFA secret for user: ${id}:`, {
      userId: id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 更新用户角色。
 * @description English: Update user role.
 * @param {string} id - 用户ID。
 * @param {UserRole} role - 新的角色。
 * @returns {Promise<void>}
 */
async updateUserRole(id: string, role: UserRole): Promise<void> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    await this.db.run(UPDATE_USER_ROLE, [role, id]);
    log('info', 'Database', `User role updated for user: ${id} to role: ${role}`, { userId: id, role });
  } catch (error: any) {
    log('error', 'Database', `Error updating role for user: ${id}:`, {
      userId: id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 获取所有用户。
 * @description English: Get all users.
 * @returns {Promise<User[]>} 用户数组。
 */
async getAllUsers(): Promise<User[]> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    const users = await this.db.all(GET_ALL_USERS);
    return users.map(this.mapUserFromDb);
  } catch (error: any) {
    log('error', 'Database', `Error getting all users:`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * @description 计算管理员用户数量。
 * @description English: Count admin users.
 * @returns {Promise<number>} 管理员用户数量。
 */
async countAdminUsers(): Promise<number> {
  if (!this.db) {
    throw new Error('Database not initialized');
  }
  try {
    const result = await this.db.get(COUNT_ADMIN_USERS);
    return result['COUNT(*)'];
  } catch (error: any) {
    log('error', 'Database', `Error counting admin users:`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

 private mapUserFromDb(dbResult: any): User {
   return {
     id: dbResult.id,
     username: dbResult.username,
     email: dbResult.email,
     passwordHash: dbResult.password_hash,
     mfaSecret: dbResult.mfa_secret,
     role: dbResult.role as UserRole,
     createdAt: new Date(dbResult.created_at),
     updatedAt: new Date(dbResult.updated_at),
   };
 }

 /**
  * @description 创建新的API Key。
  * @description English: Create a new API Key.
  * @param {CreateApiKeyRequest} apiKeyData - API Key数据。
  * @returns {Promise<ApiKeyResponse>} 创建的API Key响应对象。
  */
 async createApiKey(apiKeyData: CreateApiKeyRequest): Promise<ApiKeyResponse> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const id = crypto.randomUUID(); // Generate a UUID for the API key
     const keyPrefix = apiKeyData.key.substring(0, 5); // Store first 5 chars as prefix
     // In a real application, hash the key before storing
     const keyHash = apiKeyData.key; // Placeholder: store raw key for now, will hash later

     await this.db.run(INSERT_API_KEY, [
       id,
       apiKeyData.userId,
       apiKeyData.name,
       keyHash,
       keyPrefix,
       apiKeyData.type,
     ]);
     log('info', 'Database', `API Key created successfully: ${apiKeyData.name}`, { userId: apiKeyData.userId, keyName: apiKeyData.name });
     return { id, userId: apiKeyData.userId, name: apiKeyData.name, keyHash, keyPrefix, type: apiKeyData.type, createdAt: new Date(), updatedAt: new Date() };
   } catch (error: any) {
     log('error', 'Database', `Error creating API Key: ${apiKeyData.name}:`, {
       keyName: apiKeyData.name,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 获取指定用户的所有API Keys。
  * @description English: Get all API Keys for a specific user.
  * @param {string} userId - 用户ID。
  * @returns {Promise<ApiKeyResponse[]>} API Key响应对象数组。
  */
 async getApiKeysByUserId(userId: string): Promise<ApiKeyResponse[]> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const results = await this.db.all(GET_API_KEYS_BY_USER_ID, [userId]);
     return results.map(this.mapApiKeyFromDb);
   } catch (error: any) {
     log('error', 'Database', `Error getting API Keys for user ID: ${userId}:`, {
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 根据ID获取API Key。
  * @description English: Get API Key by ID.
  * @param {string} id - API Key的ID。
  * @returns {Promise<ApiKeyResponse | null>} API Key响应对象，如果未找到则为null。
  */
 async getApiKeyById(id: string): Promise<ApiKeyResponse | null> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const result = await this.db.get(GET_API_KEY_BY_ID, [id]);
     if (!result) return null;
     return this.mapApiKeyFromDb(result);
   } catch (error: any) {
     log('error', 'Database', `Error getting API Key by ID: ${id}:`, {
       id,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 更新API Key。
  * @description English: Update API Key.
  * @param {string} id - API Key的ID。
  * @param {string} userId - 用户ID。
  * @param {UpdateApiKeyRequest} updateData - 更新数据。
  * @returns {Promise<void>}
  */
 async updateApiKey(id: string, userId: string, updateData: UpdateApiKeyRequest): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const existingKey = await this.getApiKeyById(id);
     if (!existingKey || existingKey.userId !== userId) {
       throw new Error('API Key not found or unauthorized.');
     }

     const name = updateData.name || existingKey.name;
     const type = updateData.type || existingKey.type;
     let keyHash = existingKey.keyHash;
     let keyPrefix = existingKey.keyPrefix;

     if (updateData.key) {
       keyHash = updateData.key; // Placeholder: store raw key for now, will hash later
       keyPrefix = updateData.key.substring(0, 5);
     }

     await this.db.run(UPDATE_API_KEY, [name, keyHash, keyPrefix, type, id, userId]);
     log('info', 'Database', `API Key updated successfully: ${name}`, { apiKeyId: id, userId });
   } catch (error: any) {
     log('error', 'Database', `Error updating API Key: ${id}:`, {
       apiKeyId: id,
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 删除API Key。
  * @description English: Delete API Key.
  * @param {string} id - API Key的ID。
  * @param {string} userId - 用户ID。
  * @returns {Promise<void>}
  */
 async deleteApiKey(id: string, userId: string): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     await this.db.run(DELETE_API_KEY_BY_ID, [id, userId]);
     log('info', 'Database', `API Key deleted successfully: ${id}`, { apiKeyId: id, userId });
   } catch (error: any) {
     log('error', 'Database', `Error deleting API Key: ${id}:`, {
       apiKeyId: id,
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 private mapApiKeyFromDb(dbResult: any): ApiKeyResponse {
   return {
     id: dbResult.id,
     userId: dbResult.user_id,
     name: dbResult.name,
     keyHash: dbResult.key_hash,
     keyPrefix: dbResult.key_prefix,
     type: dbResult.type as ApiKeyType,
     createdAt: new Date(dbResult.created_at),
     updatedAt: new Date(dbResult.updated_at),
   };
 }

 /**
  * @description 创建新的调度任务。
  * @description English: Create a new scheduled task.
  * @param {CreateTaskRequest} taskData - 任务数据。
  * @returns {Promise<TaskResponse>} 创建的任务响应对象。
  */
 async createScheduledTask(taskData: CreateTaskRequest): Promise<TaskResponse> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const id = crypto.randomUUID();
     await this.db.run(INSERT_SCHEDULED_TASK, [
       id,
       taskData.userId,
       taskData.articleId,
       taskData.scheduleCron,
       taskData.llmModel,
       JSON.stringify(taskData.optimizationParams),
       TaskStatus.PENDING, // Initial status
     ]);
     log('info', 'Database', `Scheduled task created successfully: ${id}`, { userId: taskData.userId, articleId: taskData.articleId });
     return {
       id,
       userId: taskData.userId,
       articleId: taskData.articleId,
       scheduleCron: taskData.scheduleCron,
       llmModel: taskData.llmModel,
       optimizationParams: taskData.optimizationParams,
       status: TaskStatus.PENDING,
       createdAt: new Date(),
       updatedAt: new Date(),
     };
   } catch (error: any) {
     log('error', 'Database', `Error creating scheduled task for article ID: ${taskData.articleId}:`, {
       articleId: taskData.articleId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 根据ID获取调度任务。
  * @description English: Get scheduled task by ID.
  * @param {string} id - 任务ID。
  * @returns {Promise<TaskResponse | null>} 任务响应对象，如果未找到则为null。
  */
 async getScheduledTaskById(id: string): Promise<TaskResponse | null> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const result = await this.db.get(GET_SCHEDULED_TASK_BY_ID, [id]);
     if (!result) return null;
     return this.mapTaskFromDb(result);
   } catch (error: any) {
     log('error', 'Database', `Error getting scheduled task by ID: ${id}:`, {
       id,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 获取指定用户的所有调度任务。
  * @description English: Get all scheduled tasks for a specific user.
  * @param {string} userId - 用户ID。
  * @returns {Promise<TaskResponse[]>} 任务响应对象数组。
  */
 async getScheduledTasksByUserId(userId: string): Promise<TaskResponse[]> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const results = await this.db.all(GET_SCHEDULED_TASKS_BY_USER_ID, [userId]);
     return results.map(this.mapTaskFromDb);
   } catch (error: any) {
     log('error', 'Database', `Error getting scheduled tasks for user ID: ${userId}:`, {
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 获取所有调度任务。
  * @description English: Get all scheduled tasks.
  * @returns {Promise<TaskResponse[]>} 任务响应对象数组。
  */
 async getAllScheduledTasks(): Promise<TaskResponse[]> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const results = await this.db.all(GET_ALL_SCHEDULED_TASKS);
     return results.map(this.mapTaskFromDb);
   } catch (error: any) {
     log('error', 'Database', `Error getting all scheduled tasks:`, {
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 更新调度任务。
  * @description English: Update scheduled task.
  * @param {string} id - 任务ID。
  * @param {string} userId - 用户ID。
  * @param {UpdateTaskRequest} updateData - 更新数据。
  * @returns {Promise<void>}
  */
 async updateScheduledTask(id: string, userId: string, updateData: UpdateTaskRequest): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     const existingTask = await this.getScheduledTaskById(id);
     if (!existingTask || existingTask.userId !== userId) {
       throw new Error('Scheduled task not found or unauthorized.');
     }

     const scheduleCron = updateData.scheduleCron || existingTask.scheduleCron;
     const llmModel = updateData.llmModel || existingTask.llmModel;
     const optimizationParams = updateData.optimizationParams || existingTask.optimizationParams;
     const status = updateData.status || existingTask.status;

     await this.db.run(UPDATE_SCHEDULED_TASK, [
       scheduleCron,
       llmModel,
       JSON.stringify(optimizationParams),
       status,
       id,
       userId,
     ]);
     log('info', 'Database', `Scheduled task updated successfully: ${id}`, { taskId: id, userId });
   } catch (error: any) {
     log('error', 'Database', `Error updating scheduled task: ${id}:`, {
       taskId: id,
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 /**
  * @description 删除调度任务。
  * @description English: Delete scheduled task.
  * @param {string} id - 任务ID。
  * @param {string} userId - 用户ID。
  * @returns {Promise<void>}
  */
 async deleteScheduledTask(id: string, userId: string): Promise<void> {
   if (!this.db) {
     throw new Error('Database not initialized');
   }
   try {
     await this.db.run(DELETE_SCHEDULED_TASK_BY_ID, [id, userId]);
     log('info', 'Database', `Scheduled task deleted successfully: ${id}`, { taskId: id, userId });
   } catch (error: any) {
     log('error', 'Database', `Error deleting scheduled task: ${id}:`, {
       taskId: id,
       userId,
       error: error.message,
       stack: error.stack
     });
     throw error;
   }
 }

 private mapTaskFromDb(dbResult: any): TaskResponse {
   return {
     id: dbResult.id,
     userId: dbResult.user_id,
     articleId: dbResult.article_id,
     scheduleCron: dbResult.schedule_cron,
     llmModel: dbResult.llm_model,
     optimizationParams: JSON.parse(dbResult.optimization_params),
     status: dbResult.status as TaskStatus,
     createdAt: new Date(dbResult.created_at),
     updatedAt: new Date(dbResult.updated_at),
   };
 }
}

// 中文注释：导出默认实例
// English comment: Export default instance
export default new DatabaseManager();