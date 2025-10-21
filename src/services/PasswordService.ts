/**
 * 密码服务类
 * @fileoverview 提供密码哈希、验证和强度检查功能
 * @author SEO Manager Team
 */

import bcrypt from 'bcrypt';
import { PasswordStrengthResult } from '../types/auth';

/**
 * 密码策略配置
 */
interface PasswordPolicy {
  /** 最小密码长度 */
  minLength: number;
  /** 最大密码长度 */
  maxLength: number;
  /** 是否需要包含大写字母 */
  requireUppercase: boolean;
  /** 是否需要包含小写字母 */
  requireLowercase: boolean;
  /** 是否需要包含数字 */
  requireNumbers: boolean;
  /** 是否需要包含特殊字符 */
  requireSpecialChars: boolean;
  /** 特殊字符集合 */
  specialChars: string;
  /** 禁止的常见密码列表 */
  forbiddenPasswords: string[];
  /** 密码历史检查数量 */
  historyCheckCount: number;
}

/**
 * 密码强度检查结果
 */
interface PasswordCheckResult {
  /** 检查是否通过 */
  passed: boolean;
  /** 检查项目名称 */
  check: string;
  /** 错误信息 */
  message?: string;
}

/**
 * 密码服务类
 * @class PasswordService
 * @description 负责处理密码相关的功能，包括哈希、验证和强度检查
 */
export class PasswordService {
  /**
   * 密码策略配置
   * @private
   * @type {PasswordPolicy}
   */
  private policy: PasswordPolicy;

  /**
   * bcrypt 盐轮数
   * @private
   * @type {number}
   */
  private saltRounds: number;

  /**
   * 创建 PasswordService 实例
   * @constructor
   * @param {Partial<PasswordPolicy>} [policy] - 可选的密码策略配置
   * @param {number} [saltRounds=12] - bcrypt 盐轮数
   */
  constructor(policy?: Partial<PasswordPolicy>, saltRounds: number = 12) {
    // 默认密码策略
    this.policy = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
      forbiddenPasswords: [
        'password',
        '123456',
        '123456789',
        'qwerty',
        'abc123',
        'password123',
        'admin',
        'letmein',
        'welcome',
        'monkey',
        '1234567890',
        'password1',
        '123123',
        '1234',
        'qwertyuiop',
      ],
      historyCheckCount: 5,
      ...policy,
    };

