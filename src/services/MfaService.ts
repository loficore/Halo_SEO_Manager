/**
 * 多因素认证服务类
 * @fileoverview 提供 TOTP 密钥生成、验证和二维码生成功能
 * @author SEO Manager Team
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { MfaSetupData, MfaVerificationResult } from '../types/auth';

/**
 * 多因素认证配置选项
 */
interface MfaConfig {
  /** 应用名称 */
  appName: string;
  /** 发行者名称 */
  issuer: string;
  /** 密钥长度 */
  secretLength: number;
  /** 验证窗口期 */
  window: number;
  /** 备用恢复代码数量 */
  backupCodeCount: number;
}

/**
 * 多因素认证服务类
 * @class MfaService
 * @description 负责处理多因素认证相关的功能，包括 TOTP 密钥生成、验证和二维码生成
 */
export class MfaService {
  /**
   * 多因素认证配置
   * @private
   * @type {MfaConfig}
   */
  private config: MfaConfig;

  /**
   * 创建 MfaService 实例
   * @constructor
   * @param {Partial<MfaConfig>} [config] - 可选的配置选项
   */
  constructor(config?: Partial<MfaConfig>) {
    // 默认配置
    this.config = {
      appName: process.env.MFA_APP_NAME || 'SEO Manager',
      issuer: process.env.MFA_ISSUER || 'SEO Manager',
      secretLength: 32,
      window: 2, // 允许前后2个时间窗口的验证码
      backupCodeCount: 10,
      ...config,
    };
  }

  /**
   * 生成新的 TOTP 密钥
   * @public
   * @returns {string} Base32 编码的密钥
   */
  public generateSecret(): string {
    return speakeasy.generateSecret({
      length: this.config.secretLength,
      name: '', // 将在使用时设置
      issuer: this.config.issuer,
      otpauth_url: false, // 不自动生成 URL，我们将手动生成
    }).base32;
  }

