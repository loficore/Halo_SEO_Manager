import { DatabaseManager } from '../database';
import { HaloClient } from '../haloClient';
import { SeoOptimizer } from '../seoOptimizer';
import { SeoValidator } from '../seoValidator';
import { SeoPublisher } from '../seoPublisher';
import { TaskStatus } from '../types/task';
import {
  SeoRun,
  SeoOptimizationReport,
  SeoRunResponse,
} from '../types/optimization';
import { log, Modules } from '../logger';
import { OptimizationParams } from '../types/config';
import { ConfigService } from './ConfigService';
import { SeoMeta } from '../types/seo';
import crypto from 'crypto';

/**
 * @description 优化服务类，处理优化任务的执行、状态更新和报告存储。
 * @description English: Optimization service class, handles execution, status updates, and report storage for optimization tasks.
 */
export class OptimizationService {
  private dbManager: DatabaseManager;
  private haloClient: HaloClient;
  private seoOptimizer: SeoOptimizer;
  private seoValidator: SeoValidator;
  private seoPublisher: SeoPublisher;
  private configService: ConfigService;

  /**
   * @description 构造函数，注入 DatabaseManager, HaloClient, SeoOptimizer 和 SeoValidator 依赖。
   * @param dbManager 数据库管理器实例
   * @param haloClient Halo客户端实例
   * @param seoOptimizer SEO优化器实例
   * @param seoValidator SEO验证器实例
   * @param seoPublisher SEO发布器实例
   * @param configService 配置服务实例
   */
  constructor(
    dbManager: DatabaseManager,
    haloClient: HaloClient,
    seoOptimizer: SeoOptimizer,
    seoValidator: SeoValidator,
    seoPublisher: SeoPublisher,
    configService: ConfigService,
  ) {
    this.dbManager = dbManager;
    this.haloClient = haloClient;
    this.seoOptimizer = seoOptimizer;
    this.seoValidator = seoValidator;
    this.seoPublisher = seoPublisher;
    this.configService = configService;
    log(
      'info',
      Modules.OptimizationService,
      'OptimizationService initialized.',
    );
  }

