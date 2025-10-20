/**
 * @description authController 模块处理与用户认证和授权相关的API请求。
 * @description English: The authController module handles API requests related to user authentication and authorization.
 */

import { Request, Response, Router } from 'express';
import { AuthService } from '../services/AuthService.js';
import { ConfigService } from '../services/ConfigService'; // 引入 ConfigService
import { DatabaseManager } from '../database';
import { MelodyAuthClient } from '../services/melodyAuthClient';
import { log, Modules } from '../logger';
import { body, validationResult } from 'express-validator';

const router = Router();
const dbManager = new DatabaseManager(); // 应该从DI容器获取，这里简化
const melodyAuthClient = new MelodyAuthClient('http://localhost:3001'); // 假设MelodyAuth运行在3001端口
const configService = new ConfigService(dbManager); // 实例化 ConfigService
const authService = new AuthService(dbManager, melodyAuthClient, configService);

/**
 * @description 用户注册API。
 * @description English: User registration API.
 * @route POST /api/auth/register
 * @param {string} req.body.username - 用户名。
 * @param {string} req.body.email - 电子邮件。
 * @param {string} req.body.password - 密码。
 * @returns {Response} 注册成功或失败的信息。
 */
router.post(
  '/register',
  [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log(
        'warn',
        Modules.AuthController,
        'Validation errors during registration.',
        { errors: errors.array() },
      );
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;
    try {
      const systemSettings = await configService.getSystemSettings();

      if (!systemSettings.isSystemInitialized) {
        log(
          'warn',
          Modules.AuthController,
          'Registration failed: System is not initialized.',
        );
        return res.status(403).json({
          message:
            'System is not initialized. Please initialize the system first.',
        });
      }

      if (!systemSettings.allowNewUserRegistration) {
        log(
          'warn',
          Modules.AuthController,
          'Registration failed: New user registration is disabled.',
        );
        return res
          .status(403)
          .json({ message: 'New user registration is currently disabled.' });
      }

      const result = await authService.register({ username, email, password });
      if (result.success) {
        return res.status(201).json({
          message: result.message,
          userProfile: result.userProfile,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      } else {
        return res.status(400).json({ message: result.message });
      }
    } catch (error: any) {
      log('error', Modules.AuthController, 'Error during user registration:', {
        username,
        error: error.message,
        stack: error.stack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during registration.' });
    }
  },
);

/**
 * @description 用户登录API。
 * @description English: User login API.
 * @route POST /api/auth/login
 * @param {string} req.body.username - 用户名。
 * @param {string} req.body.password - 密码。
 * @returns {Response} 登录成功或失败的信息。
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('warn', Modules.AuthController, 'Validation errors during login.', {
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;
    try {
      const result = await authService.login({ username, password });
      if (result.success) {
        return res.status(200).json({
          message: result.message,
          userProfile: result.userProfile,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      } else if (result.message === 'MFA required') {
        return res.status(401).json({
          message: 'MFA required',
          userId: result.userProfile?.userId,
        });
      } else {
        return res.status(401).json({ message: result.message });
      }
    } catch (error: any) {
      log('error', Modules.AuthController, 'Error during user login:', {
        username,
        error: error.message,
        stack: error.stack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during login.' });
    }
  },
);

/**
 * @description MFA验证API。
 * @description English: MFA verification API.
 * @route POST /api/auth/verify-mfa
 * @param {string} req.body.userId - 用户ID。
 * @param {string} req.body.token - MFA令牌。
 * @returns {Response} MFA验证成功或失败的信息。
 */
router.post(
  '/verify-mfa',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('token').notEmpty().withMessage('MFA token is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log(
        'warn',
        Modules.AuthController,
        'Validation errors during MFA verification.',
        { errors: errors.array() },
      );
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, token } = req.body;
    try {
      const result = await authService.verifyMfa(userId, token);
      if (result.success) {
        return res.status(200).json({
          message: result.message,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
      } else {
        return res.status(401).json({ message: result.message });
      }
    } catch (error: any) {
      log('error', Modules.AuthController, 'Error during MFA verification:', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during MFA verification.' });
    }
  },
);

// TODO: 添加其他认证/授权相关的API，例如：
// - GET /api/auth/profile
// - POST /api/auth/logout
// - POST /api/auth/refresh-token
// - POST /api/auth/enable-mfa
// - POST /api/auth/disable-mfa
// - GET /api/auth/permissions (根据设计考虑是否需要直接暴露)

export default router;
