/**
 * @description authController 模块处理与用户认证和授权相关的API请求。
 * @description English: The authController module handles API requests related to user authentication and authorization.
 */

import { Request, Response, Router } from 'express';
import { AuthService } from '../services/AuthService.js';
import { ConfigService } from '../services/ConfigService'; // 引入 ConfigService
import { JwtService } from '../services/JwtService';
import { MfaService } from '../services/MfaService';
import { PasswordService } from '../services/PasswordService';
import { DatabaseManager } from '../database';
import { log, Modules } from '../logger';
import { body, validationResult } from 'express-validator';

// 创建服务实例（在实际应用中应该使用依赖注入容器）
let authService: AuthService;
let configService: ConfigService;

/**
 * @description 初始化认证控制器
 * @param {DatabaseManager} dbManager - 数据库管理器实例
 * @returns {Router} Express 路由器实例
 */
export function createAuthController(dbManager: DatabaseManager): Router {
  const router = Router();
  
  // 初始化服务
  configService = new ConfigService(dbManager);
  const jwtService = new JwtService();
  const mfaService = new MfaService();
  const passwordService = new PasswordService();
  
  // 创建新的认证服务实例，不再依赖 MelodyAuthClient
  authService = new AuthService(
    dbManager,
    configService,
    jwtService,
    mfaService,
    passwordService
  );
  
  return router;
}

// 为了向后兼容，保留默认路由器实例
const router = Router();
const dbManager = new DatabaseManager(); // 应该从DI容器获取，这里简化
configService = new ConfigService(dbManager); // 实例化 ConfigService
const jwtService = new JwtService();
const mfaService = new MfaService();
const passwordService = new PasswordService();
authService = new AuthService(
  dbManager,
  configService,
  jwtService,
  mfaService,
  passwordService
);

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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during user registration:', {
        username,
        error: errorMessage,
        stack: errorStack,
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during user login:', {
        username,
        error: errorMessage,
        stack: errorStack,
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
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during MFA verification:', {
        userId,
        error: errorMessage,
        stack: errorStack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during MFA verification.' });
    }
  },
);

/**
 * @description 刷新访问令牌API。
 * @description English: Refresh access token API.
 * @route POST /api/auth/refresh-token
 * @param {string} req.body.refreshToken - 刷新令牌。
 * @returns {Response} 刷新成功或失败的信息。
 */
router.post(
  '/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('warn', Modules.AuthController, 'Validation errors during token refresh.', {
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const { refreshToken } = req.body;
    try {
      const result = await authService.refreshAccessToken(refreshToken);
      if (result.success) {
        return res.status(200).json({
          message: result.message,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          userProfile: result.userProfile,
        });
      } else {
        return res.status(401).json({ message: result.message });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during token refresh:', {
        error: errorMessage,
        stack: errorStack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during token refresh.' });
    }
  },
);

/**
 * @description 用户登出API。
 * @description English: User logout API.
 * @route POST /api/auth/logout
 * @param {string} req.body.refreshToken - 刷新令牌。
 * @returns {Response} 登出成功或失败的信息。
 */
