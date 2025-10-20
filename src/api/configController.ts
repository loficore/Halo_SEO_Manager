import { Router, Request, Response, NextFunction } from 'express';
import { ConfigService } from '../services/ConfigService';
import { AuthService } from '../services/AuthService';
import { log, Modules } from '../logger';
import {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
} from '../errors/customErrors';
import {
  InitializeSystemRequest,
  UpdateSystemSettingsRequest,
} from '../types/config';
import { UserRole } from '../types/user';
import { AuthenticatedRequest } from '../types/request'; // 导入 AuthenticatedRequest

/**
 * @function createConfigController
 * @description 创建并返回一个 Express 路由器，用于处理系统配置相关的 API 请求。
 * @param configService 配置服务实例。
 * @param authService 认证服务实例。
 * @returns {Router} 配置 API 的 Express 路由器。
 */
export function createConfigController(
  configService: ConfigService,
  authService: AuthService,
): Router {
  const router = Router();

  /**
   * @route POST /api/config/initialize
   * @description 初始化系统设置。此操作通常只执行一次，用于设置管理员账户和初始配置。
   * @access Public (但在系统未初始化时才允许访问)
   */
  router.post(
    '/initialize',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      log(
        'info',
        Modules.ConfigController,
        'Received request to initialize system.',
      );
      try {
        const { adminEmail, adminPassword, ...settings } =
          req.body as InitializeSystemRequest & {
            adminEmail?: string;
            adminPassword?: string;
          };

        // 检查系统是否已初始化
        const currentSettings = await configService.getSystemSettings();
        if (currentSettings.isSystemInitialized) {
          log(
            'warn',
            Modules.ConfigController,
            'System already initialized. Initialization request rejected.',
          );
          return next(new ApiError(409, 'System already initialized.'));
        }

        // 如果提供了 adminEmail 和 adminPassword，则创建管理员用户
        if (adminEmail && adminPassword) {
          // 检查是否已有管理员用户
          const adminUsersCount = await authService.countAdminUsers();
          if (adminUsersCount > 0) {
            log(
              'warn',
              Modules.ConfigController,
              'Admin user already exists. Initialization request rejected.',
            );
            return next(
              new ApiError(
                409,
                'Admin user already exists. Cannot create another admin during initialization.',
              ),
            );
          }

          const registerResult = await authService.register({
            username: adminEmail!,
            email: adminEmail!,
            password: adminPassword!,
          });
          if (!registerResult.success) {
            log(
              'error',
              Modules.ConfigController,
              'Failed to create admin user during initialization.',
              { error: registerResult.message },
            );
            return next(
              new ApiError(
                500,
                registerResult.message || 'Failed to create admin user.',
              ),
            );
          }
          // 更新管理员用户角色
          const adminUser = await authService.getUserByUsername(adminEmail!);
          if (adminUser) {
            await authService.updateUserRole(adminUser.id, UserRole.ADMIN);
            log(
              'info',
              Modules.ConfigController,
              `Admin user ${adminEmail} created and assigned ADMIN role.`,
            );
          } else {
            log(
              'error',
              Modules.ConfigController,
              `Admin user ${adminEmail} not found after registration.`,
            );
            return next(
              new ApiError(500, 'Admin user not found after registration.'),
            );
          }
        } else {
          log(
            'warn',
            Modules.ConfigController,
            'No admin user details provided during initialization. System will be initialized without an admin user.',
          );
        }

        await configService.initializeSystem({
          ...settings,
          adminUsername: adminEmail!,
          adminPassword: adminPassword!,
        });
        res.status(200).json({ message: 'System initialized successfully.' });
        log(
          'info',
          Modules.ConfigController,
          'System initialized successfully.',
        );
      } catch (error: any) {
        log(
          'error',
          Modules.ConfigController,
          'Error during system initialization:',
          { error: error.message, stack: error.stack },
        );
        next(error);
      }
    },
  );

  /**
   * @route GET /api/config/settings
   * @description 获取所有系统设置。需要管理员权限。
   * @access Private (Admin Only)
   */
  router.get(
    '/settings',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      log(
        'info',
        Modules.ConfigController,
        'Received request to get system settings.',
      );
      try {
        // 检查用户角色
        if (!req.user || req.user.role !== UserRole.ADMIN) {
          log(
            'warn',
            Modules.ConfigController,
            'Unauthorized access to get system settings.',
            { userId: req.user?.id, role: req.user?.role },
          );
          return next(
            new ForbiddenError(
              'Only administrators can access system settings.',
            ),
          );
        }

        const settings = await configService.getSystemSettings();
        // 在返回设置时，敏感信息如 LLM API Key 和 SMTP 密码应该被遮蔽或省略
        const safeSettings = { ...settings };
        if (safeSettings.llmConfig)
          safeSettings.llmConfig.llmApiKey = '********';
        if (safeSettings.smtpConfig)
          safeSettings.smtpConfig.password = '********';

        res.status(200).json(safeSettings);
        log(
          'info',
          Modules.ConfigController,
          'System settings retrieved successfully (sensitive data masked).',
        );
      } catch (error: any) {
        log(
          'error',
          Modules.ConfigController,
          'Error retrieving system settings:',
          { error: error.message, stack: error.stack },
        );
        next(error);
      }
    },
  );

  /**
   * @route PUT /api/config/settings
   * @description 更新系统设置。需要管理员权限。
   * @access Private (Admin Only)
   */
  router.put(
    '/settings',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      log(
        'info',
        Modules.ConfigController,
        'Received request to update system settings.',
      );
      try {
        // 检查用户角色
        if (!req.user || req.user.role !== UserRole.ADMIN) {
          log(
            'warn',
            Modules.ConfigController,
            'Unauthorized access to update system settings.',
            { userId: req.user?.id, role: req.user?.role },
          );
          return next(
            new ForbiddenError(
              'Only administrators can update system settings.',
            ),
          );
        }

        const updateRequest = req.body as UpdateSystemSettingsRequest;
        await configService.updateSystemSettings(updateRequest);
        res
          .status(200)
          .json({ message: 'System settings updated successfully.' });
        log(
          'info',
          Modules.ConfigController,
          'System settings updated successfully.',
        );
      } catch (error: any) {
        log(
          'error',
          Modules.ConfigController,
          'Error updating system settings:',
          { error: error.message, stack: error.stack },
        );
        next(error);
      }
    },
  );

  return router;
}
