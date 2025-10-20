/**
 * @file log.ts
 * @description 定义与日志查看相关的 DTO (Data Transfer Object) 接口和枚举。
 */

/**
 * 日志级别枚举。
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

/**
 * 日志条目接口。
 */
export interface LogEntry {
  timestamp: string; // ISO 8601 格式的时间戳
  level: LogLevel;
  module: string; // 记录日志的模块，例如 'AuthService', 'ConfigService'
  message: string;
  [key: string]: any; // 允许其他任意属性
}

/**
 * 日志响应 DTO 接口。
 */
export interface LogResponse {
  entries: LogEntry[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
}

/**
 * 获取日志请求 DTO 接口。
 */
export interface GetLogsRequest {
  level?: LogLevel;
  module?: string;
  startDate?: string; // ISO 8601 格式的开始日期
  endDate?: string; // ISO 8601 格式的结束日期
  search?: string; // 搜索关键词
  page?: number;
  pageSize?: number;
}
