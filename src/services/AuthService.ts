/**
 * @description AuthService 负责处理用户认证、注册、MFA、会话管理等业务逻辑。
 * @description English: AuthService is responsible for handling business logic related to user authentication, registration, MFA, and session management.
 */

import { DatabaseManager } from '../database';
import { log, Modules } from '../logger';
import { ConfigService } from './ConfigService';
import { JwtService } from './JwtService';
import { MfaService } from './MfaService';
import { PasswordService } from './PasswordService';
import { UserRole } from '../types/user';
import {
  LoginCredentials,
  RegisterData,
  PasswordResetRequest,
  PasswordResetConfirm,
  PasswordChangeRequest,
} from '../types/auth';
import {
  LoginRequestDTO,
  RegisterRequestDTO,
  AuthResultDTO,
  UserProfileDTO,
  ErrorHandler,
} from './auth/AuthTypes';
import { AuthCore } from './auth/AuthCore';
import { AuthMfa } from './auth/AuthMfa';
import { AuthPassword } from './auth/AuthPassword';

/**
 * 认证服务类
 * @class AuthService
 * @description 负责处理用户认证、注册、MFA、会话管理等业务逻辑
 */
export class AuthService {
  private dbManager: DatabaseManager;
  private configService: ConfigService;
  private jwtService: JwtService;
  private mfaService: MfaService;
  private passwordService: PasswordService;
  private authCore: AuthCore;
  private authMfa: AuthMfa;
  private authPassword: AuthPassword;

  constructor(
    dbManager: DatabaseManager,
    configService: ConfigService,
    jwtService?: JwtService,
    mfaService?: MfaService,
    passwordService?: PasswordService,
  ) {
    this.dbManager = dbManager;
    this.configService = configService;
    this.jwtService = jwtService || new JwtService();
    this.mfaService = mfaService || new MfaService();
    this.passwordService = passwordService || new PasswordService();

    // 创建错误处理函数
    const handleError: ErrorHandler = (error: unknown, context: string, additionalInfo?: Record<string, unknown>) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      log(
        'error',
        Modules.AuthService,
        `Error during ${context}:`,
        {
          error: errorMessage,
          stack: errorStack,
          ...additionalInfo,
        },
      );
    };

    // 初始化子模块
    this.authCore = new AuthCore(
      this.dbManager,
      this.jwtService,
      this.passwordService,
      this.configService,
      handleError,
    );

    this.authMfa = new AuthMfa(
      this.dbManager,
      this.jwtService,
      this.mfaService,
      this.passwordService,
      handleError,
    );

