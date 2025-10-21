import { Request } from 'express';
import { UserRole } from './user';
import { AccessTokenPayload } from './token';

/**
 * @interface AuthenticatedRequest
 * @description 扩展 Express 的 Request 接口，包含认证用户的信息。
 * @property {object} user - 认证用户的信息。
 * @property {string} user.id - 用户的唯一 ID。
 * @property {UserRole} user.role - 用户的角色。
 * @property {string} user.username - 用户名。
 * @property {string} [user.email] - 用户邮箱（可选）。
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    username: string;
    email?: string;
  };
}

/**
 * @interface TokenAuthenticatedRequest
 * @description 扩展 Express 的 Request 接口，包含令牌验证信息。
 * @property {AccessTokenPayload} tokenPayload - JWT 令牌载荷信息。
 */
export interface TokenAuthenticatedRequest extends Request {
  tokenPayload?: AccessTokenPayload;
}

/**
 * @interface ApiKeyAuthenticatedRequest
 * @description 扩展 Express 的 Request 接口，包含 API Key 认证信息。
 * @property {object} apiKey - API Key 信息。
 * @property {string} apiKey.id - API Key 的唯一 ID。
 * @property {string} apiKey.name - API Key 名称。
 * @property {string} apiKey.userId - 关联的用户 ID。
 */
export interface ApiKeyAuthenticatedRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    userId: string;
  };
}
