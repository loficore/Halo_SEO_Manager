/**
 * @file apiKey.ts
 * @description 定义与 API Key 管理相关的 DTO (Data Transfer Object) 接口和枚举。
 */

/**
 * API Key 类型枚举。
 */
export enum ApiKeyType {
  LLM = 'LLM', // 用于大型语言模型
  HALO = 'HALO', // 用于 Halo CMS 交互
  OTHER = 'OTHER', // 其他类型
}

/**
 * 创建 API Key 请求 DTO 接口。
 */
export interface CreateApiKeyRequest {
  name: string;
  key: string; // 原始 API Key
  type: ApiKeyType;
  userId: string; // 关联的用户 ID
}

/**
 * API Key 响应 DTO 接口 (不包含原始 key，只包含前缀)。
 */
export interface ApiKeyResponse {
  id: string;
  name: string;
  keyHash: string; // 存储 API Key 的哈希值
  keyPrefix: string; // API Key 的前缀，用于显示
  type: ApiKeyType;
  createdAt: Date;
  updatedAt: Date; // 添加 updatedAt 属性
  userId: string;
}

/**
 * 更新 API Key 请求 DTO 接口。
 */
export interface UpdateApiKeyRequest {
  name?: string;
  key?: string; // 原始 API Key
  type?: ApiKeyType;
}
