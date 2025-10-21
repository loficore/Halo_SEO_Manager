/**
 * 令牌相关的类型定义
 * @fileoverview 定义 JWT 令牌、刷新令牌和令牌验证相关的类型
 */

import { JwtPayload } from 'jsonwebtoken';

/**
 * JWT 访问令牌载荷
 */
export interface AccessTokenPayload extends JwtPayload {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  username: string;
  /** 用户角色 */
  role: string;
  /** 令牌类型 */
  type: 'access';
  /** 令牌签发时间 */
  iat: number;
  /** 令牌过期时间 */
  exp: number;
  /** 令牌唯一标识符 */
  jti: string;
}

/**
 * JWT 刷新令牌载荷
 */
export interface RefreshTokenPayload extends JwtPayload {
  /** 用户ID */
  userId: string;
  /** 令牌类型 */
  type: 'refresh';
  /** 令牌签发时间 */
  iat: number;
  /** 令牌过期时间 */
  exp: number;
  /** 令牌唯一标识符 */
  jti: string;
  /** 令牌版本（用于强制令牌失效） */
  version: number;
}

/**
 * JWT 临时令牌载荷（用于多因素认证）
 */
export interface TempTokenPayload extends JwtPayload {
  /** 用户ID */
  userId: string;
  /** 令牌类型 */
  type: 'temp';
  /** 令牌用途 */
  purpose: 'mfa_verification';
  /** 令牌签发时间 */
  iat: number;
  /** 令牌过期时间 */
  exp: number;
  /** 令牌唯一标识符 */
  jti: string;
}

/**
 * 令牌对
 */
export interface TokenPair {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 访问令牌过期时间（Unix时间戳） */
  accessTokenExpiresAt: number;
  /** 刷新令牌过期时间（Unix时间戳） */
  refreshTokenExpiresAt: number;
  /** 令牌类型 */
  tokenType: 'Bearer';
}

/**
 * 令牌验证结果
 */
export interface TokenVerificationResult {
  /** 验证是否成功 */
  valid: boolean;
  /** 令牌载荷 */
  payload?: AccessTokenPayload | RefreshTokenPayload | TempTokenPayload;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?:
    | 'TOKEN_EXPIRED'
    | 'TOKEN_INVALID'
    | 'TOKEN_MALFORMED'
    | 'TOKEN_REVOKED';
}

/**
 * 令牌刷新请求
 */
export interface TokenRefreshRequest {
  /** 刷新令牌 */
  refreshToken: string;
}

/**
 * 令牌刷新结果
 */
export interface TokenRefreshResult {
  /** 刷新是否成功 */
  success: boolean;
  /** 新的访问令牌 */
  accessToken?: string;
  /** 新的刷新令牌 */
  refreshToken?: string;
  /** 新的令牌对 */
  tokenPair?: TokenPair;
  /** 错误信息 */
  message?: string;
  /** 错误代码 */
  errorCode?:
    | 'REFRESH_TOKEN_EXPIRED'
    | 'REFRESH_TOKEN_INVALID'
    | 'REFRESH_TOKEN_REVOKED';
}

/**
 * 令牌黑名单条目
 */
export interface TokenBlacklistEntry {
  /** 令牌唯一标识符 */
  jti: string;
  /** 令牌过期时间 */
  expiresAt: Date;
  /** 添加到黑名单的时间 */
  blacklistedAt: Date;
  /** 令牌所有者用户ID */
  userId: string;
  /** 注销原因 */
  reason: string;
}

/**
 * 令牌配置选项
 */
export interface TokenConfig {
  /** 访问令牌有效期（秒） */
  accessTokenExpiry: number;
  /** 刷新令牌有效期（秒） */
  refreshTokenExpiry: number;
  /** 临时令牌有效期（秒） */
  tempTokenExpiry: number;
  /** JWT 签名密钥 */
  secret: string;
  /** JWT 签名算法 */
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  /** 令牌签发者 */
  issuer: string;
  /** 令牌受众 */
  audience: string;
}

/**
 * 令牌类型枚举
 */
export enum TokenType {
  /** 访问令牌 */
  ACCESS = 'access',
  /** 刷新令牌 */
  REFRESH = 'refresh',
  /** 临时令牌 */
  TEMP = 'temp',
}

/**
 * 令牌状态枚举
 */
export enum TokenStatus {
  /** 有效 */
  VALID = 'valid',
  /** 已过期 */
  EXPIRED = 'expired',
  /** 无效 */
  INVALID = 'invalid',
  /** 已撤销 */
  REVOKED = 'revoked',
}

/**
 * 刷新令牌数据库记录
 */
export interface RefreshTokenRecord {
  /** 令牌 ID */
  id: string;
  /** 用户 ID */
  userId: string;
  /** 令牌哈希值 */
  tokenHash: string;
  /** 过期时间 */
  expiresAt: Date;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 是否已撤销 */
  isRevoked: boolean;
  /** 撤销时间 */
  revokedAt?: Date;
  /** 撤销原因 */
  revokedReason?: string;
  /** 设备信息 */
  deviceInfo?: DeviceInfo;
  /** IP 地址 */
  ipAddress?: string;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 设备信息
 */
export interface DeviceInfo {
  /** 设备类型 */
  type: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  /** 操作系统 */
  os?: string;
  /** 浏览器 */
  browser?: string;
  /** 浏览器版本 */
  browserVersion?: string;
  /** 设备名称 */
  deviceName?: string;
}

/**
 * 刷新令牌创建参数
 */
export interface CreateRefreshTokenParams {
  /** 用户 ID */
  userId: string;
  /** 令牌哈希值 */
  tokenHash: string;
  /** 过期时间 */
  expiresAt: Date;
  /** 设备信息 */
  deviceInfo?: DeviceInfo;
  /** IP 地址 */
  ipAddress?: string;
  /** 用户代理 */
  userAgent?: string;
}

/**
 * 刷新令牌查询结果
 */
export interface RefreshTokenQueryResult {
  /** 令牌记录 */
  token: RefreshTokenRecord;
  /** 是否有效 */
  isValid: boolean;
  /** 剩余有效时间（秒） */
  remainingTime?: number;
}

/**
 * 令牌撤销原因枚举
 */
export enum RevokeReason {
  /** 用户登出 */
  USER_LOGOUT = 'User logout',
  /** 新登录 */
  NEW_LOGIN = 'New login',
  /** 密码更改 */
  PASSWORD_CHANGE = 'Password change',
  /** 安全操作 */
  SECURITY_ACTION = 'Security action',
  /** 管理员操作 */
  ADMIN_ACTION = 'Admin action',
  /** 可疑活动 */
  SUSPICIOUS_ACTIVITY = 'Suspicious activity',
  /** 令牌撤销 */
  TOKEN_REVOKED = 'Token revoked',
  /** 其他 */
  OTHER = 'Other',
}
