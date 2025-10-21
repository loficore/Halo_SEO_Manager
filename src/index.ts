/**
 * @file index.ts
 * @description SEO Manager 主入口文件，负责应用程序的初始化、依赖注入、路由配置和服务器启动。
 * @description English: SEO Manager main entry file, responsible for application initialization, dependency injection, route configuration, and server startup.
 */

import { DatabaseManager } from './database';
import HaloClient from './haloClient';
import { Scheduler } from './scheduler';
import { SeoPublisher } from './seoPublisher';
import { SeoOptimizer } from './seoOptimizer';
import { SeoValidator } from './seoValidator';
import { initLogger, log, Modules } from './logger';
import 'dotenv/config'; // 导入 dotenv 用于加载环境变量

// 引入服务
import { ConfigService } from './services/ConfigService';
import { TaskService } from './services/TaskService';
import { OptimizationService } from './services/OptimizationService';
import { LogService } from './services/LogService';
import { AuthService } from './services/AuthService';
import { ApiKeyService } from './services/ApiKeyService';

// 引入控制器 (Express Router 实例)
import { createTaskController } from './api/taskController';
import { createOptimizationController } from './api/optimizationController';
import { createLogController } from './api/logController';
import authController from './api/authController'; // authController 默认导出 Express Router
import apiKeyController from './api/apiKeyController'; // apiKeyController 默认导出 Express Router
import { createConfigController } from './api/configController'; // 导入 ConfigController
import { authMiddleware } from './middleware/authMiddleware'; // 导入认证中间件
import { errorHandler } from './middleware/errorHandler'; // 导入全局错误处理中间件
import { JwtService } from './services/JwtService'; // 导入 JwtService
import { MfaService } from './services/MfaService'; // 导入 MfaService
import { PasswordService } from './services/PasswordService'; // 导入 PasswordService

import express from 'express'; // 导入 Express 框架

