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
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void | Response> => {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    let userId: string | undefined;
    let userRole: UserRole | undefined;

    // 优先处理 JWT Bearer Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        // 使用新的 JwtService 验证令牌
        const verificationResult = authService.verifyAccessToken(token);
        
        if (!verificationResult.valid) {
          log('warn', Modules.AuthMiddleware, `JWT token validation failed: ${verificationResult.error}`, {
            tokenPrefix: token.substring(0, Math.min(token.length, 10)),
            errorCode: verificationResult.errorCode,
          });
          
          // 根据错误类型返回不同的状态码
          const statusCode = verificationResult.errorCode === 'TOKEN_EXPIRED' ? 401 : 403;
          return res.status(statusCode).json({
            message: `Unauthorized: ${verificationResult.error}`,
            errorCode: verificationResult.errorCode
          });
        }

        // 从验证成功的令牌中提取用户信息
        const payload = verificationResult.payload;
        if (payload) {
          userId = payload.userId;
          userRole = payload.role as UserRole;
          
          log('info', Modules.AuthMiddleware, 'JWT token validated successfully', {
            userId,
            userRole,
            tokenPrefix: token.substring(0, Math.min(token.length, 10)),
          });
        } else {
          log('warn', Modules.AuthMiddleware, 'Valid JWT token but no payload found', {
            tokenPrefix: token.substring(0, Math.min(token.length, 10)),
          });
          return res.status(401).json({ message: 'Unauthorized: Invalid token payload.' });
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        log(
          'error',
          Modules.AuthMiddleware,
          'Error during JWT token validation:',
          { error: errorMessage, stack: errorStack },
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
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        log(
          'error',
          Modules.AuthMiddleware,
          'Error during API Key validation:',
          { error: errorMessage, stack: errorStack },
        );
        return res.status(500).json({
          message: 'Internal server error during API Key validation.',
        });
      }
    }

    if (userId && userRole) {
      // 需要获取用户名和邮箱信息以满足新的类型定义
      try {
        const user = await authService.getUserById(userId);
        (req as AuthenticatedRequest).user = {
          id: userId,
          role: userRole,
          username: user?.username || '',
          email: user?.email
        };
        next();
      } catch (error) {
        log(
          'error',
          Modules.AuthMiddleware,
          'Error fetching user details for authentication context:',
          { userId, error: error instanceof Error ? error.message : String(error) }
        );
        return res.status(500).json({
          message: 'Internal server error during authentication.',
        });
      }
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
