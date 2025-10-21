/**
 * @description Jest测试设置文件
 * @fileoverview 配置测试环境和全局设置
 */

// 设置测试超时时间
jest.setTimeout(30000);

// 设置环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_ISSUER = 'seo-manager-test';
process.env.JWT_AUDIENCE = 'seo-manager-test-client';
process.env.MFA_APP_NAME = 'SEO Manager Test';
process.env.MFA_ISSUER = 'SEO Manager Test';

// 全局测试设置
global.console = {
  ...console,
  // 在测试中静默某些日志
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 模拟整个winston模块
jest.mock('winston', () => {
  const originalModule = jest.requireActual('winston');
  return {
    ...originalModule,
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    })),
    addColors: jest.fn(),
    Logger: jest.fn(),
  };
});

// 在所有测试之前运行
beforeAll(() => {
  // 全局测试设置
});

// 在每个测试之前运行
beforeEach(() => {
  // 清理模拟函数
  jest.clearAllMocks();
});

// 在每个测试之后运行
afterEach(() => {
  // 清理工作
});

// 在所有测试之后运行
afterAll(() => {
  // 全局清理
});