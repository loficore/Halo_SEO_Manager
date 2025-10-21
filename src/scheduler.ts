/**
 * 任务调度器模块
 * 负责定时扫描需要优化的文章，并将其加入任务队列
 */

import * as cron from 'node-cron';
import { DatabaseManager } from './database';
import { HaloClient, ArticleData } from './haloClient'; // Import HaloClient and ArticleData
import { SeoOptimizer } from './seoOptimizer'; // Import SeoOptimizer
import { SeoMeta } from './types/seo'; // Import SeoMeta
import { SeoValidator } from './seoValidator';
import { SeoPublisher } from './seoPublisher'; // Import SeoPublisher
import { log } from './logger'; // Import logger
import dotenv from 'dotenv';
dotenv.config();

// Note: ArticleData is imported from haloClient.ts now.

// 中文注释：任务调度器类
// English comment: Task Scheduler Class
export class Scheduler {
  private dbManager: DatabaseManager;
  private haloClient: HaloClient; // Add HaloClient instance
  private seoOptimizer: SeoOptimizer;
  private seoValidator: SeoValidator;
  private seoPublisher: SeoPublisher; // Add SeoPublisher instance
  private taskQueue: ArticleData[] = []; // Corrected type to ArticleData
  private isProcessing = false;
  private cronJob: cron.ScheduledTask | null = null;
  private queueInterval: NodeJS.Timeout | null = null;
  private rawPostCache = new Map<string, Record<string, unknown>>();

  /**
   * 中文注释：初始化调度器
   * English comment: Initialize the scheduler
   * @param dbManager 数据库管理器实例 / Instance of DatabaseManager
   * @param haloClient Halo客户端实例 / Instance of HaloClient
   */
  constructor(
    dbManager: DatabaseManager,
    haloClient: HaloClient,
    seoOptimizer: SeoOptimizer, // Accept SeoOptimizer instance
    seoValidator: SeoValidator, // Accept SeoValidator instance
    seoPublisher: SeoPublisher, // Accept SeoPublisher instance
  ) {
    this.dbManager = dbManager;
    this.haloClient = haloClient;
    this.seoOptimizer = seoOptimizer;
    this.seoValidator = seoValidator;
    this.seoPublisher = seoPublisher;
  }

  /**
   * 中文注释：启动调度器
   * English comment: Start the scheduler
   * @param cronExpression Cron表达式，默认为每小时执行一次 / Cron expression, defaults to once per hour
   */
  async start(cronExpression = '0 * * * *'): Promise<void> {
    log(
      'info',
      'Scheduler',
      `Scheduler starting with cron expression: ${cronExpression}`,
      { cronExpression: cronExpression },
    );

    // Sync articles with Halo at startup
    await this.syncArticlesWithHalo();

    // 中文注释：立即执行一次，以便快速测试
    // English comment: Run once immediately for quick testing
    this.enqueueArticlesForOptimization();

    // 中文注释：设置定时任务
    // English comment: Set up the cron job
    this.cronJob = cron.schedule(cronExpression, () => {
      log(
        'info',
        'Scheduler',
        'Cron job triggered: Checking for articles to optimize...',
      );
      this.enqueueArticlesForOptimization();
    });

    // 中文注释：设置队列处理器
    // English comment: Set up the queue processor
    this.queueInterval = setInterval(() => {
      this.processQueue();
    }, 10000); // 每10秒处理一次 / Process every 10 seconds
  }

  /**
   * 中文注释：停止调度器
   * English comment: Stop the scheduler
   */
  async stop(): Promise<void> {
    log('info', 'Scheduler', 'Attempting to stop scheduler...');
    if (this.cronJob) {
      this.cronJob.stop();
      log('info', 'Scheduler', 'Cron job stopped.');
    }
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null; // Clear the interval reference
      log('info', 'Scheduler', 'Queue processor stopped.');
    }

