/**
 * @description AuthService 负责处理用户认证、注册、MFA、会话管理等业务逻辑。
 * @description English: AuthService is responsible for handling business logic related to user authentication, registration, MFA, and session management.
 */

import { DatabaseManager } from '../database';
import { MelodyAuthClient } from './melodyAuthClient.js';
import { log, Modules } from '../logger';
import { ConfigService } from './ConfigService'; // 导入 ConfigService
import { UserRole } from '../types/user'; // 导入 UserRole
import * as bcrypt from 'bcrypt'; // For password hashing
import * as speakeasy from 'speakeasy'; // For MFA

// DTOs (假设在 src/types/auth.ts 中定义)
interface LoginRequestDTO {
  username: string;
  password: string; // 更改为 password
}

interface RegisterRequestDTO {
  username: string;
  password: string; // 更改为 password
  email: string;
}

interface AuthResultDTO {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  userProfile?: UserProfileDTO;
}

interface UserProfileDTO {
  userId: string;
  username: string;
  email: string;
  roles: string[];
}

// DTOs for JWT token payload (minimal)
export interface JwtPayload {
  userId: string;
  role: UserRole;
  exp?: number; // Expiration time
  iat?: number; // Issued at time
}

export class AuthService {
  private dbManager: DatabaseManager;
  private melodyAuthClient: MelodyAuthClient;
  private configService: ConfigService; // 声明 ConfigService 实例

  constructor(
    dbManager: DatabaseManager,
    melodyAuthClient: MelodyAuthClient,
    configService: ConfigService,
  ) {
    this.dbManager = dbManager;
    this.melodyAuthClient = melodyAuthClient;
    this.configService = configService; // 注入 ConfigService
  }

  // Add getUserById method
  async getUserById(id: string) {
    return this.dbManager.users.getUserById(id);
  }

  // 添加 countAdminUsers 方法
  async countAdminUsers(): Promise<number> {
    // Assuming a method to count admin users exists in UserTable
    // If not, this logic might need to be implemented here or in UserTable
    const allUsers = await this.dbManager.users.getAllUsers();
    return allUsers.filter((user) => user.role === 'admin').length;
  }

  // 添加 getUserByUsername 方法
  async getUserByUsername(username: string) {
    return this.dbManager.users.getUserByUsername(username);
  }

  // 添加 updateUserRole 方法
  async updateUserRole(id: string, role: UserRole): Promise<void> {
    await this.dbManager.users.updateUserRole(id, role);
  }