    this.authPassword = new AuthPassword(
      this.dbManager,
      this.jwtService,
      this.passwordService,
      handleError,
    );
  }

  /**
   * @description 根据ID获取用户
   * @param id 用户ID
   * @returns 用户信息
   */
  async getUserById(id: string) {
    return this.dbManager.users.getUserById(id);
  }

  /**
   * @description 统计管理员用户数量
   * @returns 管理员用户数量
   */
  async countAdminUsers(): Promise<number> {
    const allUsers = await this.dbManager.users.getAllUsers();
    return allUsers.filter((user) => user.role === 'admin').length;
  }

  /**
   * @description 根据用户名获取用户
   * @param username 用户名
   * @returns 用户信息
   */
  async getUserByUsername(username: string) {
    return this.dbManager.users.getUserByUsername(username);
  }

  /**
   * @description 更新用户角色
   * @param id 用户ID
   * @param role 新角色
   */
  async updateUserRole(id: string, role: UserRole): Promise<void> {
    await this.dbManager.users.updateUserRole(id, role);
  }

  /**
   * @description 从 JWT token 中获取用户个人资料
   * @param token JWT token
   * @returns 用户个人资料，如果无效则为 null
   */
  async getUserProfileFromToken(token: string): Promise<UserProfileDTO | null> {
    return this.authCore.getUserProfileFromToken(token);
  }

  /**
   * @description 用户登录
   * @param loginData 登录凭据
   * @returns 认证结果
   */
  async login(loginData: LoginRequestDTO | LoginCredentials): Promise<AuthResultDTO> {
    // 检查是否包含MFA码
    if ('mfaCode' in loginData && loginData.mfaCode) {
      return this.authMfa.verifyLoginWithMfa(loginData as { username: string; password: string; mfaCode: string });
    }
    
    // 普通登录
    const result = await this.authCore.login(loginData as LoginRequestDTO);
    
    // 如果需要MFA，返回相应结果
    if (!result.success && result.message === 'MFA required') {
      return result;
    }
    
    return result;
  }

  /**
   * @description 注册新用户
   * @param userData 用户注册数据
   * @returns 注册结果
   */
  async register(userData: RegisterRequestDTO | RegisterData): Promise<AuthResultDTO> {
    // 验证密码确认
    if ('confirmPassword' in userData && userData.password !== userData.confirmPassword) {
      return { success: false, message: 'Password confirmation does not match' };
    }
    
    return this.authCore.register(userData as RegisterRequestDTO);
  }

  /**
   * @description 验证MFA令牌
   * @param userId 用户ID
   * @param token MFA令牌
   * @returns 验证结果，如果成功则包含认证信息
   */
  async verifyMfa(userId: string, token: string): Promise<AuthResultDTO> {
    return this.authMfa.verifyMfa(userId, token);
  }

  /**
   * @description 刷新访问令牌
   * @param refreshToken 刷新令牌
   * @returns 刷新结果
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResultDTO> {
    return this.authCore.refreshAccessToken(refreshToken);
  }

  /**
   * @description 用户登出，撤销令牌
   * @param refreshToken 刷新令牌
   * @returns 登出结果
   */
  async logout(refreshToken: string): Promise<{ success: boolean; message: string }> {
    return this.authCore.logout(refreshToken);
  }

  /**
   * @description 获取用户个人资料
   * @param userId 用户ID
   * @returns 用户个人资料，如果未找到则返回null
   */
  async getUserProfile(userId: string): Promise<UserProfileDTO | null> {
    return this.authCore.getUserProfile(userId);
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
  ): Promise<{ success: boolean; message: string }> {
    return this.authPassword.changePassword(userId, passwordData);
  }

  /**
   * @description 请求密码重置
   * @param resetRequest 密码重置请求
   * @returns 请求结果
   */
  async requestPasswordReset(
    resetRequest: PasswordResetRequest
  ): Promise<{ success: boolean; message: string; resetToken?: string }> {
    return this.authPassword.requestPasswordReset(resetRequest);
  }

  /**
   * @description 重置密码
   * @param resetConfirm 密码重置确认
   * @returns 重置结果
   */
  async resetPassword(
    resetConfirm: PasswordResetConfirm
  ): Promise<{ success: boolean; message: string }> {
    return this.authPassword.resetPassword(resetConfirm);
  }

  /**
   * @description 检查用户是否具有特定权限
   * @param userId 用户ID
   * @param permission 要检查的权限
   * @returns 用户是否具有该权限
   */
  async checkPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user || !user.role) {
        return false;
      }
      const userRoles = [user.role];
      // 简单的权限检查：这里假设权限与角色直接对应，或者有更复杂的权限表
      return userRoles.includes(permission as UserRole);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      log(
        'error',
        Modules.AuthService,
        `Error checking permission '${permission}' for userId '${userId}':`,
        {
          userId,
          permission,
          error: errorMessage,
          stack: errorStack,
        },
      );
      return false;
    }
  }

  /**
   * @description 启用用户的MFA
   * @param userId 用户ID
   * @returns MFA启用结果，包含MFA密钥和二维码URL
   */
  async enableMfa(userId: string): Promise<{
    success: boolean;
    secret?: string;
    qrcodeUrl?: string;
    message?: string;
  }> {
    return this.authMfa.enableMfa(userId);
  }

  /**
   * @description 禁用用户的MFA
   * @param userId 用户ID
   * @returns 禁用是否成功
   */
  async disableMfa(userId: string): Promise<boolean> {
    return this.authMfa.disableMfa(userId);
  }

  /**
   * @description 验证访问令牌
   * @param token 访问令牌
   * @returns 验证结果
   */
  verifyAccessToken(token: string) {
    return this.authCore.verifyAccessToken(token);
  }

  /**
   * @description 检查密码强度
   * @param password 要检查的密码
   * @returns 密码强度检查结果
   */
  checkPasswordStrength(password: string) {
    return this.authPassword.checkPasswordStrength(password);
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
    return this.authPassword.generateRandomPassword(length, options);
  }
}