  /**
   * @description 执行一个优化任务。
   * @param userId 用户ID
   * @param articleId 文章ID
   * @param llmModel LLM模型名称
   * @param optimizationParams 优化参数
   * @returns Promise<SeoRunResponse> 优化运行的响应对象
   */
  async executeOptimization(
    userId: string,
    articleId: string,
    llmModel: string,
    optimizationParams: OptimizationParams,
  ): Promise<SeoRunResponse> {
    log(
      'info',
      Modules.OptimizationService,
      `Starting optimization for article ID: ${articleId} by user: ${userId}.`,
    );

    const seoRunId = crypto.randomUUID();
    const startTime = new Date();
    let status: TaskStatus = TaskStatus.RUNNING;
    let errorMessage: string | undefined;
    let report: SeoOptimizationReport | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const retryCount = 0;

    // Create initial SEO run record
    const seoRun: SeoRun = {
      id: seoRunId,
      userId,
      articleId,
      llmModel,
      optimizationParams,
      status: TaskStatus.PENDING, // Will be updated to RUNNING shortly
      startTime,
      retryCount: 0,
      createdAt: startTime,
      updatedAt: startTime,
    };

    try {
      // First, fetch the article content from Halo CMS
      const rawPostData = await this.haloClient.getPost(articleId);
      if (!rawPostData) {
        throw new Error(`Article with ID ${articleId} not found in Halo CMS.`);
      }

      const articleData = await this.haloClient.extractArticleData(
        rawPostData as any,
      );
      if (!articleData) {
        throw new Error(
          `Could not extract article data for ID ${articleId}. It might be deleted or unpublished.`,
        );
      }

      // 使用新的 DAO 层初始化数据库中的 SEO 运行记录
      const runningStatus = TaskStatus.RUNNING;
      await this.dbManager.seoRuns.createSeoRun({
        id: seoRun.id,
        user_id: seoRun.userId,
        article_id: seoRun.articleId,
        llm_model: seoRun.llmModel,
        optimization_params: JSON.stringify(seoRun.optimizationParams),
        status: runningStatus,
        start_time: seoRun.startTime,
        retry_count: seoRun.retryCount,
      });

      let seoMeta: SeoMeta | null = null;
      const maxAttempts = 3;
      let previousSeoMeta: SeoMeta | null = null;
      let lastErrors: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const optimizationAttempts = 0;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // 1. Optimize using LLM
        const optimizationResult: SeoMeta | null =
          await this.seoOptimizer.optimizeArticle(
            articleData.article_id,
            articleData.content,
            { previous: previousSeoMeta, feedback: lastErrors, attempt },
          );
        seoMeta = optimizationResult;

        if (!seoMeta) {
          if (attempt < maxAttempts) {
            log(
              'warn',
              Modules.OptimizationService,
              `Optimization returned empty result. Retrying (${attempt}/${maxAttempts})...`,
              { articleId },
            );
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          } else {
            status = TaskStatus.FAILED;
            errorMessage =
              'SEO optimization failed after retries (empty result).';
            break;
          }
        }

        // 2. Validate SEO Meta
        const validationReport =
          this.seoValidator.validateSeoMetaReport(seoMeta);
        const { valid, errors } = validationReport;

        if (valid) {
          // 3. Publish to Halo CMS
          const publishResult = await this.seoPublisher.publishSeoMeta(
            rawPostData,
            seoMeta,
          );
          if (publishResult) {
            status = TaskStatus.COMPLETED;
            report = {
              metaTitle: seoMeta.metaTitle,
              metaDescription: seoMeta.metaDescription,
              keywords: seoMeta.keywords,
              slug: seoMeta.slug,
              originalContentHash: articleData.content_hash,
              optimizedContentHash: crypto
                .createHash('sha256')
                .update(JSON.stringify(seoMeta))
                .digest('hex'), // Hash of the generated SEO meta
              validationFeedback: 'Optimization successful and validated.',
            };
            log(
              'info',
              Modules.OptimizationService,
              `Successfully published SEO meta for article: ${articleId}`,
              { articleId, attempt },
            );
          } else {
            status = TaskStatus.FAILED;
            errorMessage = 'Failed to publish SEO meta to Halo CMS.';
            log('error', Modules.OptimizationService, errorMessage, {
              articleId,
              attempt,
            });
          }
          break; // Either success or publish failed, no need to retry optimization
        } else {
          if (attempt < maxAttempts) {
            previousSeoMeta = seoMeta;
            lastErrors = errors.map((e) => e.message);
            log(
              'warn',
              Modules.OptimizationService,
              `SEO meta validation failed. Retrying generation (${attempt}/${maxAttempts})...`,
              { articleId, attempt, errors },
            );
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          } else {
            status = TaskStatus.FAILED;
            errorMessage = `SEO meta validation failed after maximum attempts: ${errors.map((e) => `${e.field}: ${e.message}`).join('; ')}`;
            log('error', Modules.OptimizationService, errorMessage, {
              articleId,
              attempt,
              errors,
            });
          }
        }
      }

      if (status === TaskStatus.RUNNING) {
        // If it's still running, it means something unexpected happened
        status = TaskStatus.FAILED;
        errorMessage =
          errorMessage || 'Optimization process did not reach a final status.';
      }
    } catch (error: unknown) {
      status = TaskStatus.FAILED;
      const errorMessageObj =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      errorMessage = errorMessageObj;
      log(
        'error',
        Modules.OptimizationService,
        `Error during optimization for article ID ${articleId}:`,
        {
          userId,
          articleId,
          error: errorMessageObj,
          stack: errorStack,
        },
      );
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const endTime = new Date();
      // 使用新的 DAO 层更新 SEO 运行记录的最终状态和报告
      await this.dbManager.seoRuns.updateSeoRunStatusAndReport(
        seoRunId,
        status,
        report ? JSON.stringify(report) : null,
        errorMessage || null,
      );
      log(
        'info',
        Modules.OptimizationService,
        `Optimization for article ID: ${articleId} finished with status: ${status}.`,
      );
    }

