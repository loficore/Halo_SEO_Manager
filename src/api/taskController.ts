import { Response, Router } from 'express';
import { TaskService } from '../services/TaskService';
import {
  TaskStatus,
  CreateTaskRequest,
  UpdateTaskRequest,
} from '../types/task';
import { log, Modules } from '../logger';
import { body, param, validationResult } from 'express-validator';
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
 * @description 创建任务控制器。
 * @param taskService 任务服务实例。
 * @returns Express 路由器。
 */
export const createTaskController = (taskService: TaskService): Router => {
  const router = Router();

  /**
   * @description 获取所有优化任务列表。
   * @route GET /api/tasks
   * @returns {Response} 任务列表。
   */
  router.get(
    '/',
    apiAuthMiddleware, // 应用认证中间件
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.user || !req.user.id) {
        log(
          'warn',
          Modules.TaskController,
          'Unauthorized access to list tasks: User not authenticated. This should be caught by middleware.',
          { user: req.user },
        );
        return res
          .status(401)
          .json({ message: 'Unauthorized: User not authenticated.' });
      }

      try {
        const tasks = await taskService.getTasksByUserId(req.user.id);
        return res.status(200).json(tasks);
      } catch (error: any) {
        log(
          'error',
          Modules.TaskController,
          `Error listing tasks for user ${req.user.id}:`,
          {
            error: error.message,
            stack: error.stack,
          },
        );
        return res
          .status(500)
          .json({ message: 'Internal server error while listing tasks.' });
      }
    },
  );

  /**
   * @description 创建并调度一个新的优化任务。
   * @route POST /api/tasks
   * @param {string} req.body.articleId - Halo 文章 ID。
   * @param {string} req.body.scheduleCron - Cron 表达式。
   * @param {string} req.body.llmModel - 用于优化的 LLM 模型。
   * @param {OptimizationParams} req.body.optimizationParams - 优化参数。
   * @returns {Response} 新创建的任务信息。
   */
  router.post(
    '/',
    apiAuthMiddleware, // 应用认证中间件
    [
      body('articleId').notEmpty().withMessage('Article ID is required.'),
      body('scheduleCron')
        .notEmpty()
        .withMessage('Schedule cron expression is required.'),
      body('llmModel').notEmpty().withMessage('LLM model is required.'),
      body('optimizationParams')
        .isObject()
        .withMessage('Optimization parameters must be an object.'),
    ],
    async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        log(
          'warn',
          Modules.TaskController,
          'Validation errors during task creation.',
          { errors: errors.array() },
        );
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user || !req.user.id) {
        log(
          'warn',
          Modules.TaskController,
          'Unauthorized access to create task: User not authenticated. This should be caught by middleware.',
          { user: req.user },
        );
        return res
          .status(401)
          .json({ message: 'Unauthorized: User not authenticated.' });
      }

      const { articleId, scheduleCron, llmModel, optimizationParams } =
        req.body;
      const createTaskRequest: CreateTaskRequest = {
        userId: req.user.id,
        articleId,
        scheduleCron,
        llmModel,
        optimizationParams,
      };

      try {
        const newTask = await taskService.createTask(createTaskRequest);
        return res.status(201).json(newTask);
      } catch (error: any) {
        log(
          'error',
          Modules.TaskController,
          `Error creating task for user ${req.user.id}:`,
          {
            error: error.message,
            stack: error.stack,
          },
        );
        return res
          .status(500)
          .json({ message: 'Internal server error while creating task.' });
      }
    },
  );

  /**
   * @description 更新指定 ID 的优化任务。
   * @route PUT /api/tasks/:id
   * @param {string} req.params.id - 任务 ID。
   * @param {string} [req.body.scheduleCron] - Cron 表达式。
   * @param {string} [req.body.llmModel] - 用于优化的 LLM 模型。
   * @param {OptimizationParams} [req.body.optimizationParams] - 优化参数。
   * @param {TaskStatus} [req.body.status] - 任务状态。
   * @returns {Response} 更新成功或失败的信息。
   */
  router.put(
    '/:id',
    apiAuthMiddleware, // 应用认证中间件
    [
      param('id').notEmpty().withMessage('Task ID is required.'),
      body('scheduleCron')
        .optional()
        .notEmpty()
        .withMessage('Schedule cron expression cannot be empty.'),
      body('llmModel')
        .optional()
        .notEmpty()
        .withMessage('LLM model cannot be empty.'),
      body('optimizationParams')
        .optional()
        .isObject()
        .withMessage('Optimization parameters must be an object.'),
      body('status')
        .optional()
        .isIn(Object.values(TaskStatus))
        .withMessage('Invalid task status.'),
    ],
    async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        log(
          'warn',
          Modules.TaskController,
          'Validation errors during task update.',
          { errors: errors.array() },
        );
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user || !req.user.id) {
        log(
          'warn',
          Modules.TaskController,
          'Unauthorized access to update task: User not authenticated. This should be caught by middleware.',
          { user: req.user },
        );
        return res
          .status(401)
          .json({ message: 'Unauthorized: User not authenticated.' });
      }

      const { id } = req.params;
      const updateTaskRequest: UpdateTaskRequest = req.body;

      try {
        await taskService.updateTask(id, req.user.id, updateTaskRequest);
        return res
          .status(200)
          .json({ message: `Task with ID ${id} updated successfully.` });
      } catch (error: any) {
        log(
          'error',
          Modules.TaskController,
          `Error updating task ${id} for user ${req.user.id}:`,
          {
            error: error.message,
            stack: error.stack,
          },
        );
        if (error.message.includes('not found or unauthorized')) {
          return res.status(404).json({ message: error.message });
        }
        return res
          .status(500)
          .json({ message: 'Internal server error while updating task.' });
      }
    },
  );

  /**
   * @description 删除指定 ID 的优化任务。
   * @route DELETE /api/tasks/:id
   * @param {string} req.params.id - 任务 ID。
   * @returns {Response} 删除成功或失败的信息。
   */
  router.delete(
    '/:id',
    apiAuthMiddleware, // 应用认证中间件
    [param('id').notEmpty().withMessage('Task ID is required.')],
    async (req: AuthenticatedRequest, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        log(
          'warn',
          Modules.TaskController,
          'Validation errors during task deletion.',
          { errors: errors.array() },
        );
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.user || !req.user.id) {
        log(
          'warn',
          Modules.TaskController,
          'Unauthorized access to delete task: User not authenticated. This should be caught by middleware.',
          { user: req.user },
        );
        return res
          .status(401)
          .json({ message: 'Unauthorized: User not authenticated.' });
      }

      const { id } = req.params;

      try {
        await taskService.deleteTask(id, req.user.id);
        return res
          .status(200)
          .json({ message: `Task with ID ${id} deleted successfully.` });
      } catch (error: any) {
        log(
          'error',
          Modules.TaskController,
          `Error deleting task ${id} for user ${req.user.id}:`,
          {
            error: error.message,
            stack: error.stack,
          },
        );
        if (error.message.includes('not found or unauthorized')) {
          return res.status(404).json({ message: error.message });
        }
        return res
          .status(500)
          .json({ message: 'Internal server error while deleting task.' });
      }
    },
  );

  return router;
};