  /**
   * @description 从 JWT token 中获取用户个人资料。此方法通常需要解析和验证 JWT。
   * @description English: Get user profile from JWT token. This method typically requires parsing and validating the JWT.
   * @param {string} token - JWT token。
   * @returns {Promise<UserProfileDTO | null>} 用户个人资料，如果无效则为 null。
   */
  async getUserProfileFromToken(token: string): Promise<UserProfileDTO | null> {
    try {
      // TODO: 这里需要集成实际的 JWT 验证库 (例如 jsonwebtoken)
      // 暂时模拟一个验证逻辑
      // 真实场景中，会调用 melodyAuthClient.verifyToken(token) 或使用 JWT 库

      // 临时模拟：假设 token 是一个 Base64 编码的 JSON 字符串，包含 userId 和 role
      // 这是一个非常简化的模拟，实际应用中会更复杂
      const decodedPayload = await this.melodyAuthClient.verifyToken(token);

      if (decodedPayload && decodedPayload.userId && decodedPayload.role) {
        const user = await this.dbManager.users.getUserById(
          decodedPayload.userId,
        );
        if (user) {
          return {
            userId: user.id,
            username: user.username,
            email: user.email || '',
            roles: [user.role],
          };
        }
      }
      return null;
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error getting user profile from token:`,
        {
          error: error.message,
          stack: error.stack,
        },
      );
      return null;
    }
  }

  /**
   * @description 用户登录。
   * @description English: User login.
   * @param {LoginRequestDTO} loginData - 登录凭据。
   * @returns {Promise<AuthResultDTO>} 认证结果。
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
      const isPasswordValid = await bcrypt.compare(
        loginData.password,
        user.passwordHash,
      ); // 更改为 password 和 passwordHash
      if (!isPasswordValid) {
        log(
          'warn',
          Modules.AuthService,
          `Login failed: Invalid password for user '${loginData.username}'.`,
          { username: loginData.username },
        );
        return { success: false, message: 'Invalid credentials' };
      }

      // 3. 如果有MFA，需要进行MFA验证
      if (user.mfaSecret) {
        // 更改为 mfaSecret
        // 返回需要MFA验证的信号
        return { success: false, message: 'MFA required' };
      }

      // 4. 调用MelodyAuth进行最终认证 (获取JWT等)
      const authResponse = await this.melodyAuthClient.authenticate({
        username: loginData.username,
        password: loginData.password, // 理论上这里应该传递哈希前的密码或者由客户端直接与MelodyAuth交互
      });

      if (authResponse && authResponse.accessToken) {
        log(
          'info',
          Modules.AuthService,
          `User '${loginData.username}' logged in successfully.`,
          { userId: user.id },
        ); // 更改为 user.id
        return {
          success: true,
          message: 'Login successful',
          accessToken: authResponse.accessToken,
          refreshToken: authResponse.refreshToken,
          userProfile: {
            userId: user.id, // 更改为 user.id
            username: user.username,
            email: user.email || '', // 确保 email 为 string
            roles: [user.role], // 更改为 [user.role]
          },
        };
      } else {
        log(
          'error',
          Modules.AuthService,
          `MelodyAuth authentication failed for user '${loginData.username}'.`,
          { username: loginData.username, melodyAuthResponse: authResponse },
        );
        return {
          success: false,
          message: 'Authentication failed with external service.',
        };
      }
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error during login for user '${loginData.username}':`,
        {
          username: loginData.username,
          error: error.message,
          stack: error.stack,
        },
      );
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 注册新用户。
   * @description English: Register a new user.
   * @param {RegisterRequestDTO} userData - 用户注册数据。
   * @returns {Promise<AuthResultDTO>} 注册结果。
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

      // 2. 哈希密码
      const hashedPassword = await bcrypt.hash(userData.password, 10); // 更改为 userData.password

      // 3. 在本地数据库中创建用户
      const newUserId = `user_${Date.now()}`; // 简单的用户ID生成
      await this.dbManager.users.createUser({
        id: newUserId,
        username: userData.username,
        email: userData.email,
        password_hash: hashedPassword,
        mfa_secret: '', // Provide an empty string or null as per schema
        role: UserRole.USER,
      });

      // 4. 调用MelodyAuth进行用户注册
      const melodyAuthRegisterResponse =
        await this.melodyAuthClient.registerUser({
          username: userData.username,
          email: userData.email,
          password: userData.password, // 更改为 userData.password
        });

      if (melodyAuthRegisterResponse && melodyAuthRegisterResponse.success) {
        log(
          'info',
          Modules.AuthService,
          `User '${userData.username}' registered successfully.`,
          { userId: newUserId },
        );
        // 注册成功后尝试登录，获取token
        return await this.login({
          username: userData.username,
          password: userData.password,
        }); // 更改为 password
      } else {
        log(
          'error',
          Modules.AuthService,
          `MelodyAuth registration failed for user '${userData.username}'.`,
          {
            username: userData.username,
            melodyAuthResponse: melodyAuthRegisterResponse,
          },
        );
        // 如果MelodyAuth注册失败，考虑回滚本地数据库的用户创建
        await this.dbManager.users.deleteUser(newUserId);
        return {
          success: false,
          message: 'Registration failed with external service.',
        };
      }
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error during registration for user '${userData.username}':`,
        {
          username: userData.username,
          error: error.message,
          stack: error.stack,
        },
      );
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 验证MFA令牌。
   * @description English: Verify MFA token.
   * @param {string} userId - 用户ID。
   * @param {string} token - MFA令牌。
   * @returns {Promise<AuthResultDTO>} 验证结果，如果成功则包含认证信息。
   */
  async verifyMfa(userId: string, token: string): Promise<AuthResultDTO> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user || !user.mfaSecret) {
        // 更改为 mfaSecret
        log(
          'warn',
          Modules.AuthService,
          `MFA verification failed: User '${userId}' not found or MFA not enabled.`,
          { userId },
        );
        return { success: false, message: 'MFA not enabled or invalid user.' };
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret, // 更改为 mfaSecret
        encoding: 'base32',
        token: token,
      });

      if (verified) {
        log(
          'info',
          Modules.AuthService,
          `MFA for user '${userId}' verified successfully.`,
          { userId },
        );
        // MFA验证成功后，再次调用MelodyAuth进行最终认证 (获取JWT等)
        // 注意：这里需要一个机制来获取用户的密码或者一个MFA专用的token
        // 暂时假设authenticate方法可以处理MFA验证后的特殊情况
        const authResponse = await this.melodyAuthClient.authenticate({
          username: user.username,
          mfa_token: token, // 传递MFA token
        });

        if (authResponse && authResponse.accessToken) {
          return {
            success: true,
            message: 'MFA verification and login successful',
            accessToken: authResponse.accessToken,
            refreshToken: authResponse.refreshToken,
            userProfile: {
              userId: user.id, // 更改为 user.id
              username: user.username,
              email: user.email || '', // 确保 email 为 string
              roles: [user.role], // 更改为 [user.role]
            },
          };
        } else {
          log(
            'error',
            Modules.AuthService,
            `MelodyAuth authentication failed after MFA for user '${userId}'.`,
            { userId, melodyAuthResponse: authResponse },
          );
          return {
            success: false,
            message: 'Authentication failed with external service after MFA.',
          };
        }
      } else {
        log(
          'warn',
          Modules.AuthService,
          `MFA verification failed: Invalid token for user '${userId}'.`,
          { userId },
        );
        return { success: false, message: 'Invalid MFA token.' };
      }
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error during MFA verification for user '${userId}':`,
        {
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      return { success: false, message: 'An unexpected error occurred.' };
    }
  }