    // 等待当前正在处理的任务完成
    // Wait for any currently processing task to complete
    while (this.isProcessing) {
      log(
        'debug',
        'Scheduler',
        'Waiting for current queue processing to finish...',
        { isProcessing: this.isProcessing },
      );
      await new Promise((resolve) => setTimeout(resolve, 100)); // 等待100ms
    }
    log('info', 'Scheduler', 'Scheduler stopped gracefully.');
  }

  private async syncArticlesWithHalo(): Promise<void> {
    log('info', 'Scheduler', 'Starting article synchronization with Halo...');
    try {
      const allPosts = await this.haloClient.getAllPosts();
      this.rawPostCache.clear(); // Clear cache before syncing
      const articles: ArticleData[] = [];
      for (const post of allPosts) {
        const articleData = await this.haloClient.extractArticleData(post);
        if (articleData) {
          articles.push(articleData);
          // Cache the raw post object using its ID (metadata.name)
          this.rawPostCache.set(articleData.article_id, post.post);
        }
      }
      await this.dbManager.syncArticles(articles);
      log('info', 'Scheduler', 'Article synchronization with Halo completed.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      log(
        'error',
        'Scheduler',
        'Error during article synchronization with Halo:',
        {
          error: errorMessage,
          stack: errorStack,
        },
      );
    }
  }

  /**
   * 中文注释：查询并入队需要优化的文章
   * English comment: Query and enqueue articles that need optimization
   */
  private async enqueueArticlesForOptimization(): Promise<void> {
    log('info', 'Scheduler', 'Fetching articles for optimization...');
    try {
      const articlesToOptimize =
        await this.dbManager.getArticlesForOptimization();
      log(
        'info',
        'Scheduler',
        `Found ${articlesToOptimize.length} articles to optimize.`,
        { count: articlesToOptimize.length },
      );

      for (const article of articlesToOptimize) {
        // 中文注释：避免重复入队
        // English comment: Avoid duplicate enqueuing
        if (
          !this.taskQueue.some((item) => item.article_id === article.article_id)
        ) {
          this.taskQueue.push(article);
          log(
            'info',
            'Scheduler',
            `Article "${article.title}" enqueued for optimization.`,
            { articleId: article.article_id, title: article.title },
          );
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      log('error', 'Scheduler', 'Error fetching articles for optimization:', {
        error: errorMessage,
        stack: errorStack,
      });
    }
  }

  /**
   * 中文注释：处理任务队列
   * English comment: Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const article = this.taskQueue.shift();

    if (article) {
      log(
        'info',
        'Scheduler',
        `Processing article: "${article.title}" (ID: ${article.article_id})`,
        { articleId: article.article_id, title: article.title },
      );
      let seoMeta: SeoMeta | null = null;
      let status: string = 'failed';
      let errorMessage: string | null = null;
      // LLM metrics, these might be returned by seoOptimizer.optimizeArticle
      const llmCalls: number = 0;
      const tokenUsage: number = 0;
      let durationMs: number = 0;
      let optimizationAttempts: number = 0;
      const modelVersion: string | null = null;

      try {
        const startedAt = Date.now();
        const maxAttempts = 3;
        let previousSeoMeta: SeoMeta | null = null;
        let lastErrors: string[] = [];
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          optimizationAttempts = attempt;
          // Pass articleId and content separately
          const optimizationResult: SeoMeta | null =
            await this.seoOptimizer.optimizeArticle(
              article.article_id,
              article.content,
              { previous: previousSeoMeta, feedback: lastErrors, attempt },
            );
          seoMeta = optimizationResult; // OptimizationResult is SeoMeta

          if (!seoMeta) {
            if (attempt < maxAttempts) {
              log(
                'warn',
                'Scheduler',
                `Optimization returned empty result. Retrying (${attempt}/${maxAttempts})...`,
                { articleId: article.article_id },
              );
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            } else {
              status = 'failed_optimization';
              errorMessage =
                'SEO optimization failed after retries (empty result).';
              break;
            }
          }

          // Validate
          const report = this.seoValidator.validateSeoMetaReport(seoMeta);
          const { valid, errors } = report;
          if (valid) {
            // Publish
            const rawPost = this.rawPostCache.get(article.article_id);
            if (!rawPost) {
              status = 'failed_publish';
              errorMessage = `Could not find raw post data in cache for article ID: ${article.article_id}.`;
              log('error', 'Scheduler', errorMessage, {
                articleId: article.article_id,
              });
              break;
            }
            const publishSuccess = await this.seoPublisher.publishSeoMeta(
              rawPost,
              seoMeta,
            );
            if (publishSuccess) {
              status = 'success';
              log(
                'info',
                'Scheduler',
                `Successfully published SEO meta for article: "${article.title}"`,
                { articleId: article.article_id, attempt },
              );
            } else {
              status = 'failed_publish';
              errorMessage = 'Failed to publish SEO meta to Halo CMS.';
              log(
                'error',
                'Scheduler',
                `Failed to publish SEO meta for article: "${article.title}"`,
                { articleId: article.article_id, attempt, errorMessage },
              );
            }
            break; // either success or publish failed — don't retry further
          } else {
            if (attempt < maxAttempts) {
              previousSeoMeta = seoMeta;
              lastErrors = errors.map((e) => e.message);
              log(
                'warn',
                'Scheduler',
                `SEO meta validation failed. Retrying generation (${attempt}/${maxAttempts})...`,
                { articleId: article.article_id, attempt, errors },
              );
              await new Promise((r) => setTimeout(r, 500 * attempt));
              continue;
            } else {
              status = 'failed_validation';
              errorMessage = `SEO meta validation failed after maximum attempts: ${errors.join('; ')}`;
              break;
            }
          }
        }
        durationMs = Date.now() - startedAt;
        if (status === 'success') {
          log(
            'info',
            'Scheduler',
            `Finished processing article: "${article.title}"`,
            {
              articleId: article.article_id,
              attempts: optimizationAttempts,
              durationMs,
            },
          );
          log('debug', 'Scheduler', 'Generated SEO Meta:', {
            seoMeta: seoMeta,
          });
        }
      } catch (err: unknown) {
        status = 'failed';
        const errorMessageObj =
          err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        errorMessage = errorMessageObj;
        log(
          'error',
          'Scheduler',
          `Error processing article "${article.title}":`,
          {
            articleId: article.article_id,
            error: errorMessageObj,
            stack: errorStack,
          },
        );
      } finally {
        // 记录SEO运行结果
        await this.dbManager.recordSeoRun(
          article.article_id,
          {
            title: seoMeta?.metaTitle,
            description: seoMeta?.metaDescription,
            keywords: seoMeta?.keywords
              ? seoMeta.keywords.join(', ')
              : undefined,
            slug: seoMeta?.slug,
          },
          status,
          errorMessage,
          llmCalls,
          tokenUsage,
          durationMs,
          optimizationAttempts,
          modelVersion,
        );
        log(
          'debug',
          'Scheduler',
          `Recorded SEO run for article: "${article.title}" with status: ${status}`,
          { articleId: article.article_id, status: status },
        );
      }
    }

    this.isProcessing = false;
  }
}
