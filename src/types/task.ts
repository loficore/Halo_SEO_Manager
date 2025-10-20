/**
 * @file task.ts
 * @description 定义与任务调度相关的 DTO (Data Transfer Object) 接口和枚举。
 */

import { OptimizationParams } from './config';

/**
 * 任务状态枚举。
 */
export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * 创建任务请求 DTO 接口。
 */
export interface CreateTaskRequest {
  userId: string;
  articleId: string; // Halo 文章 ID
  scheduleCron: string; // Cron 表达式，例如 "0 0 * * *" 每天午夜
  llmModel: string; // 用于优化的 LLM 模型
  optimizationParams: OptimizationParams; // 本次任务的优化参数
}

/**
 * 任务响应 DTO 接口。
 */
export interface TaskResponse {
  id: string;
  userId: string;
  articleId: string;
  scheduleCron: string;
  llmModel: string;
  optimizationParams: OptimizationParams;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 更新任务请求 DTO 接口。
 */
export interface UpdateTaskRequest {
  scheduleCron?: string;
  llmModel?: string;
  optimizationParams?: OptimizationParams;
  status?: TaskStatus;
}
