/**
 * @description apiKeyController 模块处理与 API Key 管理相关的API请求。
 * @description English: The apiKeyController module handles API requests related to API Key management.
 */

import { Response, Router } from 'express';
import { ApiKeyService } from '../services/ApiKeyService.js';
import { DatabaseManager } from '../database';
import { log, Modules } from '../logger';
import { body, param, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../types/request'; // 导入 AuthenticatedRequest
import { authMiddleware } from '../middleware/authMiddleware'; // 导入认证中间件
import { AuthService } from '../services/AuthService'; // 导入 AuthService (用于authMiddleware)
import { ConfigService } from '../services/ConfigService'; // 导入 ConfigService (用于authMiddleware)
import { MelodyAuthClient } from '../services/melodyAuthClient'; // 导入 MelodyAuthClient (用于authMiddleware)

const router = Router();
const dbManager = new DatabaseManager(); // 应该从DI容器获取，这里简化
const melodyAuthClient = new MelodyAuthClient('http://localhost:3001'); // 假设MelodyAuth运行在3001端口
const configService = new ConfigService(dbManager); // 实例化 ConfigService
const authService = new AuthService(dbManager, melodyAuthClient, configService); // 实例化 AuthService
const apiKeyService = new ApiKeyService(dbManager);
const apiAuthMiddleware = authMiddleware(authService, apiKeyService); // 创建认证中间件实例

/**
 * @description 获取当前用户的所有 API Key 列表。
 * @description English: Get all API Keys for the current user.
 * @route GET /api/api-keys
 * @returns {Response} API Key 列表。
 */
router.get(
  '/',
  apiAuthMiddleware, // 应用认证中间件
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user || !req.user.id) {
      log(
        'warn',
        Modules.ApiKeyController,
        'Unauthorized access to list API Keys: User not authenticated. This should be caught by middleware.',
        { user: req.user },
      );
      return res
        .status(401)
        .json({ message: 'Unauthorized: User not authenticated.' });
    }

    try {
      const apiKeys = await apiKeyService.listApiKeys(req.user.id);
      return res.status(200).json(apiKeys);
    } catch (error: any) {
      log(
        'error',
        Modules.ApiKeyController,
        `Error listing API Keys for user ${req.user.id}:`,
        {
          error: error.message,
          stack: error.stack,
        },
      );
      return res
        .status(500)
        .json({ message: 'Internal server error while listing API Keys.' });
    }
  },
);

/**
 * @description 创建一个新的 API Key。
 * @description English: Create a new API Key.
 * @route POST /api/api-keys
 * @param {string} req.body.name - API Key 的名称。
 * @returns {Response} 创建的 API Key 信息（不包含原始 Key）。
 */
router.post(
  '/',
  apiAuthMiddleware, // 应用认证中间件
  [
    body('name')
      .notEmpty()
      .withMessage('API Key name is required')
      .isLength({ min: 3 })
      .withMessage('API Key name must be at least 3 characters long'),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log(
        'warn',
        Modules.ApiKeyController,
        'Validation errors during API Key creation.',
        { errors: errors.array() },
      );
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user || !req.user.id) {
      log(
        'warn',
        Modules.ApiKeyController,
        'Unauthorized access to create API Key: User not authenticated. This should be caught by middleware.',
        { user: req.user },
      );
      return res
        .status(401)
        .json({ message: 'Unauthorized: User not authenticated.' });
    }

    const { name } = req.body;
    try {
      const { apiKey, hashedKey } = await apiKeyService.generateApiKey(
        req.user.id,
        name,
      );
      const newApiKeyResponse = await apiKeyService.createApiKey(
        req.user.id,
        name,
        hashedKey,
      );

      // 返回新创建的 API Key 的元数据，不包含原始 apiKey
      return res.status(201).json({
        message:
          'API Key created successfully. Please save the key as it will not be shown again.',
        apiKey: apiKey, // 首次创建时返回原始 key
        apiKeyMetadata: {
          id: newApiKeyResponse.id,
          userId: newApiKeyResponse.userId,
          name: newApiKeyResponse.name,
          keyPrefix: newApiKeyResponse.keyPrefix,
          type: newApiKeyResponse.type,
          createdAt: newApiKeyResponse.createdAt,
          updatedAt: newApiKeyResponse.updatedAt,
        },
      });
    } catch (error: any) {
      log(
        'error',
        Modules.ApiKeyController,
        `Error creating API Key for user ${req.user.id} with name ${name}:`,
        {
          error: error.message,
          stack: error.stack,
        },
      );
      return res
        .status(500)
        .json({ message: 'Internal server error while creating API Key.' });
    }
  },
);

/**
 * @description 删除指定 ID 的 API Key。
 * @description English: Delete a specified API Key by ID.
 * @route DELETE /api/api-keys/:id
 * @param {string} req.params.id - API Key 的 ID。
 * @returns {Response} 删除成功或失败的信息。
 */
router.delete(
  '/:id',
  apiAuthMiddleware, // 应用认证中间件
  [param('id').notEmpty().withMessage('API Key ID is required')],
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log(
        'warn',
        Modules.ApiKeyController,
        'Validation errors during API Key deletion.',
        { errors: errors.array() },
      );
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user || !req.user.id) {
      log(
        'warn',
        Modules.ApiKeyController,
        'Unauthorized access to delete API Key: User not authenticated. This should be caught by middleware.',
        { user: req.user },
      );
      return res
        .status(401)
        .json({ message: 'Unauthorized: User not authenticated.' });
    }

    const { id } = req.params;
    try {
      const success = await apiKeyService.deleteApiKey(req.user.id, id);
      if (success) {
        return res
          .status(200)
          .json({ message: `API Key with ID ${id} deleted successfully.` });
      } else {
        return res
          .status(404)
          .json({
            message: `API Key with ID ${id} not found or not authorized to delete.`,
          });
      }
    } catch (error: any) {
      log(
        'error',
        Modules.ApiKeyController,
        `Error deleting API Key ${id} for user ${req.user.id}:`,
        {
          error: error.message,
          stack: error.stack,
        },
      );
      return res
        .status(500)
        .json({ message: 'Internal server error while deleting API Key.' });
    }
  },
);

export default router;
