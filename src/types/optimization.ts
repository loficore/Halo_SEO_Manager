/**
 * @file optimization.ts
 * @description 定义与 SEO 优化过程和报告相关的 DTO (Data Transfer Object) 接口和枚举。
 */

import { OptimizationParams } from './config';
import { TaskStatus } from './task';

/**
 * SEO 优化报告接口。
 */
export interface SeoOptimizationReport {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  slug: string;
  originalContentHash: string; // 原始文章内容的哈希，用于检测内容是否变更
  optimizedContentHash: string; // 优化后文章内容的哈希
  validationFeedback?: string; // 验证器提供的反馈
}

/**
 * SEO 优化运行记录接口。
 */
export interface SeoRun {
  id: string;
  userId: string;
  articleId: string; // Halo 文章 ID
  llmModel: string;
  optimizationParams: OptimizationParams;
  status: TaskStatus; // 优化运行状态
  startTime: Date;
  endTime?: Date;
  report?: SeoOptimizationReport;
  errorMessage?: string; // 如果失败，记录错误信息
  retryCount: number; // 重试次数
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 优化运行响应 DTO 接口。
 */
export interface SeoRunResponse {
  id: string;
  userId: string;
  articleId: string;
  llmModel: string;
  optimizationParams: OptimizationParams;
  status: TaskStatus;
  startTime: Date;
  endTime?: Date;
  report?: SeoOptimizationReport;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}