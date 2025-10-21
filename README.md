# SEO Manager

一个专为 Halo CMS 设计的 SEO 优化管理系统，利用 AI 技术自动优化文章的 SEO 元数据。

## 功能特性

- 🤖 **AI 驱动的 SEO 优化**：使用 OpenAI API 自动生成和优化文章的 SEO 元数据
- 📊 **自动化任务调度**：定时同步和优化 Halo CMS 中的文章
- 🔐 **多种认证方式**：支持 JWT 和 API Key 认证
- 📝 **完整的日志系统**：详细的操作日志和错误追踪
- 🚀 **RESTful API**：完整的 REST API 接口，便于前端集成
- 🛡️ **数据验证**：严格的输入验证和错误处理

## 系统要求

- Node.js 18.0 或更高版本
- npm 或 yarn
- Halo CMS 实例
- OpenAI API 密钥

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/seo-manager.git
cd seo-manager
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 文件为 `.env` 并填入相应的配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下必要配置：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# Halo CMS 配置
HALO_BASE_URL=https://your-halo-site.com
HALO_API_TOKEN=your-halo-api-token

# OpenAI API 配置
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL_NAME=gpt-3.5-turbo
```

### 4. 启动服务器

开发模式：

```bash
npm run dev
```

生产模式：

```bash
npm start
```

### 5. 初始化系统

首次启动后，需要初始化系统：

```bash
curl -X POST http://localhost:3000/api/config/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "adminUsername": "admin",
    "adminPassword": "your-secure-password",
    "haloBaseUrl": "https://your-halo-site.com",
    "haloApiToken": "your-halo-api-token",
    "openaiApiKey": "your-openai-api-key",
    "openaiApiBaseUrl": "https://api.openai.com/v1",
    "openaiModelName": "gpt-3.5-turbo"
  }'
```

## API 文档

### 认证相关

#### 用户注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123",
  "email": "test@example.com"
}
```

#### 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "password123"
}
```

### 系统配置

#### 检查系统状态

```http
GET /api/config/status
Authorization: Bearer <your-jwt-token>
```

#### 初始化系统

```http
POST /api/config/initialize
Content-Type: application/json

{
  "adminUsername": "admin",
  "adminPassword": "your-secure-password",
  "haloBaseUrl": "https://your-halo-site.com",
  "haloApiToken": "your-halo-api-token",
  "openaiApiKey": "your-openai-api-key",
  "openaiApiBaseUrl": "https://api.openai.com/v1",
  "openaiModelName": "gpt-3.5-turbo"
}
```

### 任务管理

#### 获取任务列表

```http
GET /api/tasks
Authorization: Bearer <your-jwt-token>
```

#### 创建优化任务

```http
POST /api/tasks
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "articleId": "article-uuid",
  "optimizationType": "full"
}
```

### API Key 管理

#### 创建 API Key

```http
POST /api/api-keys
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "My API Key",
  "expiresIn": "30d"
}
```

#### 获取 API Key 列表

```http
GET /api/api-keys
Authorization: Bearer <your-jwt-token>
```

## 项目结构

```
src/
├── api/                    # API 控制器
│   ├── authController.ts
│   ├── configController.ts
│   ├── taskController.ts
│   └── ...
├── services/              # 业务逻辑服务
│   ├── AuthService.ts
│   ├── ConfigService.ts
│   ├── TaskService.ts
│   └── ...
├── sql/                   # 数据库相关
│   ├── dao/              # 数据访问对象
│   └── migrations/       # 数据库迁移
├── middleware/            # 中间件
│   ├── authMiddleware.ts
│   └── errorHandler.ts
├── types/                 # TypeScript 类型定义
├── utils/                 # 工具函数
└── index.ts              # 应用入口
```

## 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 进行代码格式化：

```bash
# 检查代码规范
npm run lint

# 格式化代码
npm run format
```

### 测试

```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 构建

```bash
# 构建 TypeScript 代码
npm run build

# 构建可执行文件
npm run build-exec
```

## 部署

### Docker 部署

1. 构建 Docker 镜像：

```bash
docker build -t seo-manager .
```

2. 运行容器：

```bash
docker run -d \
  --name seo-manager \
  -p 3000:3000 \
  --env-file .env \
  seo-manager
```

### 传统部署

1. 构建项目：

```bash
npm run build
```

2. 使用 PM2 管理进程：

```bash
pm2 start dist/index.js --name seo-manager
```

## 环境变量说明

| 变量名              | 必需 | 说明                                  |
| ------------------- | ---- | ------------------------------------- |
| PORT                | 否   | 服务器端口，默认 3000                 |
| NODE_ENV            | 否   | 运行环境，默认 development            |
| HALO_BASE_URL       | 是   | Halo CMS 基础 URL                     |
| HALO_API_TOKEN      | 是   | Halo CMS API 令牌                     |
| OPENAI_API_KEY      | 是   | OpenAI API 密钥                       |
| OPENAI_API_BASE_URL | 是   | OpenAI API 基础 URL                   |
| OPENAI_MODEL_NAME   | 是   | OpenAI 模型名称                       |
| JWT_SECRET          | 是   | JWT 签名密钥                          |
| DATABASE_PATH       | 否   | 数据库文件路径，默认 ./seo_manager.db |

## 故障排除

### 常见问题

1. **服务器启动失败**
   - 检查环境变量是否正确配置
   - 确认端口是否被占用
   - 查看日志文件获取详细错误信息

2. **OpenAI API 调用失败**
   - 验证 API 密钥是否有效
   - 检查网络连接
   - 确认 API 配额是否充足

3. **Halo CMS 连接失败**
   - 验证 API 令牌是否有效
   - 检查 Halo CMS 服务是否正常运行
   - 确认网络连接是否正常

### 日志查看

日志文件位于 `./logs` 目录下，按日期分割：

```bash
# 查看今天的日志
tail -f logs/app-2023-12-20.log

# 查看错误日志
tail -f logs/error-2023-12-20.log
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持

如果您遇到问题或有建议，请：

1. 查看 [FAQ](docs/FAQ.md)
2. 搜索现有的 [Issues](https://github.com/your-repo/seo-manager/issues)
3. 创建新的 Issue

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本更新详情。