router.post(
  '/logout',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('warn', Modules.AuthController, 'Validation errors during logout.', {
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const { refreshToken } = req.body;
    try {
      const result = await authService.logout(refreshToken);
      if (result.success) {
        return res.status(200).json({ message: result.message });
      } else {
        return res.status(400).json({ message: result.message });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during logout:', {
        error: errorMessage,
        stack: errorStack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during logout.' });
    }
  },
);

/**
 * @description 获取用户个人资料API。
 * @description English: Get user profile API.
 * @route GET /api/auth/profile
 * @returns {Response} 用户个人资料或错误信息。
 */
router.get('/profile', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.substring(7);
  try {
    const userProfile = await authService.getUserProfileFromToken(token);
    if (userProfile) {
      return res.status(200).json({ userProfile });
    } else {
      return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log('error', Modules.AuthController, 'Error getting user profile:', {
      error: errorMessage,
      stack: errorStack,
    });
    return res
      .status(500)
      .json({ message: 'Internal server error while fetching user profile.' });
  }
});

/**
 * @description 请求密码重置API。
 * @description English: Request password reset API.
 * @route POST /api/auth/request-password-reset
 * @param {string} req.body.identifier - 用户邮箱或用户名。
 * @returns {Response} 密码重置请求结果。
 */
router.post(
  '/request-password-reset',
  [
    body('identifier').notEmpty().withMessage('Identifier (email or username) is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('warn', Modules.AuthController, 'Validation errors during password reset request.', {
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier } = req.body;
    try {
      const result = await authService.requestPasswordReset({ identifier });
      if (result.success) {
        return res.status(200).json({
          message: result.message,
          // 在生产环境中，不应暴露重置令牌
          ...(process.env.NODE_ENV === 'development' && { resetToken: result.resetToken }),
        });
      } else {
        return res.status(400).json({ message: result.message });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during password reset request:', {
        identifier,
        error: errorMessage,
        stack: errorStack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during password reset request.' });
    }
  },
);

/**
 * @description 重置密码API。
 * @description English: Reset password API.
 * @route POST /api/auth/reset-password
 * @param {string} req.body.token - 重置令牌。
 * @param {string} req.body.newPassword - 新密码。
 * @param {string} req.body.confirmPassword - 确认新密码。
 * @returns {Response} 密码重置结果。
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('confirmPassword').custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('warn', Modules.AuthController, 'Validation errors during password reset.', {
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword, confirmPassword } = req.body;
    try {
      const result = await authService.resetPassword({
        token,
        newPassword,
        confirmPassword,
      });
      if (result.success) {
        return res.status(200).json({ message: result.message });
      } else {
        return res.status(400).json({ message: result.message });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error during password reset:', {
        error: errorMessage,
        stack: errorStack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error during password reset.' });
    }
  },
);

/**
 * @description 启用多因素认证API。
 * @description English: Enable MFA API.
 * @route POST /api/auth/enable-mfa
 * @returns {Response} MFA启用结果。
 */
router.post('/enable-mfa', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided.' });
  }

  const token = authHeader.substring(7);
  try {
    const userProfile = await authService.getUserProfileFromToken(token);
    if (!userProfile) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }

    const result = await authService.enableMfa(userProfile.userId);
    if (result.success) {
      return res.status(200).json({
        message: 'MFA setup initiated successfully',
        secret: result.secret,
        qrcodeUrl: result.qrcodeUrl,
      });
    } else {
      return res.status(400).json({ message: result.message });
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log('error', Modules.AuthController, 'Error enabling MFA:', {
      error: errorMessage,
      stack: errorStack,
    });
    return res
      .status(500)
      .json({ message: 'Internal server error while enabling MFA.' });
  }
});

/**
 * @description 禁用多因素认证API。
 * @description English: Disable MFA API.
 * @route POST /api/auth/disable-mfa
 * @param {string} req.body.password - 用户密码。
 * @returns {Response} MFA禁用结果。
 */
router.post(
  '/disable-mfa',
  [
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log('warn', Modules.AuthController, 'Validation errors during MFA disable.', {
        errors: errors.array(),
      });
      return res.status(400).json({ errors: errors.array() });
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    const token = authHeader.substring(7);
    const { password } = req.body;

    try {
      const userProfile = await authService.getUserProfileFromToken(token);
      if (!userProfile) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
      }

      // 验证密码
      const user = await authService.getUserById(userProfile.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      const isPasswordValid = await authService['passwordService'].verifyPassword(
        password,
        user.passwordHash
      );
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid password.' });
      }

      const result = await authService.disableMfa(userProfile.userId);
      if (result) {
        return res.status(200).json({ message: 'MFA disabled successfully.' });
      } else {
        return res.status(400).json({ message: 'Failed to disable MFA.' });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      log('error', Modules.AuthController, 'Error disabling MFA:', {
        error: errorMessage,
        stack: errorStack,
      });
      return res
        .status(500)
        .json({ message: 'Internal server error while disabling MFA.' });
    }
  },
);

export default router;
