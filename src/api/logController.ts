import { Response, Router } from 'express';
import { LogService } from '../services/LogService';
import { LogLevel, GetLogsRequest } from '../types/log';
import { log, Modules } from '../logger';
import { query, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types/request'; // 导入 AuthenticatedRequest
import { authMiddleware } from '../middleware/authMiddleware'; // 导入认证中间件
import { AuthService } from '../services/AuthService'; // 导入 AuthService (用于authMiddleware)
import { ApiKeyService } from '../services/ApiKeyService'; // 导入 ApiKeyService (用于authMiddleware)
import { ConfigService } from '../services/ConfigService'; // 导入 ConfigService (用于authMiddleware)
import { DatabaseManager } from '../database'; // 导入 DatabaseManager (用于authMiddleware)
import { MelodyAuthClient } from '../services/melodyAuthClient'; // 导入 MelodyAuthClient (用于authMiddleware)

// 依赖注入应该在主文件中完成，这里为了保持自洽性进行实例化
const dbManager = new DatabaseManager();
const melodyAuthClient = new MelodyAuthClient('http://localhost:3001'); // 假设MelodyAuth运行在3001端口
const configService = new ConfigService(dbManager);
const authService = new AuthService(dbManager, melodyAuthClient, configService);
const apiKeyService = new ApiKeyService(dbManager);
const apiAuthMiddleware = authMiddleware(authService, apiKeyService);

/**
 * @description 创建日志控制器。
 * @param logService 日志服务实例。
 * @returns Express 路由器。
 */
export const createLogController = (logService: LogService): Router => {
  const router = Router();

  /**
   * @description 查看系统日志（支持过滤和分页）。
   * @route GET /api/logs
   * @query {LogLevel} [level] - 日志级别过滤。
   * @query {string} [module] - 模块名称过滤。
   * @query {string} [startDate] - 开始日期 (ISO 8601)。
   * @query {string} [endDate] - 结束日期 (ISO 8601)。
   * @query {string} [search] - 搜索关键词。
   * @query {number} [page=1] - 页码。
   * @query {number} [pageSize=20] - 每页大小。
   * @returns {Response} 日志条目列表。
   */
  router.get(
    '/',
    apiAuthMiddleware, // 应用认证中间件
    [
      query('level')
        .optional()
        .isIn(Object.values(LogLevel))
        .withMessage('Invalid log level.'),
      query('module')
        .optional()
        .isString()
        .withMessage('Module must be a string.'),
      query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date.'),
      query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date.'),
      query('search')
        .optional()
        .isString()
        .withMessage('Search query must be a string.'),
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer.'),
      query('pageSize')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Page size must be an integer between 1 and 100.'),
    ],
    async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        log(
          'warn',
          Modules.LogController,
          'Validation errors during log retrieval.',
          { errors: errors.array() },
        );
        return res.status(400).json({ errors: errors.array() });
      }

      // In a real application, only administrators should be able to view logs
      if (!req.user || !req.user.id || req.user.role !== 'admin') {
        log(
          'warn',
          Modules.LogController,
          'Unauthorized access to view logs: User not authenticated or not an admin.',
          { userId: req.user?.id, role: req.user?.role },
        );
        return res
          .status(403)
          .json({ message: 'Forbidden: Only administrators can view logs.' });
      }

      const getLogsRequest: GetLogsRequest = {
        level: req.query.level as LogLevel,
        module: req.query.module as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        search: req.query.search as string,
        page: req.query.page
          ? parseInt(req.query.page as string, 10)
          : undefined,
        pageSize: req.query.pageSize
          ? parseInt(req.query.pageSize as string, 10)
          : undefined,
      };

      try {
        const logs = await logService.getLogs(getLogsRequest);
        return res.status(200).json(logs);
      } catch (error: any) {
        log('error', Modules.LogController, 'Error retrieving system logs:', {
          error: error.message,
          stack: error.stack,
        });
        return res
          .status(500)
          .json({ message: 'Internal server error while retrieving logs.' });
      }
    },
  );

  return router;
};
