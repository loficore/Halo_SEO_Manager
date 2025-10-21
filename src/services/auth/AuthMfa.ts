/**
 * @description 多因素认证功能模块
 * @fileoverview 提供MFA验证、启用和禁用等功能
 */

import crypto from 'crypto';
import { log, Modules } from '../../logger';
import { DatabaseManager } from '../../database';
import { JwtService } from '../JwtService';
import { MfaService } from '../MfaService';
import { PasswordService } from '../PasswordService';
import {
  AuthResultDTO,
  MfaEnableResult,
  ErrorHandler,
} from './AuthTypes';

/**
 * 多因素认证功能类
 * @class AuthMfa
 * @description 负责处理多因素认证相关的功能
 */
export class AuthMfa {
  private dbManager: DatabaseManager;
  private jwtService: JwtService;
  private mfaService: MfaService;
  private passwordService: PasswordService;
  private handleError: ErrorHandler;

  constructor(
    dbManager: DatabaseManager,
    jwtService: JwtService,
    mfaService: MfaService,
    passwordService: PasswordService,
    handleError: ErrorHandler,
  ) {
    this.dbManager = dbManager;
    this.jwtService = jwtService;
    this.mfaService = mfaService;
    this.passwordService = passwordService;
    this.handleError = handleError;
  }

  /**
   * @description 验证MFA令牌
   * @param userId 用户ID
   * @param token MFA令牌
   * @returns 验证结果，如果成功则包含认证信息
   */
  async verifyMfa(userId: string, token: string): Promise<AuthResultDTO> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user || !user.mfaSecret) {
        log(
          'warn',
          Modules.AuthService,
          `MFA verification failed: User '${userId}' not found or MFA not enabled.`,
          { userId },
        );
        return { success: false, message: 'MFA not enabled or invalid user.' };
      }

      const verified = this.mfaService.verifyToken(token, user.mfaSecret);

      if (verified) {
        log(
          'info',
          Modules.AuthService,
          `MFA for user '${userId}' verified successfully.`,
          { userId },
        );
        
        // MFA验证成功后，生成JWT令牌对
        const tokenPair = this.jwtService.generateTokenPair({
          userId: user.id,
          username: user.username,
          role: user.role,
        });

        // 存储刷新令牌到数据库
        await this.storeRefreshToken(user.id, tokenPair.refreshToken, tokenPair.refreshTokenExpiresAt);

        return {
          success: true,
          message: 'MFA verification and login successful',
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          userProfile: {
            userId: user.id,
            username: user.username,
            email: user.email || '',
            roles: [user.role],
          },
        };
      } else {
        log(
          'warn',
          Modules.AuthService,
          `MFA verification failed: Invalid token for user '${userId}'.`,
          { userId },
        );
        return { success: false, message: 'Invalid MFA token.' };
      }
    } catch (error: unknown) {
      this.handleError(error, 'verifyMfa', { userId });
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 验证包含MFA码的登录请求
   * @param loginData 包含MFA码的登录数据
   * @returns 验证结果
   */
  async verifyLoginWithMfa(loginData: { username: string; password: string; mfaCode: string }): Promise<AuthResultDTO> {
    try {
      // 1. 在本地数据库中查找用户
      const user = await this.dbManager.users.getUserByUsername(loginData.username);
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
      const isPasswordValid = await this.mfaService.verifyToken(
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

      // 3. 验证MFA码
      if (!user.mfaSecret) {
        return { success: false, message: 'MFA not enabled for this user.' };
      }

      const mfaResult = await this.mfaService.verifyMfa(
        loginData.mfaCode,
        user.mfaSecret,
      );
      
      if (!mfaResult.success) {
        log(
          'warn',
          Modules.AuthService,
          `MFA verification failed for user '${loginData.username}'.`,
          { username: loginData.username },
        );
        return { success: false, message: 'Invalid MFA code' };
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
        `User '${loginData.username}' logged in successfully with MFA.`,
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
      this.handleError(error, 'verifyLoginWithMfa', { username: loginData.username });
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 启用用户的MFA
   * @param userId 用户ID
   * @returns MFA启用结果，包含MFA密钥和二维码URL
   */
  async enableMfa(userId: string): Promise<MfaEnableResult> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found.' };
      }

      if (user.mfaSecret) {
        return {
          success: false,
          message: 'MFA already enabled for this user.',
        };
      }

      // 使用MfaService生成设置
      const mfaSetupData = await this.mfaService.setupMfa(user.username, user.email || '');

      await this.dbManager.users.updateUserMfaSecret(userId, mfaSetupData.secret);

      log('info', Modules.AuthService, `MFA enabled for user '${userId}'.`, {
        userId,
      });
      
      return { 
        success: true, 
        secret: mfaSetupData.secret, 
        qrcodeUrl: mfaSetupData.qrCodeUrl 
      };
    } catch (error: unknown) {
      this.handleError(error, 'enableMfa', { userId });
      return {
        success: false,
        message: 'An unexpected error occurred during MFA enablement.',
      };
    }
  }

  /**
   * @description 禁用用户的MFA
   * @param userId 用户ID
   * @returns 禁用是否成功
   */
  async disableMfa(userId: string): Promise<boolean> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        return false;
      }

      await this.dbManager.users.updateUserMfaSecret(userId, '');

      log('info', Modules.AuthService, `MFA disabled for user '${userId}'.`, {
        userId,
      });
      return true;
    } catch (error: unknown) {
      this.handleError(error, 'disableMfa', { userId });
      return false;
    }
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