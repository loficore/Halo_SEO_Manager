/**
 * 认证相关的类型定义
 * @fileoverview 定义用户认证、多因素认证和密码验证相关的类型
 */

/**
 * 用户登录凭据
 */
export interface LoginCredentials {
  /** 用户名或邮箱 */
  username: string;
  /** 密码 */
  password: string;
  /** 多因素认证验证码（可选） */
  mfaCode?: string;
}

/**
 * 用户注册信息
 */
export interface RegisterData {
  /** 用户名 */
  username: string;
  /** 邮箱地址 */
  email: string;
  /** 密码 */
  password: string;
  /** 确认密码 */
  confirmPassword: string;
}

/**
 * 认证结果
 */
export interface AuthResult {
  /** 认证是否成功 */
  success: boolean;
  /** 认证令牌 */
  accessToken?: string;
  /** 刷新令牌 */
  refreshToken?: string;
  /** 令牌过期时间 */
  expiresAt?: Date;
  /** 错误信息 */
  message?: string;
  /** 是否需要多因素认证 */
  requiresMfa?: boolean;
  /** 临时认证令牌（用于MFA验证） */
  tempToken?: string;
}

/**
 * 多因素认证设置信息
 */
export interface MfaSetupData {
  /** 秘密密钥 */
  secret: string;
  /** 备用恢复代码 */
  backupCodes: string[];
  /** QR码数据URL */
  qrCodeUrl: string;
  /** 应用名称 */
  appName: string;
  /** 用户账户名称 */
  accountName: string;
}

/**
 * 多因素认证验证结果
 */
export interface MfaVerificationResult {
  /** 验证是否成功 */
  success: boolean;
  /** 错误信息 */
  message?: string;
  /** 验证成功后的令牌对 */
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
}

/**
 * 密码强度检查结果
 */
export interface PasswordStrengthResult {
  /** 密码强度分数（0-100） */
  score: number;
  /** 强度等级 */
  level: 'weak' | 'fair' | 'good' | 'strong';
  /** 检查通过的项 */
  passedChecks: string[];
  /** 未通过的检查项 */
  failedChecks: string[];
  /** 建议改进项 */
  suggestions: string[];
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  /** 用户邮箱或用户名 */
  identifier: string;
}

/**
 * 密码重置确认
 */
export interface PasswordResetConfirm {
  /** 重置令牌 */
  token: string;
  /** 新密码 */
  newPassword: string;
  /** 确认新密码 */
  confirmPassword: string;
}

/**
 * 密码更改请求
 */
export interface PasswordChangeRequest {
  /** 当前密码 */
  currentPassword: string;
  /** 新密码 */
  newPassword: string;
  /** 确认新密码 */
  confirmPassword: string;
}

/**
 * 用户认证状态
 */
export enum AuthStatus {
  /** 未认证 */
  UNAUTHENTICATED = 'unauthenticated',
  /** 已认证 */
  AUTHENTICATED = 'authenticated',
  /** 需要多因素认证 */
  REQUIRES_MFA = 'requires_mfa',
  /** 认证过期 */
  EXPIRED = 'expired',
  /** 认证无效 */
  INVALID = 'invalid',
}
