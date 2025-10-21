# SEO Manager API 文档

本文档提供了 SEO Manager 项目的完整 API 接口说明，包括数据模型和端点定义。

## 文档结构

API 文档按照以下结构组织：

```
docs/api/
├── schemas/          # 数据模型定义
│   ├── auth-base.json      # 基础认证模型
│   ├── auth-mfa.json       # 多因素认证模型
│   ├── auth-password.json  # 密码相关模型
│   ├── user.json          # 用户相关模型
│   ├── config.json        # 配置相关模型
│   ├── task.json          # 任务相关模型
│   ├── optimization.json  # 优化相关模型
│   └── common.json        # 通用模型（API Key、Token、Log等）
└── endpoints/        # API 端点定义
    ├── auth.yaml         # 认证相关端点
    ├── config.yaml       # 配置管理端点
    ├── tasks.yaml        # 任务管理端点
    ├── optimizations.yaml # 优化管理端点
    ├── api-keys.yaml     # API Key管理端点
    └── logs.yaml         # 日志查看端点
```

## 数据模型 (Schemas)

数据模型使用 OpenAPI 3.0 格式定义，描述了 API 中使用的各种数据结构。

### 认证相关模型

- **auth-base.json**: 包含基础认证相关的模型，如登录凭据、注册信息、认证结果等
- **auth-mfa.json**: 包含多因素认证相关的模型，如 MFA 设置数据、验证结果等
- **auth-password.json**: 包含密码管理相关的模型，如密码强度检查、重置请求等

### 业务模型

- **user.json**: 用户管理相关的模型，包括用户信息、创建/更新请求等
- **config.json**: 系统配置相关的模型，包括系统状态、SMTP/LLM配置等
- **task.json**: 任务管理相关的模型，包括任务状态、创建/更新请求等
- **optimization.json**: SEO 优化相关的模型，包括优化报告、运行记录等

### 通用模型

- **common.json**: 通用数据模型，包括 API Key、Token、日志等相关模型

## API 端点 (Endpoints)

API 端点使用 OpenAPI 3.0 YAML 格式定义，描述了各个 API 接口的详细信息。

### 认证相关端点 (auth.yaml)

- 用户登录、注册、登出
- 令牌刷新
- 多因素认证设置和验证
- 密码管理和重置

### 配置管理端点 (config.yaml)

- 系统状态查询
- 系统设置获取和更新
- SMTP/LLM 配置管理
- 系统初始化

### 任务管理端点 (tasks.yaml)

- 任务创建、查询、更新、删除
- 任务启动、停止
- 任务调度管理

### 优化管理端点 (optimizations.yaml)

- SEO 优化执行
- 优化结果查询
- 优化报告管理
- 优化历史记录

### API Key 管理端点 (api-keys.yaml)

- API Key 创建、查询、更新、删除
- API Key 重新生成
- API Key 启用/禁用

### 日志查看端点 (logs.yaml)

- 日志查询和过滤
- 日志统计信息
- 日志导出
- 日志清理

## 使用方法

### 导入到 APIfox

1. 打开 APIfox 应用
2. 创建新项目或选择现有项目
3. 点击"导入"按钮
4. 选择"OpenAPI"格式
5. 分别导入各个端点 YAML 文件
6. 导入数据模型 JSON 文件作为数据模型

### 导入到 Postman

1. 打开 Postman
2. 点击"Import"按钮
3. 选择"Link"或"File"
4. 粘贴文件路径或上传文件
5. 选择 OpenAPI 格式

### 导入到其他工具

大多数 API 工具（如 Insomnia、Swagger UI 等）都支持 OpenAPI 3.0 格式，可以按照相应工具的导入说明进行操作。

## 认证方式

API 使用 Bearer Token 认证方式：

```
Authorization: Bearer <your-jwt-token>
```

获取令牌的步骤：

1. 使用 `/api/auth/login` 端点登录
2. 从响应中获取 `accessToken`
3. 在后续请求的 Header 中添加认证信息

## 错误处理

API 使用标准的 HTTP 状态码表示请求结果：

- `200`: 请求成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未认证
- `403`: 权限不足
- `404`: 资源不存在
- `409`: 资源冲突
- `500`: 服务器内部错误

错误响应格式：

```json
{
  "error": "错误信息描述",
  "errorCode": "ERROR_CODE",
  "details": {
    "field": "具体错误字段"
  }
}
```

## 分页处理

列表接口支持分页，使用以下参数：

- `page`: 页码（从1开始）
- `pageSize`: 每页大小（通常最大为100）

分页响应格式：

```json
{
  "items": [...],
  "totalCount": 100,
  "currentPage": 1,
  "pageSize": 20
}
```

## 版本信息

- API 版本: 1.0.0
- OpenAPI 规范: 3.0.3
- 文档更新日期: 2023-12-31

## 联系方式

如有 API 使用问题或建议，请联系开发团队。

---

*本文档由 SEO Manager 开发团队维护*