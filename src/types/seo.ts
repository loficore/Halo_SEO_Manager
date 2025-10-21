/**
 * @file seo.ts
 * @description 定义与 SEO 相关的接口和类型
 */

/**
 * SEO 元数据接口
 */
export interface SeoMeta {
  /** 页面标题 */
  metaTitle: string;
  /** 页面描述 */
  metaDescription: string;
  /** 关键词数组 */
  keywords: string[];
  /** URL 路径 */
  slug: string;
}

/**
 * 结构化校验错误，便于提示词针对性修正
 */
export interface SeoValidationError {
  /** 错误字段 */
  field: 'metaTitle' | 'metaDescription' | 'keywords' | 'slug';
  /** 错误代码 */
  code:
    | 'empty'
    | 'too_long'
    | 'too_short'
    | 'length_range'
    | 'count_range'
    | 'item_empty'
    | 'pattern';
  /** 错误消息 */
  message: string;
  /** 当前值 */
  currentValue?: unknown;
  /** 当前长度 */
  currentLength?: number;
  /** 要求 */
  requirement?: string;
}

/**
 * SEO 验证报告接口
 */
export interface SeoValidationReport {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: SeoValidationError[];
}
