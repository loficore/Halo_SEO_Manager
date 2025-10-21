/**
 * @description 认证服务相关的类型定义
 * @fileoverview 定义认证服务中使用的 DTO 和接口
 */

import { UserRole } from '../../types/user';
import {
  PasswordResetRequest,
  PasswordResetConfirm,
  PasswordChangeRequest,
} from '../../types/auth';

// DTOs (保持向后兼容性)
export interface LoginRequestDTO {
  username: string;
  password: string;
}

export interface RegisterRequestDTO {
  username: string;
  password: string;
  email: string;
}

export interface AuthResultDTO {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  userProfile?: UserProfileDTO;
}

export interface UserProfileDTO {
  userId: string;
  username: string;
  email: string;
  roles: string[];
}

// DTOs for JWT token payload (minimal)
export interface JwtPayload {
  userId: string;
  role: UserRole;
  exp?: number; // Expiration time
  iat?: number; // Issued at time
}

// 错误处理函数类型
export type ErrorHandler = (error: unknown, context: string, additionalInfo?: Record<string, unknown>) => void;

// 通用认证结果类型
export interface CommonAuthResult {
  success: boolean;
  message: string;
}

// 带令牌的认证结果类型
export interface AuthResultWithTokens extends CommonAuthResult {
  accessToken?: string;
  refreshToken?: string;
  userProfile?: UserProfileDTO;
}

// 带重置令牌的结果类型
export interface PasswordResetResult extends CommonAuthResult {
  resetToken?: string;
}

// MFA 启用结果类型
export interface MfaEnableResult {
  success: boolean;
  secret?: string;
  qrcodeUrl?: string;
  message?: string;
}

// 重新导出密码相关类型
export { PasswordResetRequest, PasswordResetConfirm, PasswordChangeRequest } from '../../types/auth';