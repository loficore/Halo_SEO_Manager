import request from 'supertest';
import { setupApp } from '../index'; // 只导入 setupApp
import { Application } from 'express'; // 导入 Application 类型

// 导入服务和数据库连接，用于测试前后的清理
import dbInstance from '../database'; // dbInstance 是 DatabaseManager 的默认导出实例
import { ConfigService } from '../services/ConfigService';
import { AuthService } from '../services/AuthService';
import { ApiKeyService } from '../services/ApiKeyService';
import { TaskService } from '../services/TaskService';
import { Scheduler } from '../scheduler';
import { MelodyAuthClient } from '../services/melodyAuthClient';

describe('Integration Tests', () => {
  let adminToken: string;
  let adminUserId: string;

  let initializedApp: Application; // 用于存储初始化后的 Express app 实例
  let dbManager: typeof dbInstance; // Correctly reference the type of the default exported instance
  let configService: ConfigService;
  let authService: AuthService;
  let apiKeyService: ApiKeyService;
  let taskService: TaskService;
  let scheduler: Scheduler;

  beforeAll(async () => {
    // 初始化应用程序和所有服务
    const initialized = await setupApp();
    initializedApp = initialized.app; // 将初始化后的 app 赋值给 initializedApp
    dbManager = initialized.dbManager;
    configService = initialized.configService;
    authService = initialized.authService;
    apiKeyService = initialized.apiKeyService;
    taskService = initialized.taskService;
    scheduler = initialized.scheduler;
  });

  beforeEach(async () => {
    // 在每个测试前清理数据库
    // 使用新的 DAO 层重置数据库，这将运行迁移脚本
    await dbManager.resetDatabase();

    // 初始化系统并注册一个管理员用户
    await request(initializedApp) // 使用 initializedApp
      .post('/api/config/initialize')
      .send({ adminEmail: 'admin@example.com', adminPassword: 'adminpassword' })
      .expect(200);

    // 登录管理员用户并获取 token
    const loginResponse = await request(initializedApp) // 使用 initializedApp
      .post('/api/auth/login')
      .send({ username: 'admin@example.com', password: 'adminpassword' })
      .expect(200);

    adminToken = loginResponse.body.accessToken;
    adminUserId = loginResponse.body.userProfile.userId;
  });

  afterAll(async () => {
    // 关闭数据库连接
    await dbManager.close();
    // 停止调度器 (如果 scheduler 有 stop 方法)
    await scheduler.stop();
  });

  // 配置管理集成测试
  describe('Config Management', () => {
    it('should initialize the system if not already initialized', async () => {
      // beforeEach 已经初始化了系统，所以这里可以测试重复初始化会失败
      await request(initializedApp)
        .post('/api/config/initialize')
        .send({
          adminEmail: 'anotheradmin@example.com',
          adminPassword: 'anotherpassword',
        })
        .expect(409); // 期望系统已初始化
    });

    it('should get system settings for admin users', async () => {
      const response = await request(initializedApp)
        .get('/api/config/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.isSystemInitialized).toBe(true);
      expect(response.body.llmConfig.llmApiKey).toBe('********'); // 敏感信息应被遮蔽
      // 验证其他默认或初始化时设置的配置
    });

    it('should not get system settings for unauthorized users', async () => {
      await request(initializedApp).get('/api/config/settings').expect(401); // 未认证
    });

    it('should not get system settings for non-admin users', async () => {
      // 注册一个普通用户
      await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'user@example.com',
          email: 'user@example.com',
          password: 'userpassword',
        })
        .expect(200);

      const loginResponse = await request(initializedApp)
        .post('/api/auth/login')
        .send({ username: 'user@example.com', password: 'userpassword' })
        .expect(200);

      const userToken = loginResponse.body.accessToken;

      await request(initializedApp)
        .get('/api/config/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403); // 无权限
    });

    it('should update system settings for admin users', async () => {
      const newLlmModel = 'gpt-4-turbo';
      const response = await request(initializedApp)
        .put('/api/config/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ llmConfig: { llmModel: newLlmModel } })
        .expect(200);

      expect(response.body.message).toBe(
        'System settings updated successfully.',
      );

      // 验证设置是否已更新
      const updatedSettings = await request(initializedApp)
        .get('/api/config/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updatedSettings.body.llmConfig.llmModel).toBe(newLlmModel);
    });

    it('should not update system settings for unauthorized users', async () => {
      await request(initializedApp)
        .put('/api/config/settings')
        .send({ llmConfig: { llmModel: 'new-model' } })
        .expect(401); // 未认证
    });

    it('should not update system settings for non-admin users', async () => {
      // 注册一个普通用户
      await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'user2@example.com',
          email: 'user2@example.com',
          password: 'userpassword',
        })
        .expect(200);

      const loginResponse = await request(initializedApp)
        .post('/api/auth/login')
        .send({ username: 'user2@example.com', password: 'userpassword' })
        .expect(200);

      const userToken = loginResponse.body.accessToken;

      await request(initializedApp)
        .put('/api/config/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ llmConfig: { llmModel: 'new-model' } })
        .expect(403); // 无权限
    });
  });

  // 用户认证集成测试
  describe('User Authentication', () => {
    it('should allow a new user to register if allowed', async () => {
      const response = await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'newuser@example.com',
          email: 'newuser@example.com',
          password: 'newpassword',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.userProfile.username).toBe('newuser@example.com');
    });

    it('should not allow user registration if already registered', async () => {
      await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'existinguser@example.com',
          email: 'existinguser@example.com',
          password: 'password',
        })
        .expect(200);

      await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'existinguser@example.com',
          email: 'existinguser@example.com',
          password: 'password',
        })
        .expect(409); // Conflict
    });

    it('should not allow user registration if system not initialized (after reset)', async () => {
      // 重新清理数据库，但不初始化系统
      // 使用新的 DAO 层重置数据库，这将运行迁移脚本
      await dbManager.resetDatabase();

      const response = await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'uninitializeduser@example.com',
          email: 'uninitializeduser@example.com',
          password: 'password',
        })
        .expect(500); // Internal Server Error - 期望为 500 因为 ConfigService 内部会抛出未初始化错误
      // 实际应该返回 409 或 403，取决于错误处理中间件的细化
    });

    it('should not allow user registration if registration is disabled', async () => {
      // 禁用新用户注册
      await request(initializedApp)
        .put('/api/config/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ allowNewUserRegistration: false })
        .expect(200);

      await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'disableduser@example.com',
          email: 'disableduser@example.com',
          password: 'password',
        })
        .expect(403); // Forbidden
    });

    it('should allow existing user to log in', async () => {
      // beforeEach 已经注册了 admin，这里直接测试登录
      const response = await request(initializedApp)
        .post('/api/auth/login')
        .send({ username: 'admin@example.com', password: 'adminpassword' })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.userProfile.username).toBe('admin@example.com');
      expect(response.body.userProfile.roles).toContain('ADMIN');
    });

    it('should not allow login with invalid credentials', async () => {
      await request(initializedApp)
        .post('/api/auth/login')
        .send({ username: 'admin@example.com', password: 'wrongpassword' })
        .expect(401); // Unauthorized
    });

    it('should not allow login with non-existent user', async () => {
      await request(initializedApp)
        .post('/api/auth/login')
        .send({ username: 'nonexistent@example.com', password: 'password' })
        .expect(401); // Unauthorized
    });
  });

  // API Key 管理集成测试
  describe('API Key Management', () => {
    it('should allow admin to create an API Key', async () => {
      const { apiKey, hashedKey } = await apiKeyService.generateApiKey(
        adminUserId,
        'Test Admin Key',
      );

      const response = await request(initializedApp)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'My Test Key', key: apiKey, type: 'PERSONAL' })
        .expect(201); // Created

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('My Test Key');
      expect(response.body.keyPrefix).toBe(hashedKey.substring(0, 5)); // 应返回前缀
      expect(response.body.keyHash).toBeUndefined(); // 不应返回完整的 keyHash
    });

    it('should allow admin to list API Keys', async () => {
      // 创建一个 API Key
      const { apiKey, hashedKey } = await apiKeyService.generateApiKey(
        adminUserId,
        'List Key 1',
      );
      await request(initializedApp)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'List Key 1', key: apiKey, type: 'PERSONAL' })
        .expect(201);

      const response = await request(initializedApp)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].name).toBe('List Key 1');
    });

    it('should allow admin to delete an API Key', async () => {
      // 创建一个 API Key
      const { apiKey, hashedKey } = await apiKeyService.generateApiKey(
        adminUserId,
        'Delete Key',
      );
      const createResponse = await request(initializedApp)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Delete Key', key: apiKey, type: 'PERSONAL' })
        .expect(201);

      const apiKeyId = createResponse.body.id;

      await request(initializedApp)
        .delete(`/api/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204); // No Content

      // 验证是否已删除
      const listResponse = await request(initializedApp)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listResponse.body.some((key: any) => key.id === apiKeyId)).toBe(
        false,
      );
    });

    it('should validate an API Key correctly', async () => {
      const { apiKey, hashedKey } = await apiKeyService.generateApiKey(
        adminUserId,
        'Validation Key',
      );
      await request(initializedApp)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Validation Key', key: apiKey, type: 'EXTERNAL' })
        .expect(201);

      // 直接通过 service 验证 API Key (模拟中间件行为)
      const validatedKey = await apiKeyService.validateApiKey(apiKey);
      expect(validatedKey).not.toBeNull();
      expect(validatedKey?.userId).toBe(adminUserId);
      expect(validatedKey?.name).toBe('Validation Key');
    });

    it('should not validate an invalid API Key', async () => {
      const invalidApiKey = 'invalid-api-key';
      const validatedKey = await apiKeyService.validateApiKey(invalidApiKey);
      expect(validatedKey).toBeNull();
    });
  });

  // 任务管理集成测试
  describe('Task Management', () => {
    it('should allow admin to create a task', async () => {
      const response = await request(initializedApp)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          articleId: 'article-123',
          scheduleCron: '0 0 * * *',
          llmModel: 'gpt-3.5-turbo',
          optimizationParams: {
            minContentLength: 100,
            maxContentLength: 1000,
            minDaysSinceLastOptimization: 1,
            forceReoptimize: false,
          },
        })
        .expect(201); // Created

      expect(response.body).toHaveProperty('id');
      expect(response.body.articleId).toBe('article-123');
      expect(response.body.status).toBe('PENDING');
    });

    it('should allow admin to list tasks', async () => {
      // 创建一个任务
      await request(initializedApp)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          articleId: 'article-list-1',
          scheduleCron: '0 0 * * *',
          llmModel: 'gpt-3.5-turbo',
          optimizationParams: {
            minContentLength: 100,
            maxContentLength: 1000,
            minDaysSinceLastOptimization: 1,
            forceReoptimize: false,
          },
        })
        .expect(201);

      const response = await request(initializedApp)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].articleId).toBe('article-list-1');
    });
  });

  // 全局错误处理集成测试
  describe('Global Error Handling', () => {
    it('should return 404 for an unknown route', async () => {
      await request(initializedApp).get('/api/nonexistent-route').expect(404);
    });

    it('should return 401 for unauthorized access to protected routes', async () => {
      // 尝试访问需要认证的 /api/config/settings 而不带 token
      await request(initializedApp).get('/api/config/settings').expect(401);
    });

    it('should return 403 for forbidden access to protected routes', async () => {
      // 注册一个普通用户
      await request(initializedApp)
        .post('/api/auth/register')
        .send({
          username: 'forbiddenuser@example.com',
          email: 'forbiddenuser@example.com',
          password: 'password',
        })
        .expect(200);

      const loginResponse = await request(initializedApp)
        .post('/api/auth/login')
        .send({ username: 'forbiddenuser@example.com', password: 'password' })
        .expect(200);

      const userToken = loginResponse.body.accessToken;

      // 尝试以普通用户身份访问管理员设置
      await request(initializedApp)
        .get('/api/config/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should handle internal server errors gracefully', async () => {
      // 模拟一个会抛出内部服务器错误的路由或服务
      // 这里我们没有直接模拟一个会失败的路由，但可以假设某个依赖服务失败
      // 例如，如果 ConfigService.getSystemSettings 抛出非 HttpError 错误
      jest
        .spyOn(configService, 'getSystemSettings')
        .mockImplementationOnce(() => {
          throw new Error('Simulated internal server error');
        });

      const response = await request(initializedApp)
        .get('/api/config/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);

      expect(response.body.message).toBe('服务器内部错误');
      expect(response.body).not.toHaveProperty('details'); // 生产环境下不暴露 details
    });
  });
});
