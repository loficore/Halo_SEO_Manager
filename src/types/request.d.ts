import { Request } from 'express';
import { UserRole } from './user';

/**
 * @interface AuthenticatedRequest
 * @description 扩展 Express 的 Request 接口，包含认证用户的信息。
 * @property {object} user - 认证用户的信息。
 * @property {string} user.id - 用户的唯一 ID。
 * @property {UserRole} user.role - 用户的角色。
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}
