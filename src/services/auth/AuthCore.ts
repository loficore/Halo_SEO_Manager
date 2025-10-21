/**
 * @description 认证核心功能模块
 * @fileoverview 提供用户登录、注册、令牌刷新和登出等核心认证功能
 */

import crypto from 'crypto';
import { log, Modules } from '../../logger';
import { DatabaseManager } from '../../database';
import { JwtService } from '../JwtService';
import { PasswordService } from '../PasswordService';
import { ConfigService } from '../ConfigService';
import { UserRole } from '../../types/user';
import { AccessTokenPayload, RefreshTokenPayload } from '../../types/token';
import {
  LoginRequestDTO,
  RegisterRequestDTO,
  AuthResultDTO,
  UserProfileDTO,
  CommonAuthResult,
  ErrorHandler,
} from './AuthTypes';

/**
 * 认证核心功能类
 * @class AuthCore
 * @description 负责处理用户认证的核心功能，包括登录、注册、令牌刷新和登出
 */
export class AuthCore {
  private dbManager: DatabaseManager;
  private jwtService: JwtService;
  private passwordService: PasswordService;
  private configService: ConfigService;
  private handleError: ErrorHandler;

  constructor(
    dbManager: DatabaseManager,
    jwtService: JwtService,
    passwordService: PasswordService,
    configService: ConfigService,
    handleError: ErrorHandler,
  ) {
    this.dbManager = dbManager;
    this.jwtService = jwtService;
    this.passwordService = passwordService;
    this.configService = configService;
    this.handleError = handleError;
  }

  /**
   * @description 从 JWT token 中获取用户个人资料
   * @param token JWT token
   * @returns 用户个人资料，如果无效则为 null
   */
  async getUserProfileFromToken(token: string): Promise<UserProfileDTO | null> {
    try {
      const verificationResult = this.jwtService.verifyAccessToken(token);
      
      if (!verificationResult.valid || !verificationResult.payload) {
        return null;
      }

      const payload = verificationResult.payload as AccessTokenPayload;
      const user = await this.dbManager.users.getUserById(payload.userId);
      
      if (user) {
        return {
          userId: user.id,
          username: user.username,
          email: user.email || '',
          roles: [user.role],
        };
      }
      return null;
    } catch (error: unknown) {
      this.handleError(error, 'getUserProfileFromToken');
      return null;
    }
  }

