import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/request';
import { AuthService } from '../services/AuthService';
import { ApiKeyService } from '../services/ApiKeyService';
import { UserRole } from '../types/user';
import { log, Modules } from '../logger';

/**
 * @function authMiddleware
 * @description 认证中间件，用于验证请求的认证信息（JWT 或 API Key）。
 * 如果认证成功，将用户信息附加到 req.user 上，并调用 next()。
 * 如果认证失败，返回 401 Unauthorized 或 403 Forbidden 错误。
 * @param {AuthService} authService - 认证服务实例。
 * @param {ApiKeyService} apiKeyService - API Key 服务实例。
 * @returns {Function} Express 中间件函数。
 */
export const authMiddleware = (
  authService: AuthService,
  apiKeyService: ApiKeyService,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    let userId: string | undefined;
    let userRole: UserRole | undefined;

    // 优先处理 JWT Bearer Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // TODO: 这里需要一个实际的 JWT 验证逻辑。
        // AuthService 当前通过 MelodyAuthClient 处理认证并返回 accessToken，
        // 但缺少一个直接验证 JWT token 的方法。
        // 暂时模拟一个用户，后续需与 MelodyAuthClient 的 token 验证机制集成。
        // 假设通过某种方式从 token 解析出 userId 和 userRole
        // 例如：const decodedToken = await authService.verifyJwt(token);
        // userId = decodedToken.userId;
        // userRole = decodedToken.role;

        // 临时模拟认证成功，以便后续开发
        log(
          'warn',
          Modules.AuthMiddleware,
          'JWT token validation is simulated. Implement actual JWT verification.',
          { tokenPrefix: token.substring(0, Math.min(token.length, 10)) },
        );

        const userProfile = await authService.getUserProfileFromToken(token);
        if (userProfile) {
          userId = userProfile.userId;
          userRole = userProfile.roles[0] as UserRole;
        } else {
          log('warn', Modules.AuthMiddleware, 'Invalid or expired JWT token.', {
            tokenPrefix: token.substring(0, Math.min(token.length, 10)),
          });
          return res
            .status(401)
            .json({ message: 'Unauthorized: Invalid or expired token.' });
        }
      } catch (error: any) {
        log(
          'error',
          Modules.AuthMiddleware,
          'Error during JWT token validation:',
          { error: error.message, stack: error.stack },
        );
        return res
          .status(401)
          .json({ message: 'Unauthorized: Invalid token.' });
      }
    }
    // 处理 API Key
    else if (apiKeyHeader) {
      try {
        const apiKeyEntry = await apiKeyService.validateApiKey(apiKeyHeader);
        if (apiKeyEntry) {
          // 根据 apiKeyEntry 获取 userId 和对应的角色
          // 假设 apiKeyEntry 关联的用户始终是普通用户，或者需要从数据库获取用户角色
          const user = await authService.getUserById(apiKeyEntry.userId);
          if (user) {
            userId = user.id;
            userRole = user.role;
          } else {
            log(
              'warn',
              Modules.AuthMiddleware,
              'API Key validated but associated user not found.',
              { apiKeyId: apiKeyEntry.id },
            );
            return res
              .status(401)
              .json({ message: 'Unauthorized: Associated user not found.' });
          }
        } else {
          log('warn', Modules.AuthMiddleware, 'Invalid API Key provided.');
          return res
            .status(401)
            .json({ message: 'Unauthorized: Invalid API Key.' });
        }
      } catch (error: any) {
        log(
          'error',
          Modules.AuthMiddleware,
          'Error during API Key validation:',
          { error: error.message, stack: error.stack },
        );
        return res.status(500).json({
          message: 'Internal server error during API Key validation.',
        });
      }
    }

    if (userId && userRole) {
      (req as AuthenticatedRequest).user = { id: userId, role: userRole };
      next();
    } else {
      log(
        'warn',
        Modules.AuthMiddleware,
        'No authentication credentials provided.',
      );
      return res.status(401).json({
        message: 'Unauthorized: No authentication credentials provided.',
      });
    }
  };
};