  /**
   * 生成备用恢复代码
   * @public
   * @returns {string[]} 备用恢复代码数组
   */
  public generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.config.backupCodeCount; i++) {
      // 生成8位随机字符的恢复代码
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * 设置多因素认证
   * @public
   * @param {string} username - 用户名
   * @param {string} email - 用户邮箱
   * @returns {Promise<MfaSetupData>} 多因素认证设置数据
   */
  public async setupMfa(
    username: string,
    email: string,
  ): Promise<MfaSetupData> {
    // 生成新的密钥
    const secret = this.generateSecret();

    // 生成备用恢复代码
    const backupCodes = this.generateBackupCodes();

    // 生成 QR 码
    const accountName = `${username} (${email})`;
    const qrCodeUrl = await this.generateQrCodeUrl(secret, accountName);

    return {
      secret,
      backupCodes,
      qrCodeUrl,
      appName: this.config.appName,
      accountName,
    };
  }

  /**
   * 验证 TOTP 验证码
   * @public
   * @param {string} token - 用户输入的验证码
   * @param {string} secret - 用户的 TOTP 密钥
   * @returns {boolean} 验证是否成功
   */
  public verifyToken(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: this.config.window,
    });
  }

  /**
   * 验证备用恢复代码
   * @public
   * @param {string} code - 用户输入的恢复代码
   * @param {string[]} backupCodes - 用户的备用恢复代码列表
   * @returns {{ valid: boolean; remainingCodes: string[] }} 验证结果和剩余的恢复代码
   */
  public verifyBackupCode(
    code: string,
    backupCodes: string[],
  ): {
    valid: boolean;
    remainingCodes: string[];
  } {
    // 查找匹配的恢复代码（不区分大小写）
    const codeIndex = backupCodes.findIndex(
      (backupCode) => backupCode.toLowerCase() === code.toLowerCase(),
    );

    if (codeIndex === -1) {
      return {
        valid: false,
        remainingCodes: backupCodes,
      };
    }

    // 移除已使用的恢复代码
    const remainingCodes = [...backupCodes];
    remainingCodes.splice(codeIndex, 1);

    return {
      valid: true,
      remainingCodes,
    };
  }

  /**
   * 生成 OTP 身份验证 URL
   * @public
   * @param {string} secret - TOTP 密钥
   * @param {string} accountName - 账户名称
   * @returns {string} OTP 身份验证 URL
   */
  public generateOtpAuthUrl(secret: string, accountName: string): string {
    return speakeasy.otpauthURL({
      secret,
      label: accountName,
      issuer: this.config.issuer,
      encoding: 'base32',
    });
  }

  /**
   * 生成 QR 码数据 URL
   * @public
   * @param {string} secret - TOTP 密钥
   * @param {string} accountName - 账户名称
   * @returns {Promise<string>} QR 码数据 URL
   */
  public async generateQrCodeUrl(
    secret: string,
    accountName: string,
  ): Promise<string> {
    const otpAuthUrl = this.generateOtpAuthUrl(secret, accountName);

    try {
      // 生成 QR 码数据 URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(
        `生成 QR 码失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  /**
   * 验证多因素认证
   * @public
   * @param {string} code - 验证码或恢复代码
   * @param {string} secret - 用户的 TOTP 密钥
   * @param {string[]} [backupCodes] - 用户的备用恢复代码列表
   * @returns {Promise<MfaVerificationResult>} 验证结果
   */
  public async verifyMfa(
    code: string,
    secret: string,
    backupCodes?: string[],
  ): Promise<MfaVerificationResult> {
    try {
      // 首先尝试验证 TOTP 验证码
      if (this.verifyToken(code, secret)) {
        return {
          success: true,
          message: '多因素认证验证成功',
        };
      }

      // 如果 TOTP 验证失败且提供了备用恢复代码，尝试验证恢复代码
      if (backupCodes && backupCodes.length > 0) {
        const backupResult = this.verifyBackupCode(code, backupCodes);
        if (backupResult.valid) {
          return {
            success: true,
            message: '恢复代码验证成功',
          };
        }
      }

      return {
        success: false,
        message: '验证码或恢复代码无效',
      };
    } catch (error) {
      return {
        success: false,
        message: `多因素认证验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 重新生成备用恢复代码
   * @public
   * @returns {string[]} 新的备用恢复代码数组
   */
  public regenerateBackupCodes(): string[] {
    return this.generateBackupCodes();
  }

  /**
   * 获取当前时间窗口的 TOTP 验证码
   * @public
   * @param {string} secret - TOTP 密钥
   * @returns {string} 当前时间窗口的验证码
   */
  public getCurrentToken(secret: string): string {
    return speakeasy.totp({
      secret,
      encoding: 'base32',
      time: Math.floor(Date.now() / 1000),
    });
  }

  /**
   * 获取多因素认证配置
   * @public
   * @returns {MfaConfig} 当前多因素认证配置
   */
  public getConfig(): MfaConfig {
    return { ...this.config };
  }

  /**
   * 更新多因素认证配置
   * @public
   * @param {Partial<MfaConfig>} newConfig - 新的配置选项
   * @returns {void}
   */
  public updateConfig(newConfig: Partial<MfaConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 验证密钥格式是否有效
   * @public
   * @param {string} secret - 要验证的密钥
   * @returns {boolean} 密钥格式是否有效
   */
  public isValidSecret(secret: string): boolean {
    try {
      // 尝试使用密钥生成验证码来验证格式
      const token = this.getCurrentToken(secret);
      return token.length === 6 && /^\d+$/.test(token);
    } catch {
      return false;
    }
  }

  /**
   * 获取剩余时间（直到下一个验证码）
   * @public
   * @returns {number} 剩余秒数
   */
  public getRemainingTime(): number {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeWindow = 30; // TOTP 标准时间窗口为30秒
    return timeWindow - (currentTime % timeWindow);
  }
}
