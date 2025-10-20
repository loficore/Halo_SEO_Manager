/**
 * @file config.ts
 * @description 定义与系统配置相关的 DTO (Data Transfer Object) 接口和枚举。
 */

/**
 * 系统状态接口，用于表示系统的初始化和配置状态。
 */
export interface SystemStatus {
  isSystemInitialized: boolean;
  isSmtpConfigured: boolean;
  allowNewUserRegistration: boolean; // 控制普通用户注册是否开放
}

/**
 * SMTP 配置接口。
 */
export interface SmtpConfig {
  host: string;
  port: number;
  username: string; // 使用 username 替换 auth.user
  password: string; // 使用 password 替换 auth.pass
  fromAddress: string; // 发件人邮箱
  secure: boolean; // true for 465, false for other ports
}

/**
 * LLM (Large Language Model) 配置接口。
 */
export interface LlmConfig {
  llmModel: string; // 默认模型，例如 'gpt-3.5-turbo'
  llmApiKey: string;
  llmApiBaseUrl?: string; // OpenAI compatible API 的基础 URL
}

/**
 * SEO 优化参数接口。
 */
export interface OptimizationParams {
  minContentLength: number;
  maxContentLength: number;
  minDaysSinceLastOptimization: number;
  forceReoptimize: boolean;
  metaDescriptionLength?: number; // 允许 LLM 生成的 metaDescription 长度 (例如：160)
  keywordsCount?: number; // 允许 LLM 生成的关键词数量 (例如：3)
}

/**
 * 系统设置 DTO 接口，用于在 API 之间传输完整的系统设置。
 */
export interface SystemSettings {
  isSystemInitialized: boolean; // 系统是否已初始化
  smtpConfig: SmtpConfig;
  llmConfig: LlmConfig;
  optimizationParams: OptimizationParams;
  databasePath: string; // 数据库文件路径
  logFilePath: string; // 日志文件路径
  allowNewUserRegistration: boolean; // 是否允许新用户注册
}

/**
 * 初始化系统请求 DTO 接口。
 */
export interface InitializeSystemRequest {
  adminUsername: string;
  adminPassword: string;
  smtpConfig?: SmtpConfig;
  llmConfig?: LlmConfig;
  optimizationParams?: OptimizationParams;
  databasePath?: string; // 数据库文件路径
  logFilePath?: string; // 日志文件路径
  allowNewUserRegistration?: boolean; // 是否允许新用户注册
}

/**
 * 更新系统设置请求 DTO 接口。
 */
export interface UpdateSystemSettingsRequest {
  smtpConfig?: SmtpConfig;
  llmConfig?: LlmConfig;
  optimizationParams?: OptimizationParams;
  databasePath?: string;
  logFilePath?: string;
  allowNewUserRegistration?: boolean;
}
