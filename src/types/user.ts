/**
 * @file user.ts
 * @description 定义与用户相关的 DTO (Data Transfer Object) 接口和枚举。
 */

/**
 * 用户角色枚举。
 */
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

/**
 * 用户接口。
 */
export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  mfaSecret?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建用户请求 DTO 接口。
 */
export interface CreateUserRequest {
  username: string;
  email?: string;
  password: string;
  role?: UserRole;
}

/**
 * 用户响应 DTO 接口 (不包含密码哈希和 MFA 密钥)。
 */
export interface UserResponse {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 更新用户角色请求 DTO 接口。
 */
export interface UpdateUserRoleRequest {
  role: UserRole;
}

/**
 * 更新用户 MFA 密钥请求 DTO 接口。
 */
export interface UpdateUserMfaSecretRequest {
  mfaSecret: string | null;
}