// 全局异常捕获，防止应用程序崩溃
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常 (Uncaught Exception):', err);
  log('fatal', Modules.App, '未捕获的异常 (Uncaught Exception):', {
    error: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (err) => {
  console.error('未处理的 Promise 拒绝 (Unhandled Rejection):', err);
  log('fatal', Modules.App, '未处理的 Promise 拒绝 (Unhandled Rejection):', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  process.exit(1);
});

// 导出 app 实例 (在 setupApp 中初始化)
export let app: express.Application; // 在此处声明 app，使其在 setupApp 外部可见

/**
 * @function setupApp
 * @description 设置并初始化 Express 应用程序、数据库和所有服务。
 *              此函数旨在由主入口文件调用，也可以在测试环境中用于初始化应用程序。
 * @returns {Promise<{ app: express.Application, dbManager: DatabaseManager, configService: ConfigService, authService: AuthService, apiKeyService: ApiKeyService, taskService: TaskService, scheduler: Scheduler }>} 包含初始化后的 app 实例和所有核心服务的对象。
 */
export async function setupApp() {
  // 初始化日志记录器
  initLogger();
  console.log('日志记录器已初始化 - 测试控制台输出');
  console.log('环境变量 (Environment Variables):', {
    HALO_BASE_URL: process.env.HALO_BASE_URL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  });
  log('info', Modules.App, 'SEO Manager 正在启动...');

  app = express(); // 在这里初始化 app
  app.use(express.json()); // 启用 Express 内置的 JSON 请求体解析中间件

  try {
    /**
     * @var {DatabaseManager} dbManager 数据库管理器实例，负责与 SQLite 数据库交互。
     */
    const dbManager = new DatabaseManager();
    await dbManager.initDatabase();
    log('info', Modules.App, '数据库已成功初始化。');

    /**
     * @var {ConfigService} configService 配置服务实例，管理系统配置。
     */
    const configService = new ConfigService(dbManager);
    log('info', Modules.App, 'ConfigService 已初始化。');

    /**
     * @var {HaloClient} haloClient Halo CMS 客户端实例，用于与 Halo 后端 API 交互。
     */
    const haloClient = new HaloClient(
      process.env.HALO_BASE_URL || 'https://your-halo-site.com',
      process.env.HALO_API_TOKEN || null,
    );
    log('info', Modules.App, 'Halo 客户端已初始化。');

    /**
     * @var {SeoPublisher} seoPublisher SEO 发布器实例，负责将优化后的 SEO 元数据发布到目标平台。
     */
    const seoPublisher = new SeoPublisher(haloClient);
    log('info', Modules.App, 'SeoPublisher 已初始化。');

    // 检查 LLM 相关的环境变量
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openaiBaseUrl = process.env.OPENAI_API_BASE_URL; // 注意：这里应为 OPENAI_API_BASE_URL
    const openaiModelName = process.env.OPENAI_MODEL_NAME;

    if (!openaiApiKey || !openaiBaseUrl || !openaiModelName) {
      log(
        'fatal',
        Modules.App,
        '环境变量中缺少 OpenAI API 配置。请检查 OPENAI_API_KEY, OPENAI_API_BASE_URL, OPENAI_MODEL_NAME。',
      );
      if (process.env.NODE_ENV !== 'test') {
        // 在测试环境中不退出进程
        process.exit(1);
      } else {
        throw new Error(
          'Missing OpenAI API configuration in environment variables.',
        );
      }
    }

    /**
     * @var {SeoOptimizer} seoOptimizer SEO 优化器实例，利用 LLM 生成 SEO 元数据。
     */
    const seoOptimizer = new SeoOptimizer({
      apiKey: openaiApiKey,
      baseURL: openaiBaseUrl,
      model: openaiModelName,
    });
    log('info', Modules.App, 'SeoOptimizer 已初始化。');

    /**
     * @var {SeoValidator} seoValidator SEO 验证器实例，用于校验生成或更新的 SEO 元数据。
     */
    const seoValidator = new SeoValidator();
    log('info', Modules.App, 'SeoValidator 已初始化。');

    /**
     * @var {Scheduler} scheduler 调度器实例，负责定时触发文章同步和优化任务。
     */
    const scheduler = new Scheduler(
      dbManager,
      haloClient,
      seoOptimizer,
      seoValidator,
      seoPublisher,
    );
    scheduler.start();
    log('info', Modules.App, '调度器已启动。');

    // 初始化所有核心服务
    /**
     * @var {AuthService} authService 认证服务实例，处理用户认证逻辑。
     */
    const jwtService = new JwtService();
    const mfaService = new MfaService();
    const passwordService = new PasswordService();
    
    const authService = new AuthService(
      dbManager,
      configService,
      jwtService,
      mfaService,
      passwordService
    );
    /**
     * @var {ApiKeyService} apiKeyService API Key 服务实例，管理 API 密钥。
     */
    const apiKeyService = new ApiKeyService(dbManager);
    /**
     * @var {OptimizationService} optimizationService 优化服务实例，处理具体的 SEO 优化执行。
     */
    const optimizationService = new OptimizationService(
      dbManager,
      haloClient,
      seoOptimizer,
      seoValidator,
      seoPublisher,
      configService,
    );
    /**
     * @var {TaskService} taskService 任务服务实例，管理优化任务的生命周期。
     */
    const taskService = new TaskService(
      dbManager,
      optimizationService,
      scheduler,
    );
    /**
     * @var {LogService} logService 日志服务实例，提供日志读取功能。
     */
    const logService = new LogService();

    log('info', Modules.App, '所有服务已初始化。');

    // 创建全局认证中间件实例
    const globalAuthMiddleware = authMiddleware(authService, apiKeyService);

    // 注册 API 路由
    app.use('/api/auth', authController); // 认证路由不应用全局中间件
    const configController = createConfigController(configService, authService); // ConfigController 依赖 ConfigService 和 AuthService
    app.use('/api/config', globalAuthMiddleware, configController); // Config 路由

    // 对其他所有需要认证的 API 路由应用全局认证中间件
    app.use('/api/api-keys', globalAuthMiddleware, apiKeyController);
    app.use(
      '/api/tasks',
      globalAuthMiddleware,
      createTaskController(taskService),
    );
    app.use(
      '/api/optimizations',
      globalAuthMiddleware,
      createOptimizationController(optimizationService),
    );
    app.use('/api/logs', globalAuthMiddleware, createLogController(logService));

    // 注册全局错误处理中间件，它必须在所有路由和其他中间件之后
    app.use(errorHandler);

    return {
      app,
      dbManager,
      configService,
      authService,
      apiKeyService,
      taskService,
      scheduler,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    log('error', Modules.App, 'SEO Manager 发生错误:', {
      error: errorMessage,
      stack: errorStack,
    });
    // 在测试环境中，不退出进程，而是抛出错误，让测试框架捕获
    if (process.env.NODE_ENV === 'test') {
      throw err;
    } else {
      process.exit(1);
    }
  }
}

/**
 * @function main
 * @description 应用程序的主函数，负责初始化所有模块并启动服务器。
 * @description English: The main function of the application, responsible for initializing all modules and starting the server.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  try {
    const { app: initializedApp, dbManager, scheduler } = await setupApp();

    /**
     * @var {string} PORT 服务器监听的端口号。
     */
    const PORT = process.env.PORT || 3000;
    initializedApp.listen(PORT, () => {
      log('info', Modules.App, `服务器正在端口 ${PORT} 运行。`);
    });

    log('info', Modules.App, 'SEO Manager 正在运行。按 Ctrl+C 停止。');

    // 处理程序终止信号，确保应用程序优雅关闭
    process.on('SIGINT', async () => {
      log('info', Modules.App, '收到 SIGINT 信号。正在优雅关闭...');
      await scheduler.stop();
      await dbManager.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      log('info', Modules.App, '收到 SIGTERM 信号。正在优雅关闭...');
      await scheduler.stop();
      await dbManager.close();
      process.exit(0);
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    log('error', Modules.App, 'SEO Manager 发生错误:', {
      error: errorMessage,
      stack: errorStack,
    });
    process.exit(1);
  }
}

// 在主入口处调用 main 函数，这将在非测试环境下启动服务
if (process.env.NODE_ENV !== 'test') {
  main();
}