  /**
   * @description 用户登录
   * @param loginData 登录凭据
   * @returns 认证结果
   */
  async login(loginData: LoginRequestDTO): Promise<AuthResultDTO> {
    try {
      // 1. 在本地数据库中查找用户
      const user = await this.dbManager.users.getUserByUsername(
        loginData.username,
      );
      if (!user) {
        log(
          'warn',
          Modules.AuthService,
          `Login failed: User '${loginData.username}' not found locally.`,
          { username: loginData.username },
        );
        return { success: false, message: 'Invalid credentials' };
      }

      // 2. 验证密码
      const isPasswordValid = await this.passwordService.verifyPassword(
        loginData.password,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        log(
          'warn',
          Modules.AuthService,
          `Login failed: Invalid password for user '${loginData.username}'.`,
          { username: loginData.username },
        );
        return { success: false, message: 'Invalid credentials' };
      }

      // 3. 如果有MFA，返回需要MFA验证的信号
      if (user.mfaSecret) {
        return { success: false, message: 'MFA required' };
      }

      // 4. 生成JWT令牌对
      const tokenPair = this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // 5. 存储刷新令牌到数据库
      await this.storeRefreshToken(user.id, tokenPair.refreshToken, tokenPair.refreshTokenExpiresAt);

      log(
        'info',
        Modules.AuthService,
        `User '${loginData.username}' logged in successfully.`,
        { userId: user.id },
      );
      
      return {
        success: true,
        message: 'Login successful',
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        userProfile: {
          userId: user.id,
          username: user.username,
          email: user.email || '',
          roles: [user.role],
        },
      };
    } catch (error: unknown) {
      this.handleError(error, 'login', { username: loginData.username });
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 注册新用户
   * @param userData 用户注册数据
   * @returns 注册结果
   */
  async register(userData: RegisterRequestDTO): Promise<AuthResultDTO> {
    try {
      // 1. 检查系统初始化状态和用户注册设置
      const systemSettings = await this.configService.getSystemSettings();
      if (!systemSettings.isSystemInitialized) {
        log(
          'warn',
          Modules.AuthService,
          'Registration failed: System is not initialized.',
          { username: userData.username },
        );
        return {
          success: false,
          message:
            'System is not initialized. Please initialize the system first.',
        };
      }
      if (!systemSettings.allowNewUserRegistration) {
        log(
          'warn',
          Modules.AuthService,
          'Registration failed: New user registration is disabled.',
          { username: userData.username },
        );
        return {
          success: false,
          message: 'New user registration is currently disabled.',
        };
      }

      // 2. 检查用户是否已存在
      const existingUser = await this.dbManager.users.getUserByUsername(
        userData.username,
      );
      if (existingUser) {
        log(
          'warn',
          Modules.AuthService,
          `Registration failed: User '${userData.username}' already exists.`,
          { username: userData.username },
        );
        return { success: false, message: 'User already exists' };
      }

      // 3. 检查密码强度
      const passwordStrength = this.passwordService.checkPasswordStrength(userData.password);
      if (passwordStrength.level === 'weak') {
        return { 
          success: false, 
          message: 'Password is too weak. Please choose a stronger password.' 
        };
      }

      // 4. 哈希密码
      const hashedPassword = await this.passwordService.hashPassword(userData.password);

      // 5. 在本地数据库中创建用户
      const newUserId = `user_${Date.now()}`;
      await this.dbManager.users.createUser({
        id: newUserId,
        username: userData.username,
        email: userData.email,
        password_hash: hashedPassword,
        mfa_secret: '',
        role: UserRole.USER,
      });

      log(
        'info',
        Modules.AuthService,
        `User '${userData.username}' registered successfully.`,
        { userId: newUserId },
      );

      // 6. 注册成功后尝试登录，获取token
      return await this.login({
        username: userData.username,
        password: userData.password,
      });
    } catch (error: unknown) {
      this.handleError(error, 'register', { username: userData.username });
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @returns 刷新结果
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResultDTO> {
    try {
      // 1. 验证刷新令牌
      const verificationResult = this.jwtService.verifyRefreshToken(refreshToken);
      if (!verificationResult.valid || !verificationResult.payload) {
        log(
          'warn',
          Modules.AuthService,
          `Token refresh failed: Invalid refresh token.`,
        );
        return { success: false, message: 'Invalid refresh token' };
      }

      const payload = verificationResult.payload as RefreshTokenPayload;
      const userId = payload.userId;

      // 2. 检查令牌是否在数据库中存在且有效
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const tokenRecord = await this.dbManager.refreshTokens.getRefreshTokenByHash(tokenHash);
      
      if (!tokenRecord || tokenRecord.is_revoked) {
        log(
          'warn',
          Modules.AuthService,
          `Token refresh failed: Refresh token not found or revoked for user '${userId}'.`,
          { userId },
        );
        return { success: false, message: 'Invalid refresh token' };
      }

      // 3. 获取用户信息
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        log(
          'warn',
          Modules.AuthService,
          `Token refresh failed: User '${userId}' not found.`,
          { userId },
        );
        return { success: false, message: 'User not found' };
      }

      // 4. 生成新的令牌对
      const newTokenPair = this.jwtService.generateTokenPair({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      // 5. 撤销旧的刷新令牌
      await this.dbManager.refreshTokens.revokeRefreshTokenByHash(
        tokenHash,
        'Token refresh'
      );

      // 6. 存储新的刷新令牌
      await this.storeRefreshToken(user.id, newTokenPair.refreshToken, newTokenPair.refreshTokenExpiresAt);

      log(
        'info',
        Modules.AuthService,
        `Token refreshed successfully for user '${user.username}'.`,
        { userId: user.id },
      );

      return {
        success: true,
        message: 'Token refreshed successfully',
        accessToken: newTokenPair.accessToken,
        refreshToken: newTokenPair.refreshToken,
        userProfile: {
          userId: user.id,
          username: user.username,
          email: user.email || '',
          roles: [user.role],
        },
      };
    } catch (error: unknown) {
      this.handleError(error, 'refreshAccessToken');
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 用户登出，撤销令牌
   * @param refreshToken 刷新令牌
   * @returns 登出结果
   */
  async logout(refreshToken: string): Promise<CommonAuthResult> {
    try {
      // 1. 验证刷新令牌
      const verificationResult = this.jwtService.verifyRefreshToken(refreshToken);
      if (!verificationResult.valid || !verificationResult.payload) {
        return { success: false, message: 'Invalid refresh token' };
      }

      const payload = verificationResult.payload as RefreshTokenPayload;
      const userId = payload.userId;

      // 2. 撤销刷新令牌
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.dbManager.refreshTokens.revokeRefreshTokenByHash(
        tokenHash,
        'User logout'
      );

      log(
        'info',
        Modules.AuthService,
        `User logged out successfully.`,
        { userId },
      );

      return { success: true, message: 'Logout successful' };
    } catch (error: unknown) {
      this.handleError(error, 'logout');
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 获取用户个人资料
   * @param userId 用户ID
   * @returns 用户个人资料，如果未找到则返回null
   */
  async getUserProfile(userId: string): Promise<UserProfileDTO | null> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (user) {
        return {
          userId: user.id,
          username: user.username,
          email: user.email || '',
          roles: [user.role],
        };
      }
      return null;
    } catch (error: unknown) {
      this.handleError(error, 'getUserProfile', { userId });
      return null;
    }
  }

  /**
   * @description 验证访问令牌
   * @param token 访问令牌
   * @returns 验证结果
   */
  verifyAccessToken(token: string) {
    return this.jwtService.verifyAccessToken(token);
  }

  /**
   * @description 存储刷新令牌到数据库
   * @param userId 用户ID
   * @param refreshToken 刷新令牌
   * @param expiresAt 过期时间
   */
  private async storeRefreshToken(userId: string, refreshToken: string, expiresAt: number): Promise<void> {
    const tokenId = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAtDate = new Date(expiresAt * 1000);

    await this.dbManager.refreshTokens.createRefreshToken({
      id: tokenId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAtDate,
    });
  }
}