    this.saltRounds = saltRounds;
  }

  /**
   * 生成密码哈希
   * @public
   * @param {string} password - 明文密码
   * @returns {Promise<string>} 密码哈希
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      throw new Error(
        `密码哈希生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  /**
   * 验证密码
   * @public
   * @param {string} password - 明文密码
   * @param {string} hashedPassword - 哈希密码
   * @returns {Promise<boolean>} 验证是否成功
   */
  public async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw new Error(
        `密码验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
      );
    }
  }

  /**
   * 检查密码强度
   * @public
   * @param {string} password - 要检查的密码
   * @param {string[]} [passwordHistory] - 用户历史密码列表
   * @returns {PasswordStrengthResult} 密码强度检查结果
   */
  public checkPasswordStrength(
    password: string,
    passwordHistory?: string[],
  ): PasswordStrengthResult {
    const passedChecks: string[] = [];
    const failedChecks: string[] = [];
    const suggestions: string[] = [];
    let totalScore = 0;
    const maxScore = 100;

    // 检查密码长度
    const lengthResult = this.checkPasswordLength(password);
    if (lengthResult.passed) {
      passedChecks.push(lengthResult.check);
      totalScore += 15;
    } else {
      failedChecks.push(lengthResult.check);
      suggestions.push(lengthResult.message || '增加密码长度');
    }

    // 检查字符复杂度
    const complexityResults = this.checkPasswordComplexity(password);
    complexityResults.forEach((result) => {
      if (result.passed) {
        passedChecks.push(result.check);
        totalScore += 15;
      } else {
        failedChecks.push(result.check);
        suggestions.push(result.message || '增加密码复杂度');
      }
    });

    // 检查是否为常见密码
    const commonPasswordResult = this.checkCommonPassword(password);
    if (commonPasswordResult.passed) {
      passedChecks.push(commonPasswordResult.check);
      totalScore += 10;
    } else {
      failedChecks.push(commonPasswordResult.check);
      suggestions.push(commonPasswordResult.message || '避免使用常见密码');
    }

    // 检查密码历史
    if (passwordHistory && passwordHistory.length > 0) {
      const historyResult = this.checkPasswordHistory(
        password,
        passwordHistory,
      );
      if (historyResult.passed) {
        passedChecks.push(historyResult.check);
        totalScore += 10;
      } else {
        failedChecks.push(historyResult.check);
        suggestions.push(historyResult.message || '不要重复使用最近的密码');
      }
    }

    // 检查密码模式
    const patternResult = this.checkPasswordPatterns(password);
    if (patternResult.passed) {
      passedChecks.push(patternResult.check);
      totalScore += 10;
    } else {
      failedChecks.push(patternResult.check);
      suggestions.push(patternResult.message || '避免使用简单的密码模式');
    }

    // 计算额外加分项
    const bonusScore = this.calculatePasswordBonus(password);
    totalScore = Math.min(totalScore + bonusScore, maxScore);

    // 确定强度等级
    let level: 'weak' | 'fair' | 'good' | 'strong';
    if (totalScore < 40) {
      level = 'weak';
    } else if (totalScore < 60) {
      level = 'fair';
    } else if (totalScore < 80) {
      level = 'good';
    } else {
      level = 'strong';
    }

    return {
      score: totalScore,
      level,
      passedChecks,
      failedChecks,
      suggestions,
    };
  }

  /**
   * 生成随机密码
   * @public
   * @param {number} [length=12] - 密码长度
   * @param {Object} [options] - 密码生成选项
   * @param {boolean} [options.includeUppercase=true] - 是否包含大写字母
   * @param {boolean} [options.includeLowercase=true] - 是否包含小写字母
   * @param {boolean} [options.includeNumbers=true] - 是否包含数字
   * @param {boolean} [options.includeSpecialChars=true] - 是否包含特殊字符
   * @returns {string} 生成的随机密码
   */
  public generateRandomPassword(
    length: number = 12,
    options: {
      includeUppercase?: boolean;
      includeLowercase?: boolean;
      includeNumbers?: boolean;
      includeSpecialChars?: boolean;
    } = {},
  ): string {
    const {
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSpecialChars = true,
    } = options;

    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSpecialChars) charset += this.policy.specialChars;

    if (charset === '') {
      throw new Error('至少需要选择一种字符类型');
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  /**
   * 检查密码长度
   * @private
   * @param {string} password - 要检查的密码
   * @returns {PasswordCheckResult} 检查结果
   */
  private checkPasswordLength(password: string): PasswordCheckResult {
    if (password.length < this.policy.minLength) {
      return {
        passed: false,
        check: '长度检查',
        message: `密码长度至少需要 ${this.policy.minLength} 个字符`,
      };
    }

    if (password.length > this.policy.maxLength) {
      return {
        passed: false,
        check: '长度检查',
        message: `密码长度不能超过 ${this.policy.maxLength} 个字符`,
      };
    }

    return {
      passed: true,
      check: '长度检查',
    };
  }

  /**
   * 检查密码复杂度
   * @private
   * @param {string} password - 要检查的密码
   * @returns {PasswordCheckResult[]} 检查结果数组
   */
  private checkPasswordComplexity(password: string): PasswordCheckResult[] {
    const results: PasswordCheckResult[] = [];

    // 检查大写字母
    if (this.policy.requireUppercase) {
      const hasUppercase = /[A-Z]/.test(password);
      results.push({
        passed: hasUppercase,
        check: '大写字母检查',
        message: hasUppercase ? undefined : '密码需要包含至少一个大写字母',
      });
    }

    // 检查小写字母
    if (this.policy.requireLowercase) {
      const hasLowercase = /[a-z]/.test(password);
      results.push({
        passed: hasLowercase,
        check: '小写字母检查',
        message: hasLowercase ? undefined : '密码需要包含至少一个小写字母',
      });
    }

    // 检查数字
    if (this.policy.requireNumbers) {
      const hasNumbers = /\d/.test(password);
      results.push({
        passed: hasNumbers,
        check: '数字检查',
        message: hasNumbers ? undefined : '密码需要包含至少一个数字',
      });
    }

    // 检查特殊字符
    if (this.policy.requireSpecialChars) {
      const specialCharRegex = new RegExp(
        `[${this.policy.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`,
      );
      const hasSpecialChars = specialCharRegex.test(password);
      results.push({
        passed: hasSpecialChars,
        check: '特殊字符检查',
        message: hasSpecialChars
          ? undefined
          : `密码需要包含至少一个特殊字符 (${this.policy.specialChars})`,
      });
    }

    return results;
  }

  /**
   * 检查是否为常见密码
   * @private
   * @param {string} password - 要检查的密码
   * @returns {PasswordCheckResult} 检查结果
   */
  private checkCommonPassword(password: string): PasswordCheckResult {
    const lowerPassword = password.toLowerCase();
    const isCommon = this.policy.forbiddenPasswords.some(
      (forbidden) =>
        lowerPassword.includes(forbidden) || forbidden.includes(lowerPassword),
    );

    return {
      passed: !isCommon,
      check: '常见密码检查',
      message: isCommon ? '不能使用常见密码' : undefined,
    };
  }

  /**
   * 检查密码历史
   * @private
   * @param {string} password - 要检查的密码
   * @param {string[]} passwordHistory - 密码历史
   * @returns {PasswordCheckResult} 检查结果
   */
  private checkPasswordHistory(
    password: string,
    passwordHistory: string[],
  ): PasswordCheckResult {
    const recentPasswords = passwordHistory.slice(
      -this.policy.historyCheckCount,
    );
    const isReuse = recentPasswords.some((historicalPassword) =>
      bcrypt.compareSync(password, historicalPassword),
    );

    return {
      passed: !isReuse,
      check: '密码历史检查',
      message: isReuse
        ? `不能重复使用最近 ${this.policy.historyCheckCount} 个密码`
        : undefined,
    };
  }

  /**
   * 检查密码模式
   * @private
   * @param {string} password - 要检查的密码
   * @returns {PasswordCheckResult} 检查结果
   */
  private checkPasswordPatterns(password: string): PasswordCheckResult {
    // 检查重复字符
    const hasRepeatingChars = /(.)\1{2,}/.test(password);
    if (hasRepeatingChars) {
      return {
        passed: false,
        check: '密码模式检查',
        message: '避免使用连续重复的字符',
      };
    }

    // 检查序列字符
    const hasSequentialChars = this.hasSequentialChars(password);
    if (hasSequentialChars) {
      return {
        passed: false,
        check: '密码模式检查',
        message: '避免使用连续的字符序列',
      };
    }

    // 检查键盘模式
    const hasKeyboardPattern = this.hasKeyboardPattern(password);
    if (hasKeyboardPattern) {
      return {
        passed: false,
        check: '密码模式检查',
        message: '避免使用键盘连续按键模式',
      };
    }

    return {
      passed: true,
      check: '密码模式检查',
    };
  }

  /**
   * 检查是否包含连续字符
   * @private
   * @param {string} password - 要检查的密码
   * @returns {boolean} 是否包含连续字符
   */
  private hasSequentialChars(password: string): boolean {
    const passwordLower = password.toLowerCase();

    // 检查字母序列
    for (let i = 0; i <= passwordLower.length - 3; i++) {
      const char1 = passwordLower.charCodeAt(i);
      const char2 = passwordLower.charCodeAt(i + 1);
      const char3 = passwordLower.charCodeAt(i + 2);

      if (char2 === char1 + 1 && char3 === char2 + 1) {
        return true;
      }
      if (char2 === char1 - 1 && char3 === char2 - 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查是否包含键盘模式
   * @private
   * @param {string} password - 要检查的密码
   * @returns {boolean} 是否包含键盘模式
   */
  private hasKeyboardPattern(password: string): boolean {
    const passwordLower = password.toLowerCase();
    const keyboardRows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

    for (const row of keyboardRows) {
      for (let i = 0; i <= row.length - 3; i++) {
        const pattern = row.substring(i, i + 3);
        const reversePattern = pattern.split('').reverse().join('');

        if (
          passwordLower.includes(pattern) ||
          passwordLower.includes(reversePattern)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 计算密码额外加分
   * @private
   * @param {string} password - 要评估的密码
   * @returns {number} 加分分数
   */
  private calculatePasswordBonus(password: string): number {
    let bonus = 0;

    // 长度加分
    if (password.length >= 16) bonus += 10;
    else if (password.length >= 12) bonus += 5;

    // 字符多样性加分
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.8) bonus += 5;

    // 混合字符类型加分
    const charTypes = [
      /[a-z]/.test(password),
      /[A-Z]/.test(password),
      /\d/.test(password),
      /[^a-zA-Z0-9]/.test(password),
    ].filter(Boolean).length;

    if (charTypes === 4) bonus += 10;
    else if (charTypes === 3) bonus += 5;

    return bonus;
  }

  /**
   * 获取密码策略配置
   * @public
   * @returns {PasswordPolicy} 当前密码策略配置
   */
  public getPolicy(): PasswordPolicy {
    return { ...this.policy };
  }

  /**
   * 更新密码策略配置
   * @public
   * @param {Partial<PasswordPolicy>} newPolicy - 新的密码策略配置
   * @returns {void}
   */
  public updatePolicy(newPolicy: Partial<PasswordPolicy>): void {
    this.policy = { ...this.policy, ...newPolicy };
  }

  /**
   * 验证密码是否符合策略
   * @public
   * @param {string} password - 要验证的密码
   * @returns {boolean} 密码是否符合策略
   */
  public isPasswordCompliant(password: string): boolean {
    const strengthResult = this.checkPasswordStrength(password);
    return strengthResult.failedChecks.length === 0;
  }
}