  /**
   * @description 获取用户个人资料。
   * @description English: Get user profile.
   * @param {string} userId - 用户ID。
   * @returns {Promise<UserProfileDTO | null>} 用户个人资料，如果未找到则返回null。
   */
  async getUserProfile(userId: string): Promise<UserProfileDTO | null> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (user) {
        return {
          userId: user.id, // 更改为 user.id
          username: user.username,
          email: user.email || '', // 确保 email 为 string
          roles: [user.role], // 更改为 [user.role]
        };
      }
      return null;
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error getting user profile for userId '${userId}':`,
        {
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      return null;
    }
  }

  /**
   * @description 检查用户是否具有特定权限。
   * @description English: Check if a user has a specific permission.
   * @param {string} userId - 用户ID。
   * @param {string} permission - 要检查的权限。
   * @returns {Promise<boolean>} 用户是否具有该权限。
   */
  async checkPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user || !user.role) {
        // 更改为 user.role
        return false;
      }
      const userRoles = [user.role]; // 更改为 [user.role]
      // 简单的权限检查：这里假设权限与角色直接对应，或者有更复杂的权限表
      // 在实际应用中，这里会根据权限设计进行更复杂的逻辑判断
      return userRoles.includes(permission as UserRole); // 将 permission 转换为 UserRole
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error checking permission '${permission}' for userId '${userId}':`,
        {
          userId,
          permission,
          error: error.message,
          stack: error.stack,
        },
      );
      return false;
    }
  }

  /**
   * @description 启用用户的MFA。
   * @description English: Enable MFA for a user.
   * @param {string} userId - 用户ID。
   * @returns {Promise<{ success: boolean; secret?: string; qrcodeUrl?: string; message?: string }>} MFA启用结果，包含MFA密钥和二维码URL。
   */
  async enableMfa(userId: string): Promise<{
    success: boolean;
    secret?: string;
    qrcodeUrl?: string;
    message?: string;
  }> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        return { success: false, message: 'User not found.' };
      }

      if (user.mfaSecret) {
        // 更改为 mfaSecret
        return {
          success: false,
          message: 'MFA already enabled for this user.',
        };
      }

      const secret = speakeasy.generateSecret({
        length: 20,
        name: `SEO_Manager (${user.username})`, // 应用名称和用户名
      });

      await this.dbManager.users.updateUserMfaSecret(userId, secret.base32);

      const qrcodeUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: user.username,
        issuer: 'SEO Manager',
        encoding: 'base32',
      });

      log('info', Modules.AuthService, `MFA enabled for user '${userId}'.`, {
        userId,
      });
      return { success: true, secret: secret.base32, qrcodeUrl };
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error enabling MFA for userId '${userId}':`,
        {
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      return {
        success: false,
        message: 'An unexpected error occurred during MFA enablement.',
      };
    }
  }

  /**
   * @description 禁用用户的MFA。
   * @description English: Disable MFA for a user.
   * @param {string} userId - 用户ID。
   * @returns {Promise<boolean>} 禁用是否成功。
   */
  async disableMfa(userId: string): Promise<boolean> {
    try {
      const user = await this.dbManager.users.getUserById(userId);
      if (!user) {
        return false;
      }

      await this.dbManager.users.updateUserMfaSecret(userId, null as any); // 将mfa_secret设为null

      log('info', Modules.AuthService, `MFA disabled for user '${userId}'.`, {
        userId,
      });
      return true;
    } catch (error: any) {
      log(
        'error',
        Modules.AuthService,
        `Error disabling MFA for userId '${userId}':`,
        {
          userId,
          error: error.message,
          stack: error.stack,
        },
      );
      return false;
    }
  }
}
