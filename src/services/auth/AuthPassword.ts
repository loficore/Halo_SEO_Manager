/**
 * @description 密码管理功能模块
 * @fileoverview 提供密码更改、重置和强度检查等功能
 */

import { log, Modules } from '../../logger';
import { DatabaseManager } from '../../database';
import { JwtService } from '../JwtService';
import { PasswordService } from '../PasswordService';
import { TempTokenPayload } from '../../types/token';
import {
  PasswordChangeRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  CommonAuthResult,
  PasswordResetResult,
  ErrorHandler,
} from './AuthTypes';

/**
 * 密码管理功能类
 * @class AuthPassword
 * @description 负责处理密码相关的功能，包括更改、重置和强度检查
 */
export class AuthPassword {
  private dbManager: DatabaseManager;
  private jwtService: JwtService;
  private passwordService: PasswordService;
  private handleError: ErrorHandler;

  constructor(
    dbManager: DatabaseManager,
    jwtService: JwtService,
    passwordService: PasswordService,
    handleError: ErrorHandler,
  ) {
    this.dbManager = dbManager;
    this.jwtService = jwtService;
    this.passwordService = passwordService;
    this.handleError = handleError;
  }

  /**
   * @description 更改密码
   * @param userId 用户ID
   * @param passwordData 密码更改数据
   * @returns 更改结果
   */
  async changePassword(
    userId: string,
    passwordData: PasswordChangeRequest
  ): Promise<CommonAuthResult> {
    try {
      // 1. 获取用户信息
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // 2. 验证当前密码
      const isCurrentPasswordValid = await this.passwordService.verifyPassword(
        passwordData.currentPassword,
        user.passwordHash
      );
      if (!isCurrentPasswordValid) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // 3. 验证新密码确认
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        return { success: false, message: 'Password confirmation does not match' };
      }

      // 4. 检查新密码强度
      const passwordStrength = this.passwordService.checkPasswordStrength(passwordData.newPassword);
      if (passwordStrength.level === 'weak') {
        return { 
          success: false, 
          message: 'New password is too weak. Please choose a stronger password.' 
        };
      }

      // 5. 哈希新密码
      const hashedNewPassword = await this.passwordService.hashPassword(passwordData.newPassword);

      // 6. 更新密码
      await this.dbManager.users.updateUserPassword(userId, hashedNewPassword);

      // 7. 撤销所有刷新令牌（强制重新登录）
      await this.dbManager.refreshTokens.revokeAllRefreshTokensByUserId(
        userId,
        'Password change'
      );

      log(
        'info',
        Modules.AuthService,
        `Password changed successfully for user '${user.username}'.`,
        { userId },
      );

      return { success: true, message: 'Password changed successfully' };
    } catch (error: unknown) {
      this.handleError(error, 'changePassword', { userId });
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 请求密码重置
   * @param resetRequest 密码重置请求
   * @returns 请求结果
   */
  async requestPasswordReset(
    resetRequest: PasswordResetRequest
  ): Promise<PasswordResetResult> {
    try {
      // 1. 查找用户（通过用户名或邮箱）
      let user = await this.dbManager.users.getUserByUsername(resetRequest.identifier);
      if (!user) {
        // 尝试通过邮箱查找
        const allUsers = await this.dbManager.users.getAllUsers();
        user = allUsers.find(u => u.email === resetRequest.identifier);
      }

      if (!user) {
        // 为了安全，即使用户不存在也返回成功
        return { success: true, message: 'If the account exists, a reset token has been sent.' };
      }

      // 2. 生成临时重置令牌
      const resetToken = this.jwtService.generateTempToken(user.id);

      log(
        'info',
        Modules.AuthService,
        `Password reset requested for user '${user.username}'.`,
        { userId: user.id },
      );

      // 在实际应用中，这里应该发送邮件或短信
      // 目前只返回令牌用于测试
      return { 
        success: true, 
        message: 'If the account exists, a reset token has been sent.',
        resetToken 
      };
    } catch (error: unknown) {
      this.handleError(error, 'requestPasswordReset', { identifier: resetRequest.identifier });
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 重置密码
   * @param resetConfirm 密码重置确认
   * @returns 重置结果
   */
  async resetPassword(
    resetConfirm: PasswordResetConfirm
  ): Promise<CommonAuthResult> {
    try {
      // 1. 验证重置令牌
      const verificationResult = this.jwtService.verifyTempToken(resetConfirm.token);
      if (!verificationResult.valid || !verificationResult.payload) {
        return { success: false, message: 'Invalid or expired reset token' };
      }

      const payload = verificationResult.payload as TempTokenPayload;
      const userId = payload.userId;

      // 2. 获取用户信息
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // 3. 验证新密码确认
      if (resetConfirm.newPassword !== resetConfirm.confirmPassword) {
        return { success: false, message: 'Password confirmation does not match' };
      }

      // 4. 检查新密码强度
      const passwordStrength = this.passwordService.checkPasswordStrength(resetConfirm.newPassword);
      if (passwordStrength.level === 'weak') {
        return { 
          success: false, 
          message: 'New password is too weak. Please choose a stronger password.' 
        };
      }

      // 5. 哈希新密码
      const hashedNewPassword = await this.passwordService.hashPassword(resetConfirm.newPassword);

      // 6. 更新密码
      await this.dbManager.users.updateUserPassword(userId, hashedNewPassword);

      // 7. 撤销所有刷新令牌（强制重新登录）
      await this.dbManager.refreshTokens.revokeAllRefreshTokensByUserId(
        userId,
        'Password reset'
      );

      // 8. 撤销重置令牌
      this.jwtService.revokeToken(payload.jti);

      log(
        'info',
        Modules.AuthService,
        `Password reset successfully for user '${user.username}'.`,
        { userId },
      );

      return { success: true, message: 'Password reset successfully' };
    } catch (error: unknown) {
      this.handleError(error, 'resetPassword');
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 验证密码强度
   * @param password 要验证的密码
   * @returns 密码强度检查结果
   */
  checkPasswordStrength(password: string) {
    return this.passwordService.checkPasswordStrength(password);
  }

  /**
   * @description 生成随机密码
   * @param length 密码长度
   * @param options 密码生成选项
   * @returns 生成的随机密码
   */
  generateRandomPassword(
    length?: number,
    options?: {
      includeUppercase?: boolean;
      includeLowercase?: boolean;
      includeNumbers?: boolean;
      includeSpecialChars?: boolean;
    }
  ) {
    return this.passwordService.generateRandomPassword(length, options);
  }
}