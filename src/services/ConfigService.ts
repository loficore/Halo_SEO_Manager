/**
 * @file src/services/ConfigService.ts
 * @description ConfigService 负责系统配置的读取、写入和更新逻辑。
 * 它处理 SMTP、LLM、优化参数、数据库路径和日志文件路径等配置。
 */

import { DatabaseManager } from '../database';
import { log, Modules } from '../logger';
import {
  SystemSettings,
  InitializeSystemRequest,
  UpdateSystemSettingsRequest,
  SmtpConfig,
  LlmConfig,
  OptimizationParams,
} from '../types/config';

export class ConfigService {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
    log('info', Modules.ConfigService, 'ConfigService initialized.');
  }

  /**
   * @description 获取所有系统设置。
   * @returns {Promise<SystemSettings>} 包含所有系统设置的对象。
   */
  async getSystemSettings(): Promise<SystemSettings> {
    const settingsMap = await this.databaseManager.getAllSettings();
    log('debug', Modules.ConfigService, 'Retrieved raw settings from database.', { settingsMap });

    const smtpConfig: SmtpConfig = {
      host: settingsMap['smtp_host'] || '',
      port: settingsMap['smtp_port'] ? parseInt(settingsMap['smtp_port']) : 587,
      username: settingsMap['smtp_username'] || '',
      password: settingsMap['smtp_password'] || '',
      fromAddress: settingsMap['smtp_from_address'] || '',
      secure: settingsMap['smtp_secure'] === 'true',
    };

    const llmConfig: LlmConfig = {
      llmModel: settingsMap['llm_model'] || 'gpt-3.5-turbo',
      llmApiKey: settingsMap['llm_api_key'] || '',
      llmApiBaseUrl: settingsMap['llm_api_base_url'] || 'https://api.openai.com/v1',
    };

    const optimizationParams: OptimizationParams = {
      minContentLength: settingsMap['min_content_length'] ? parseInt(settingsMap['min_content_length']) : 500,
      maxContentLength: settingsMap['max_content_length'] ? parseInt(settingsMap['max_content_length']) : 50000,
      minDaysSinceLastOptimization: settingsMap['min_days_since_last_optimization'] ? parseInt(settingsMap['min_days_since_last_optimization']) : 7,
      forceReoptimize: settingsMap['force_reoptimize'] === 'true',
    };

    return {
      isSystemInitialized: settingsMap['is_system_initialized'] === 'true',
      smtpConfig,
      llmConfig,
      optimizationParams,
      databasePath: settingsMap['database_path'] || 'seo_manager.db',
      logFilePath: settingsMap['log_file_path'] || 'logs/app.log',
      allowNewUserRegistration: settingsMap['allow_new_user_registration'] === 'true',
    };
  }

  /**
   * @description 初始化系统设置。
   * @param {InitializeSystemRequest} request - 初始化请求数据。
   */
  async initializeSystem(request: InitializeSystemRequest): Promise<void> {
    const currentSettings = await this.getSystemSettings();
    if (currentSettings.isSystemInitialized) {
      log('warn', Modules.ConfigService, 'System already initialized. Skipping initialization.', { request });
      throw new Error('System already initialized.');
    }

    // 设置核心配置，确保所有字段都被设置，即使是默认值
    await this.databaseManager.setSetting('is_system_initialized', 'true');
    await this.databaseManager.setSetting('database_path', request.databasePath || 'seo_manager.db');
    await this.databaseManager.setSetting('log_file_path', request.logFilePath || 'logs/app.log');
    await this.databaseManager.setSetting('allow_new_user_registration', (request.allowNewUserRegistration ?? true) ? 'true' : 'false'); // 默认为 true

    // 设置 SMTP 配置
    await this.databaseManager.setSetting('smtp_host', request.smtpConfig?.host || '');
    await this.databaseManager.setSetting('smtp_port', (request.smtpConfig?.port ?? 587).toString());
    await this.databaseManager.setSetting('smtp_username', request.smtpConfig?.username || '');
    await this.databaseManager.setSetting('smtp_password', request.smtpConfig?.password || '');
    await this.databaseManager.setSetting('smtp_from_address', request.smtpConfig?.fromAddress || '');
    await this.databaseManager.setSetting('smtp_secure', (request.smtpConfig?.secure ?? false) ? 'true' : 'false'); // 默认为 false

    // 设置 LLM 配置
    await this.databaseManager.setSetting('llm_model', request.llmConfig?.llmModel || 'gpt-3.5-turbo');
    await this.databaseManager.setSetting('llm_api_key', request.llmConfig?.llmApiKey || '');
    await this.databaseManager.setSetting('llm_api_base_url', request.llmConfig?.llmApiBaseUrl || 'https://api.openai.com/v1');

    // 设置优化参数
    await this.databaseManager.setSetting('min_content_length', (request.optimizationParams?.minContentLength ?? 500).toString());
    await this.databaseManager.setSetting('max_content_length', (request.optimizationParams?.maxContentLength ?? 50000).toString());
    await this.databaseManager.setSetting('min_days_since_last_optimization', (request.optimizationParams?.minDaysSinceLastOptimization ?? 7).toString());
    await this.databaseManager.setSetting('force_reoptimize', (request.optimizationParams?.forceReoptimize ?? false) ? 'true' : 'false'); // 默认为 false

    log('info', Modules.ConfigService, 'System initialized successfully.', { request });
  }

  /**
   * @description 更新系统设置。
   * @param {UpdateSystemSettingsRequest} request - 更新请求数据。
   */
  async updateSystemSettings(request: UpdateSystemSettingsRequest): Promise<void> {
    // 获取当前设置以合并更新
    const currentSettings = await this.getSystemSettings();

    // 更新核心配置
    await this.databaseManager.setSetting('database_path', request.databasePath ?? currentSettings.databasePath);
    await this.databaseManager.setSetting('log_file_path', request.logFilePath ?? currentSettings.logFilePath);
    await this.databaseManager.setSetting('allow_new_user_registration', (request.allowNewUserRegistration ?? currentSettings.allowNewUserRegistration) ? 'true' : 'false');

    // 更新 SMTP 配置
    const currentSmtp = currentSettings.smtpConfig;
    const newSmtp = request.smtpConfig;
    await this.databaseManager.setSetting('smtp_host', newSmtp?.host ?? currentSmtp.host);
    await this.databaseManager.setSetting('smtp_port', (newSmtp?.port ?? currentSmtp.port).toString());
    await this.databaseManager.setSetting('smtp_username', newSmtp?.username ?? currentSmtp.username);
    await this.databaseManager.setSetting('smtp_password', newSmtp?.password ?? currentSmtp.password);
    await this.databaseManager.setSetting('smtp_from_address', newSmtp?.fromAddress ?? currentSmtp.fromAddress);
    await this.databaseManager.setSetting('smtp_secure', (newSmtp?.secure ?? currentSmtp.secure) ? 'true' : 'false');

    // 更新 LLM 配置
    const currentLlm = currentSettings.llmConfig;
    const newLlm = request.llmConfig;
    await this.databaseManager.setSetting('llm_model', newLlm?.llmModel ?? currentLlm.llmModel);
    await this.databaseManager.setSetting('llm_api_key', newLlm?.llmApiKey ?? currentLlm.llmApiKey);
    await this.databaseManager.setSetting('llm_api_base_url', newLlm?.llmApiBaseUrl ?? currentLlm.llmApiBaseUrl ?? '');

    // 更新优化参数
    const currentOptimization = currentSettings.optimizationParams;
    const newOptimization = request.optimizationParams;
    await this.databaseManager.setSetting('min_content_length', (newOptimization?.minContentLength ?? currentOptimization.minContentLength).toString());
    await this.databaseManager.setSetting('max_content_length', (newOptimization?.maxContentLength ?? currentOptimization.maxContentLength).toString());
    await this.databaseManager.setSetting('min_days_since_last_optimization', (newOptimization?.minDaysSinceLastOptimization ?? currentOptimization.minDaysSinceLastOptimization).toString());
    await this.databaseManager.setSetting('force_reoptimize', (newOptimization?.forceReoptimize ?? currentOptimization.forceReoptimize) ? 'true' : 'false');

    log('info', Modules.ConfigService, 'System settings updated successfully.', { request });
  }
}