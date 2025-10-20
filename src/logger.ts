import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// 提前提升全局 EventEmitter 监听上限，避免在构建 logger 时触发告警
EventEmitter.defaultMaxListeners = 30;

const isTestEnv = process.env.NODE_ENV === 'test';

const LOGS_DIR = path.resolve(__dirname, '../logs');

// 确保日志目录存在
if (!isTestEnv && !fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

// 定义自定义日志级别和颜色
const levels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5, // 新增 trace 级别，用于更详细的调试信息
};

const colors = {
  fatal: 'red',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'cyan',
};

winston.addColors(colors);

// 日志模块名枚举
export const Modules = {
  App: 'App',
  HaloClient: 'HaloClient',
  Database: 'Database',
  Scheduler: 'Scheduler',
  SeoOptimizer: 'SeoOptimizer',
  SeoPublisher: 'SeoPublisher',
  SeoValidator: 'SeoValidator',
  LlmSeoGenerations: 'llmSeoGenerations',
  MelodyAuthClient: 'MelodyAuthClient',
  AuthService: 'AuthService',
  AuthController: 'AuthController',
  ConfigService: 'ConfigService',
  ConfigController: 'ConfigController',
  ApiKeyService: 'ApiKeyService',
  ApiKeyController: 'ApiKeyController',
  TaskService: 'TaskService',
  TaskController: 'TaskController',
  OptimizationService: 'OptimizationService',
  OptimizationController: 'OptimizationController',
  LogService: 'LogService',
  LogController: 'LogController',
  AuthMiddleware: 'AuthMiddleware', // New module for authentication middleware
  ErrorHandler: 'ErrorHandler', // New module for global error handling
} as const;
export type ModuleKey = (typeof Modules)[keyof typeof Modules];

// 定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf((info: any) => {
    // 将 info 强制转换为 any
    // 优先从 info.module 获取，如果不存在则从 info.metadata?.module 获取
    const actualModuleName =
      info.module || info.metadata?.module || Modules.App;
    const { timestamp, level, message, module, ...meta } = info; // 排除 module 出 meta
    const context = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${actualModuleName}] ${message} ${context}`;
  }),
);

// metaFormat：metadata 不吞 module
const metaFormat = winston.format.metadata({
  fillExcept: ['level', 'message', 'timestamp', 'module'],
});

// 定义一个格式化器，将 info.metadata.module 提升到 info.module（如果 module 不存在）
const promoteModuleToInfo = winston.format((info: any) => {
  if (!info.module && info.metadata && info.metadata.module) {
    info.module = info.metadata.module;
  }
  return info;
})();

// 模块过滤器（大小写不敏感 + 兼容 metadata.module）
const createModuleFilter = (moduleName: ModuleKey) =>
  winston.format((info: any) => {
    const actual = String(info.module ?? info.metadata?.module ?? Modules.App);
    return actual.toLowerCase() === moduleName.toLowerCase() ? info : false;
  })();

// 为每个模块创建日志文件传输器
const createDailyRotateFileTransport = (
  moduleName: ModuleKey,
  level: keyof typeof levels = 'debug',
) => {
  const transport = new winston.transports.DailyRotateFile({
    filename: path.join(LOGS_DIR, `${moduleName}.%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: level, // 默认文件日志级别为 debug，记录所有详细信息
  });
  // 确保 metadata 在过滤器之前运行，以便 info.module 可用
  transport.format = winston.format.combine(
    metaFormat, // 保留 module 等字段
    promoteModuleToInfo, // 提升 metadata.module 到 module，如果 module 不存在
    createModuleFilter(moduleName), // 根据 module 过滤
    logFormat, // 最终格式
  );
  return transport;
};

// 为通用应用程序日志创建传输器
const createApplicationTransport = () => {
  const transport = new winston.transports.DailyRotateFile({
    filename: path.join(LOGS_DIR, `application.%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info', // 应用程序日志默认只记录 info 及以上级别
  });
  transport.format = winston.format.combine(
    metaFormat,
    promoteModuleToInfo,
    winston.format((info: any) => {
      const actual = info.module || info.metadata?.module;
      return !actual || actual === Modules.App ? info : false;
    })(),
    logFormat,
  );
  return transport;
};

// 配置 Winston Logger
const baseTransports: winston.transport[] = [
  new winston.transports.Console({
    level: isTestEnv ? 'error' : 'info',
    silent: isTestEnv,
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      metaFormat,
      logFormat,
    ),
  }),
];

if (!isTestEnv) {
  baseTransports.push(
    createApplicationTransport(),
    createDailyRotateFileTransport(Modules.HaloClient, 'debug'),
    createDailyRotateFileTransport(Modules.LlmSeoGenerations, 'info'),
    createDailyRotateFileTransport(Modules.SeoOptimizer, 'debug'),
    createDailyRotateFileTransport(Modules.SeoValidator, 'debug'),
    createDailyRotateFileTransport(Modules.SeoPublisher, 'debug'),
    createDailyRotateFileTransport(Modules.Scheduler, 'debug'),
    createDailyRotateFileTransport(Modules.Database, 'debug'),
  );
}

const logger = winston.createLogger({
  levels: levels,
  transports: baseTransports,
  exceptionHandlers: isTestEnv
    ? []
    : [
        new winston.transports.DailyRotateFile({
          filename: path.join(LOGS_DIR, 'exceptions.%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
        }),
      ],
  rejectionHandlers: isTestEnv
    ? []
    : [
        new winston.transports.DailyRotateFile({
          filename: path.join(LOGS_DIR, 'rejections.%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          level: 'error',
        }),
      ],
});

// 提升单个 Logger 的监听上限，避免 MaxListenersExceededWarning（默认 10）
(logger as unknown as NodeJS.EventEmitter).setMaxListeners?.(30);

// 导出日志接口
export const log = (
  level: keyof typeof levels,
  moduleName: ModuleKey,
  message: string,
  meta: Record<string, any> = {},
) => {
  logger.log({ level, message, module: moduleName, ...meta });
};

// 专门用于 LLM SEO 生成日志的函数
export const logLLMSeoGeneration = (message: string, seoMeta?: object) => {
  logger.info(message, { module: Modules.LlmSeoGenerations, seoMeta });
};

// 初始化函数，现在只用于清除旧的 llm_seo_generations.log 和 test.log
export const initLogger = () => {
  if (isTestEnv) {
    return;
  }
  const oldLogFiles = [
    path.resolve(__dirname, '../test.log'),
    path.resolve(__dirname, '../llm_seo_generations.log'),
  ];

  oldLogFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        logger.info(`Removed old log file: ${file}`, { module: Modules.App });
      } catch (err: any) {
        logger.error(`Failed to remove old log file: ${file}`, {
          module: Modules.App,
          error: err,
        });
      }
    }
  });

  logger.info('Logger initialized with Winston. Old log files cleaned.', {
    module: Modules.App,
  });
};