    // 使用新的 DAO 层检索更新后的 SeoRun 以返回完整响应
    const updatedSeoRun = await this.dbManager.seoRuns.getSeoRunById(seoRunId);
    if (!updatedSeoRun) {
      throw new Error(
        `Failed to retrieve final SEO run record for ID: ${seoRunId}`,
      );
    }

    return {
      id: updatedSeoRun.id,
      userId: updatedSeoRun.userId,
      articleId: updatedSeoRun.articleId,
      llmModel: updatedSeoRun.llmModel,
      optimizationParams: updatedSeoRun.optimizationParams,
      status: updatedSeoRun.status,
      startTime: updatedSeoRun.startTime,
      endTime: updatedSeoRun.endTime,
      report: updatedSeoRun.report,
      errorMessage: updatedSeoRun.errorMessage,
      retryCount: updatedSeoRun.retryCount,
      createdAt: updatedSeoRun.createdAt,
      updatedAt: updatedSeoRun.updatedAt,
    };
  }

  /**
   * @description 获取指定用户的所有优化运行报告。
   * @param userId 用户ID
   * @returns Promise<SeoRunResponse[]> 优化运行报告数组
   */
  async getOptimizationRunsByUserId(userId: string): Promise<SeoRunResponse[]> {
    log(
      'info',
      Modules.OptimizationService,
      `Fetching optimization runs for user ID: ${userId}.`,
    );
    try {
      // 使用新的 DAO 层获取用户的优化运行记录
      const runs = await this.dbManager.seoRuns.getSeoRunsByUserId(userId);
      log(
        'info',
        Modules.OptimizationService,
        `Retrieved ${runs.length} optimization runs for user ID: ${userId}.`,
        { userId, count: runs.length },
      );
      return runs;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log(
        'error',
        Modules.OptimizationService,
        `Failed to retrieve optimization runs for user ID ${userId}:`,
        {
          userId,
          error: errorMessage,
          stack: errorStack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 获取所有优化运行报告。
   * @returns Promise<SeoRunResponse[]> 优化运行报告数组
   */
  async getAllOptimizationRuns(): Promise<SeoRunResponse[]> {
    log('info', Modules.OptimizationService, 'Fetching all optimization runs.');
    try {
      // 使用新的 DAO 层获取所有优化运行记录
      const allSeoRuns = await this.dbManager.seoRuns.getAllSeoRuns();
      log(
        'info',
        Modules.OptimizationService,
        `Retrieved ${allSeoRuns.length} optimization runs.`,
        { count: allSeoRuns.length },
      );
      return allSeoRuns;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log(
        'error',
        Modules.OptimizationService,
        'Failed to retrieve all optimization runs:',
        {
          error: errorMessage,
          stack: errorStack,
        },
      );
      throw error;
    }
  }

  /**
   * @description 获取指定ID的优化任务详情和报告。
   * @param seoRunId 优化运行ID
   * @returns Promise<SeoRunResponse | null> 优化运行响应对象，如果未找到则为null
   */
  async getOptimizationReport(
    seoRunId: string,
  ): Promise<SeoRunResponse | null> {
    log(
      'info',
      Modules.OptimizationService,
      `Fetching optimization report for SEO run ID: ${seoRunId}.`,
    );
    try {
      // 使用新的 DAO 层根据 ID 获取优化报告
      const run = await this.dbManager.seoRuns.getSeoRunById(seoRunId);
      if (run) {
        log(
          'info',
          Modules.OptimizationService,
          `Optimization report found for ID: ${seoRunId}.`,
          { seoRunId },
        );
      } else {
        log(
          'warn',
          Modules.OptimizationService,
          `Optimization report not found for ID: ${seoRunId}.`,
          { seoRunId },
        );
      }
      return run;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log(
        'error',
        Modules.OptimizationService,
        `Failed to retrieve optimization report for ID ${seoRunId}:`,
        {
          seoRunId,
          error: errorMessage,
          stack: errorStack,
        },
      );
      throw error;
    }
  }
}
