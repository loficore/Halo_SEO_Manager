import { Response, Router } from 'express';
import { OptimizationService } from '../services/OptimizationService';
import { log, Modules } from '../logger';
import { param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types/request'; // 导入 AuthenticatedRequest
import { authMiddleware } from '../middleware/authMiddleware'; // 导入认证中间件
import { AuthService } from '../services/AuthService'; // 导入 AuthService (用于authMiddleware)
import { ApiKeyService } from '../services/ApiKeyService'; // 导入 ApiKeyService (用于authMiddleware)
import { ConfigService } from '../services/ConfigService'; // 导入 ConfigService (用于authMiddleware)
import { DatabaseManager } from '../database'; // 导入 DatabaseManager (用于authMiddleware)
import { JwtService } from '../services/JwtService'; // 导入 JwtService
import { MfaService } from '../services/MfaService'; // 导入 MfaService
import { PasswordService } from '../services/PasswordService'; // 导入 PasswordService

// 依赖注入应该在主文件中完成，这里为了保持自洽性进行实例化
const dbManager = new DatabaseManager();
const configService = new ConfigService(dbManager);
const jwtService = new JwtService();
const mfaService = new MfaService();
const passwordService = new PasswordService();
const authService = new AuthService(
  dbManager,
  configService,
  jwtService,
  mfaService,
  passwordService
);
const apiKeyService = new ApiKeyService(dbManager);
const apiAuthMiddleware = authMiddleware(authService, apiKeyService);

/**
 * @description 创建优化控制器。
 * @param optimizationService 优化服务实例。
 * @returns Express 路由器。
 */
export const createOptimizationController = (
  optimizationService: OptimizationService,
): Router => {
  const router = Router();

  /**
   * @description 获取所有优化任务的执行状态和报告。
   * @route GET /api/optimizations
   * @returns {Response} 优化任务执行状态和报告列表。
   */
  router.get(
    '/',
    apiAuthMiddleware, // 应用认证中间件
    async (req: AuthenticatedRequest, res: Response) => {
      // For simplicity, we'll allow all users to view all optimization runs.
      // In a real application, this would be restricted to admins or filtered by user ID.
      if (!req.user || !req.user.id) {
        log(
          'warn',
          Modules.OptimizationController,
          'Unauthorized access to list optimizations: User not authenticated. This should be caught by middleware.',
          { user: req.user },
        );
        return res
          .status(401)
          .json({ message: 'Unauthorized: User not authenticated.' });
      }

      try {
        const optimizations =
          await optimizationService.getAllOptimizationRuns(); // Assuming this method returns all runs
        return res.status(200).json(optimizations);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        log(
          'error',
          Modules.OptimizationController,
          'Error listing all optimization runs:',
          {
            error: errorMessage,
            stack: errorStack,
          },
        );
        return res.status(500).json({
          message: 'Internal server error while listing optimization runs.',
        });
      }
    },
  );

  /**
   * @description 获取指定 ID 的优化任务详情和报告。
   * @route GET /api/optimizations/:id
   * @param {string} req.params.id - 优化运行 ID。
   * @returns {Response} 指定优化任务的详情和报告。
   */
  router.get(
    '/:id',
    apiAuthMiddleware, // 应用认证中间件
    [param('id').notEmpty().withMessage('Optimization run ID is required.')],
    async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        log(
          'warn',
          Modules.OptimizationController,
          'Validation errors during optimization run retrieval.',
          { errors: errors.array() },
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;

      try {
        const optimizationRun =
          await optimizationService.getOptimizationReport(id);
        if (optimizationRun) {
          // In a real application, you might want to check if req.user.id matches optimizationRun.userId
          // For now, we allow access to any optimization run by ID.
          return res.status(200).json(optimizationRun);
        } else {
          log(
            'warn',
            Modules.OptimizationController,
            `Optimization run with ID ${id} not found.`,
          );
          return res
            .status(404)
            .json({ message: `Optimization run with ID ${id} not found.` });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        log(
          'error',
          Modules.OptimizationController,
          `Error retrieving optimization run ${id}:`,
          {
            error: errorMessage,
            stack: errorStack,
          },
        );
        return res.status(500).json({
          message: 'Internal server error while retrieving optimization run.',
        });
      }
    },
  );

  return router;
};
