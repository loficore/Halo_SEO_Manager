
# 后端功能补全与完善计划

本计划旨在根据前端已实现的功能，补全和完善后端 API 端点、业务逻辑和数据库支持。所有新代码实现将严格遵循 JSDoc 注释规范进行文档化。

---

## 1. `RegisterPage` (注册页面) - 注册逻辑的条件性开放

### 1.1 API 端点设计

*   **`GET /api/config/status`** (用于前端判断是否显示注册页面)
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/config/status`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "isInitialized": true,
          "isSmtpConfigured": false,
          "isRegistrationOpen": false
        }
        ```
    *   **DTO**: `SystemStatusDto`

*   **`POST /api/auth/register`** (修改现有端点)
    *   **HTTP 方法**: `POST`
    *   **路径**: `/api/auth/register`
    *   **请求体示例**:
        ```json
        {
          "username": "newuser",
          "password": "securepassword123"
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "message": "User registered successfully"
        }
        ```
    *   **DTO**: `RegisterRequestDto` (请求), `MessageResponseDto` (响应)

### 1.2 核心业务逻辑概要

*   **`ConfigService.getSystemStatus()`**:
    *   从 `settings` 表中读取 `is_system_initialized` 和 `is_smtp_configured` 状态。
    *   根据这两个状态计算 `isRegistrationOpen` (即 `isInitialized && isSmtpConfigured`)。
    *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`AuthService.registerUser(username, password)`**:
    *   在执行实际注册逻辑前，调用 `ConfigService.getSystemStatus()` 检查 `isRegistrationOpen`。
    *   如果 `isRegistrationOpen` 为 `false`，则抛出自定义错误（例如 `RegistrationDisabledError`）。
    *   **JSDoc**: 更新 JSDoc，说明条件性注册逻辑。
*   **`authController.registerUser`**:
    *   在调用 `AuthService.registerUser` 之前，添加中间件或控制器逻辑，捕获 `RegistrationDisabledError` 并返回 403 Forbidden 响应。

### 1.3 数据库架构变更

*   **`settings` 表**:
    *   新增字段 `is_system_initialized` (BOOLEAN, 默认值 `FALSE`)。
    *   新增字段 `is_smtp_configured` (BOOLEAN, 默认值 `FALSE`)。

### 1.4 错误处理机制

*   **注册被禁用**: `AuthService` 抛出 `RegistrationDisabledError`，`authController` 捕获并返回 403 Forbidden。
*   **用户名已存在**: `AuthService` 抛出 `UserExistsError`，`authController` 捕获并返回 409 Conflict。
*   **密码不符合要求**: `AuthService` 抛出 `InvalidPasswordError`，`authController` 捕获并返回 400 Bad Request。

---

## 2. `InitializationPage` (系统初始化页面)

### 2.1 API 端点设计

*   **`POST /api/config/initialize`**
    *   **HTTP 方法**: `POST`
    *   **路径**: `/api/config/initialize`
    *   **请求体示例**:
        ```json
        {
          "adminUsername": "initial_admin",
          "adminPassword": "supersecurepassword",
          "dbPath": "/app/data/database.sqlite",
          "smtpConfig": {
            "host": "smtp.example.com",
            "port": 587,
            "secure": false,
            "user": "user@example.com",
            "pass": "smtp_password"
          },
          "llmConfig": {
            "provider": "openai",
            "apiKey": "sk-...",
            "model": "gpt-4o"
          },
          "optimizationParams": {
            "minContentLength": 100,
            "maxContentLength": 500,
            "minDaysSinceLastOptimization": 7,
            "forceReoptimize": false,
            "metaDescriptionLength": 150
          }
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "message": "System initialized successfully"
        }
        ```
    *   **DTO**: `InitializeSystemRequestDto` (请求), `MessageResponseDto` (响应)

### 2.2 核心业务逻辑概要

*   **`ConfigService.initializeSystem(initData: InitializeSystemRequestDto)`**:
    1.  调用 `ConfigService.getSystemStatus()` 检查 `isInitialized` 状态。如果为 `true`，则抛出 `SystemAlreadyInitializedError`。
    2.  验证 `initData` 中的所有参数（使用 `express-validator` 或自定义验证器）。
    3.  调用 `AuthService.registerUser(adminUsername, adminPassword, 'admin')` 注册初始管理员账号，并赋予 `admin` 角色。
    4.  将 `smtpConfig`, `llmConfig`, `optimizationParams`, `dbPath` 等配置参数序列化为 JSON 字符串，并使用 `DatabaseManager.setSetting` 存储到 `settings` 表。
    5.  更新 `settings` 表中的 `is_system_initialized` 状态为 `true`。
    6.  根据 `smtpConfig` 是否提供且有效，更新 `is_smtp_configured` 状态。
    *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`ConfigController.initializeSystem`**:
    *   处理 `POST /api/config/initialize` 请求，调用 `ConfigService.initializeSystem`。
    *   **JSDoc**: 为控制器方法添加详细 JSDoc。

### 2.3 数据库架构变更

*   **`settings` 表**:
    *   `value` 字段类型应支持存储 JSON 对象（例如，使用 TEXT 字段存储 JSON 字符串）。
    *   确保能够存储 `db_path`, `smtp_config`, `llm_config`, `optimization_params` 等配置项。
*   **`users` 表**:
    *   新增字段 `role` (TEXT, 例如 'admin', 'user')，默认值 'user'。

### 2.4 错误处理机制

*   **系统已初始化**: `ConfigService` 抛出 `SystemAlreadyInitializedError`，`ConfigController` 捕获并返回 409 Conflict。
*   **请求参数验证失败**: `ConfigController` 返回 400 Bad Request。
*   **管理员注册失败**: `AuthService` 抛出错误，`ConfigService` 捕获并返回 500 Internal Server Error。

---

## 3. `ApiKeyManagementPage` (API Key 管理页面)

### 3.1 API 端点设计

*   **`GET /api/api-keys`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/api-keys`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        [
          { "id": "uuid-1", "name": "OpenAI Key", "keyPrefix": "sk-...", "createdAt": "2025-01-01T10:00:00Z", "userId": "user-id-1", "type": "LLM" },
          { "id": "uuid-2", "name": "Halo API Token", "keyPrefix": "hl-...", "createdAt": "2025-01-02T11:00:00Z", "userId": "user-id-1", "type": "CMS" }
        ]
        ```
    *   **DTO**: `ApiKeyDto[]`

*   **`POST /api/api-keys`**
    *   **HTTP 方法**: `POST`
    *   **路径**: `/api/api-keys`
    *   **请求体示例**:
        ```json
        {
          "name": "New API Key Name",
          "type": "LLM" // 可选: 用于分类 Key
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "id": "uuid-3",
          "name": "New API Key Name",
          "keyPrefix": "sk-generated-prefix",
          "createdAt": "2025-01-01T10:05:00Z",
          "userId": "user-id-1",
          "type": "LLM"
        }
        ```
    *   **DTO**: `CreateApiKeyRequestDto` (请求), `ApiKeyDto` (响应)

*   **`PUT /api/api-keys/:id`**
    *   **HTTP 方法**: `PUT`
    *   **路径**: `/api/api-keys/:id`
    *   **请求体示例**:
        ```json
        {
          "name": "Updated API Key Name"
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "message": "API Key updated successfully"
        }
        ```
    *   **DTO**: `UpdateApiKeyRequestDto` (请求), `MessageResponseDto` (响应)

*   **`DELETE /api/api-keys/:id`**
    *   **HTTP 方法**: `DELETE`
    *   **路径**: `/api/api-keys/:id`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "message": "API Key deleted successfully"
        }
        ```
    *   **DTO**: `MessageResponseDto`

### 3.2 核心业务逻辑概要

*   **`ApiKeyService` (新增)**:
    *   **`getApiKeys(userId: string)`**:
        *   从 `api_keys` 表中获取指定 `userId` 的所有 API Keys。
        *   只返回 Key 的前缀 (`keyPrefix`)，不返回完整 Key。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`createApiKey(userId: string, name: string, type?: string)`**:
        *   生成一个安全的、唯一的 API Key (例如，使用 `crypto` 模块)。
        *   计算 Key 的哈希值 (`keyHash`) 和前缀 (`keyPrefix`)。
        *   将 `id`, `name`, `keyHash`, `keyPrefix`, `createdAt`, `userId`, `type` 存储到 `api_keys` 表。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`updateApiKey(userId: string, id: string, newName: string)`**:
        *   验证指定 `id` 的 Key 是否属于 `userId`。
        *   更新 `api_keys` 表中指定 ID 的 Key 的 `name` 字段。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`deleteApiKey(userId: string, id: string)`**:
        *   验证指定 `id` 的 Key 是否属于 `userId`。
        *   从 `api_keys` 表中删除指定 ID 的 Key。
        *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`ApiKeyController` (新增)**:
    *   处理所有 `/api/api-keys` 相关的请求，调用 `ApiKeyService` 的相应方法。
    *   实现请求参数校验（例如，`name` 不能为空）。
    *   **JSDoc**: 为控制器及其方法添加详细 JSDoc。

### 3.3 数据库架构变更

*   **`api_keys` 表**:
    *   新增字段 `id` (TEXT, PRIMARY KEY, UUID)。
    *   新增字段 `name` (TEXT, NOT NULL)。
    *   新增字段 `key_hash` (TEXT, NOT NULL, 存储 Key 的哈希值)。
    *   新增字段 `key_prefix` (TEXT, NOT NULL, 存储 Key 的前缀，用于显示)。
    *   新增字段 `created_at` (DATETIME, NOT NULL, 默认当前时间)。
    *   新增字段 `user_id` (TEXT, NOT NULL, 外键关联 `users` 表)。
    *   新增字段 `type` (TEXT, 可选，例如 'LLM', 'CMS')。

### 3.4 错误处理机制

*   **请求参数验证失败**: `ApiKeyController` 返回 400 Bad Request。
*   **API Key 不存在**: `ApiKeyService` 抛出 `ApiKeyNotFoundError`，`ApiKeyController` 捕获并返回 404 Not Found。
*   **权限不足**: `ApiKeyService` 抛出 `UnauthorizedError`，`ApiKeyController` 捕获并返回 403 Forbidden。

---

## 4. `TaskSchedulingPage` (任务调度页面)

### 4.1 API 端点设计

*   **`GET /api/tasks`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/tasks`
    *   **请求参数**: `status` (可选: `scheduled`, `running`, `completed`, `failed`), `limit`, `offset`
    *   **响应体示例**:
        ```json
        [
          { "id": "task-1", "articleId": "article-123", "schedule": "0 0 * * *", "llmModel": "gpt-4o", "optimizationParams": { "metaDescriptionLength": 150 }, "status": "scheduled", "createdAt": "2025-01-01T10:00:00Z", "userId": "user-id-1" }
        ]
        ```
    *   **DTO**: `ScheduledTaskDto[]`

*   **`POST /api/tasks`**
    *   **HTTP 方法**: `POST`
    *   **路径**: `/api/tasks`
    *   **请求体示例**:
        ```json
        {
          "articleId": "article-456",
          "schedule": "0 0 * * 1", // Cron 表达式
          "llmModel": "gpt-4o",
          "optimizationParams": {
            "metaDescriptionLength": 150
          }
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "id": "task-2",
          "message": "Task scheduled successfully"
        }
        ```
    *   **DTO**: `CreateTaskRequestDto` (请求), `MessageResponseDto` (响应)

*   **`PUT /api/tasks/:id`**
    *   **HTTP 方法**: `PUT`
    *   **路径**: `/api/tasks/:id`
    *   **请求体示例**:
        ```json
        {
          "schedule": "0 0 * * 2",
          "llmModel": "gpt-3.5-turbo"
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "message": "Task updated successfully"
        }
        ```
    *   **DTO**: `UpdateTaskRequestDto` (请求), `MessageResponseDto` (响应)

*   **`DELETE /api/tasks/:id`**
    *   **HTTP 方法**: `DELETE`
    *   **路径**: `/api/tasks/:id`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "message": "Task deleted successfully"
        }
        ```
    *   **DTO**: `MessageResponseDto`

*   **`POST /api/tasks/:id/run`**
    *   **HTTP 方法**: `POST`
    *   **路径**: `/api/tasks/:id/run`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "message": "Task triggered successfully"
        }
        ```
    *   **DTO**: `MessageResponseDto`

### 4.2 核心业务逻辑概要

*   **`TaskService` (新增)**:
    *   **`getScheduledTasks(userId: string, filters: { status?: string, limit?: number, offset?: number })`**:
        *   从 `scheduled_tasks` 表中获取指定 `userId` 的调度任务，支持过滤和分页。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`createTask(userId: string, taskData: CreateTaskRequestDto)`**:
        *   验证 `taskData` (例如，`articleId` 存在，`schedule` 是有效的 cron 表达式)。
        *   将任务信息存储到 `scheduled_tasks` 表。
        *   与 `Scheduler` 模块交互，安排新的 cron 任务。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`updateTask(userId: string, id: string, updateData: UpdateTaskRequestDto)`**:
        *   验证用户权限和 `updateData`。
        *   更新 `scheduled_tasks` 表中指定 ID 的任务。
        *   通知 `Scheduler` 模块更新或重新安排任务。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`deleteTask(userId: string, id: string)`**:
        *   验证用户权限。
        *   从 `scheduled_tasks` 表中删除指定 ID 的任务。
        *   通知 `Scheduler` 模块移除任务。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`triggerTask(userId: string, id: string)`**:
        *   验证用户权限。
        *   获取任务详情。
        *   调用 `Scheduler` 模块的相应方法，手动触发任务运行。
        *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`TaskController` (新增)**:
    *   处理所有 `/api/tasks` 相关的请求，调用 `TaskService` 的相应方法。
    *   实现请求参数校验。
    *   **JSDoc**: 为控制器及其方法添加详细 JSDoc。

### 4.3 数据库架构变更

*   **`scheduled_tasks` 表**:
    *   新增字段 `id` (TEXT, PRIMARY KEY, UUID)。
    *   新增字段 `user_id` (TEXT, NOT NULL, 外键关联 `users` 表)。
    *   新增字段 `article_id` (TEXT, NOT NULL)。
    *   新增字段 `schedule_cron` (TEXT, NOT NULL)。
    *   新增字段 `llm_model` (TEXT, NOT NULL)。
    *   新增字段 `optimization_params` (TEXT AS JSON, NOT NULL)。
    *   新增字段 `status` (TEXT, NOT NULL, 默认 'scheduled')。
    *   新增字段 `created_at` (DATETIME, NOT NULL, 默认当前时间)。
    *   新增字段 `updated_at` (DATETIME, NOT NULL, 默认当前时间)。

### 4.4 错误处理机制

*   **请求参数验证失败**: `TaskController` 返回 400 Bad Request。
*   **任务不存在**: `TaskService` 抛出 `TaskNotFoundError`，`TaskController` 捕获并返回 404 Not Found。
*   **权限不足**: `TaskService` 抛出 `UnauthorizedError`，`TaskController` 捕获并返回 403 Forbidden。
*   **调度器操作失败**: `TaskService` 抛出 `SchedulerError`，`TaskController` 捕获并返回 500 Internal Server Error。

---

## 5. `OptimizationStatusPage` (优化状态监控页面)

### 5.1 API 端点设计

*   **`GET /api/optimizations`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/optimizations`
    *   **请求参数**: `userId` (可选), `articleId` (可选), `status` (可选: `pending`, `running`, `completed`, `failed`), `limit`, `offset`
    *   **响应体示例**:
        ```json
        [
          { "id": "run-1", "articleId": "article-123", "status": "completed", "startTime": "2025-01-01T10:00:00Z", "endTime": "2025-01-01T10:05:00Z", "report": { "metaTitle": "...", "metaDescription": "...", "keywords": [...] }, "llmModel": "gpt-4o", "optimizationParams": { "metaDescriptionLength": 150 } }
        ]
        ```
    *   **DTO**: `OptimizationRunDto[]`

*   **`GET /api/optimizations/:id`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/optimizations/:id`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "id": "run-1",
          "articleId": "article-123",
          "status": "completed",
          "startTime": "2025-01-01T10:00:00Z",
          "endTime": "2025-01-01T10:05:00Z",
          "report": { "metaTitle": "...", "metaDescription": "...", "keywords": [...] },
          "llmModel": "gpt-4o",
          "optimizationParams": { "metaDescriptionLength": 150 }
        }
        ```
    *   **DTO**: `OptimizationRunDto`

### 5.2 核心业务逻辑概要

*   **`OptimizationService` (新增)**:
    *   **`getOptimizationRuns(userId: string, filters: { articleId?: string, status?: string, limit?: number, offset?: number })`**:
        *   从 `seo_runs` 表中查询优化运行记录，支持按 `userId`, `articleId`, `status` 过滤和分页。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`getOptimizationRunById(userId: string, id: string)`**:
        *   获取单个优化运行的详细信息，并进行权限检查。
        *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`OptimizationController` (新增)**:
    *   处理所有 `/api/optimizations` 相关的请求，调用 `OptimizationService` 的相应方法。
    *   实现请求参数校验。
    *   **JSDoc**: 为控制器及其方法添加详细 JSDoc。

### 5.3 数据库架构变更

*   **`seo_runs` 表**:
    *   新增字段 `user_id` (TEXT, NOT NULL, 外键关联 `users` 表)。
    *   新增字段 `llm_model` (TEXT, 可选)。
    *   新增字段 `optimization_params` (TEXT AS JSON, 可选)。

### 5.4 错误处理机制

*   **请求参数验证失败**: `OptimizationController` 返回 400 Bad Request。
*   **运行记录不存在**: `OptimizationService` 抛出 `OptimizationRunNotFoundError`，`OptimizationController` 捕获并返回 404 Not Found。
*   **权限不足**: `OptimizationService` 抛出 `UnauthorizedError`，`OptimizationController` 捕获并返回 403 Forbidden。

---

## 6. `LogViewerPage` (日志查看器页面)

### 6.1 API 端点设计

*   **`GET /api/logs`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/logs`
    *   **请求参数**: `level` (可选: `info`, `warn`, `error`), `module` (可选: `ModuleKey` 枚举值), `limit`, `offset`
    *   **响应体示例**:
        ```json
        [
          { "timestamp": "2025-01-01T10:00:00Z", "level": "info", "module": "AuthService", "message": "User 'admin' logged in." },
          { "timestamp": "2025-01-01T10:01:00Z", "level": "error", "module": "SeoOptimizer", "message": "LLM API call failed." }
        ]
        ```
    *   **DTO**: `LogEntryDto[]`

### 6.2 核心业务逻辑概要

*   **`LogService` (新增)**:
    *   **`getLogs(filters: { level?: string, module?: string, limit?: number, offset?: number })`**:
        1.  读取日志文件（日志文件路径从 `ConfigService` 获取）。
        2.  解析日志内容（例如，按行读取，解析 JSON 或特定格式）。
        3.  根据 `level` 和 `module` 进行过滤。
        4.  支持分页 (`limit`, `offset`)。
        *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`LogController` (新增)**:
    *   处理 `/api/logs` 请求，调用 `LogService.getLogs`。
    *   实现请求参数校验。
    *   **JSDoc**: 为控制器及其方法添加详细 JSDoc。

### 6.3 数据库架构变更

*   无直接数据库变更，但日志文件路径可能需要作为系统配置存储在 `settings` 表中。

### 6.4 错误处理机制

*   **请求参数验证失败**: `LogController` 返回 400 Bad Request。
*   **日志文件不存在或无法读取**: `LogService` 抛出 `LogFileError`，`LogController` 捕获并返回 500 Internal Server Error。
*   **权限不足**: `LogController` 捕获并返回 403 Forbidden。

---

## 7. `SettingsPage` (系统设置页面)

### 7.1 API 端点设计

*   **`GET /api/settings`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/settings`
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "smtpConfig": { "host": "smtp.example.com", "port": 587, "secure": false, "user": "user@example.com", "pass": "********" },
          "llmConfig": { "provider": "openai", "apiKey": "sk-********", "model": "gpt-4o" },
          "optimizationParams": { "minContentLength": 100, "maxContentLength": 500, "minDaysSinceLastOptimization": 7, "forceReoptimize": false, "metaDescriptionLength": 150 },
          "isSystemInitialized": true,
          "isSmtpConfigured": false,
          "logFilePath": "/app/logs"
        }
        ```
        *注意: 敏感信息（如 `apiKey`, `pass`）在响应中应被脱敏或不返回。*
    *   **DTO**: `SettingsDto`

*   **`PUT /api/settings`**
    *   **HTTP 方法**: `PUT`
    *   **路径**: `/api/settings`
    *   **请求体示例**:
        ```json
        {
          "smtpConfig": { "host": "new.smtp.com", "port": 465, "secure": true, "user": "new@example.com", "pass": "new_password" },
          "llmConfig": { "provider": "google", "apiKey": "ai-...", "model": "gemini-pro" },
          "optimizationParams": { "metaDescriptionLength": 155 },
          "logFilePath": "/var/log/seo-manager"
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "message": "Settings updated successfully"
        }
        ```
    *   **DTO**: `UpdateSettingsRequestDto` (请求), `MessageResponseDto` (响应)

*   **`GET /api/settings/:key`**
    *   **HTTP 方法**: `GET`
    *   **路径**: `/api/settings/:key` (例如 `/api/settings/llmConfig`)
    *   **请求体**: 无
    *   **响应体示例**:
        ```json
        {
          "provider": "openai",
          "apiKey": "sk-********",
          "model": "gpt-4o"
        }
        ```
    *   **DTO**: `any` (根据 `:key` 动态)

*   **`PUT /api/settings/:key`**
    *   **HTTP 方法**: `PUT`
    *   **路径**: `/api/settings/:key`
    *   **请求体示例**:
        ```json
        {
          "model": "gpt-4o-mini"
        }
        ```
    *   **响应体示例**:
        ```json
        {
          "message": "Setting updated successfully"
        }
        ```
    *   **DTO**: `any` (请求), `MessageResponseDto` (响应)

### 7.2 核心业务逻辑概要

*   **`ConfigService` (已在 `InitializationPage` 中提及，这里是其更全面的应用)**:
    *   **`getAllSettings(userId: string)`**:
        *   从 `settings` 表中获取所有配置。
        *   对敏感信息（如 API Key、SMTP 密码）进行脱敏处理。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`updateSettings(userId: string, settingsData: UpdateSettingsRequestDto)`**:
        *   验证用户权限和 `settingsData`。
        *   验证并更新 `settings` 表中的所有配置。
        *   如果 `smtpConfig` 提供且有效，更新 `is_smtp_configured` 状态。
        *   如果 `llmConfig.apiKey` 发生变化，可能需要更新 `ApiKeyService` 中的相应记录。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`getSettingByKey(userId: string, key: string)`**:
        *   获取特定设置，并进行权限检查。
        *   对敏感信息进行脱敏处理。
        *   **JSDoc**: 为方法添加详细 JSDoc。
    *   **`updateSettingByKey(userId: string, key: string, value: any)`**:
        *   验证用户权限和 `value`。
        *   更新 `settings` 表中指定 Key 的设置。
        *   如果更新的是 `smtpConfig`，则更新 `is_smtp_configured` 状态。
        *   **JSDoc**: 为方法添加详细 JSDoc。
*   **`ConfigController` (已在 `InitializationPage` 中提及，这里是其更全面的应用)**:
    *   处理所有 `/api/settings` 相关的请求，调用 `ConfigService` 的相应方法。
    *   实现请求参数校验。
    *   **JSDoc**: 为控制器及其方法添加详细 JSDoc。

### 7.3 数据库架构变更

*   **`settings` 表**:
    *   确保 `value` 字段能够灵活存储各种类型的配置数据（例如，使用 JSON 字段）。
    *   新增字段 `log_file_path` (TEXT, 可选)。

### 7.4 错误处理机制

*   **请求参数验证失败**: `ConfigController` 返回 400 Bad Request。
*   **设置项不存在**: `ConfigService` 抛出 `SettingNotFoundError`，`ConfigController` 捕获并返回 404 Not Found。
*   **权限不足**: `ConfigService` 抛出 `UnauthorizedError`，`ConfigController` 捕获并返回 403 Forbidden。

---

## 8. 跨模块依赖与初始化

*   **`src/logger.ts`**: `Modules` 枚举需要添加新的控制器和服务模块。
    ```typescript
    export enum Modules {
      // ... existing modules
      ConfigService = 'ConfigService',
      ConfigController = 'ConfigController',
      ApiKeyService = 'ApiKeyService',
      ApiKeyController = 'ApiKeyController',
      TaskService = 'TaskService',
      TaskController = 'TaskController',
      OptimizationService = 'OptimizationService',
      OptimizationController = 'OptimizationController',
      LogService = 'LogService',
      LogController = 'LogController',
    }
    ```
*   **`src/index.ts` (主入口文件)**:
    1.  **导入新的服务和控制器**。
    2.  **实例化新的服务**，并将 `DatabaseManager` 等依赖注入。
    3.  **实例化新的控制器**，并将相应的服务注入。
    4.  **将新的控制器路由注册到 Express 应用程序中**。
*   **DTO 文件**: 创建新的 DTO 文件（例如 `src/types/config.ts`, `src/types/apiKey.ts`, `src/types/task.ts`, `src/types/optimization.ts`, `src/types/log.ts`）来定义上述 API 端点的请求和响应体结构。

---

## 9. 整体错误处理

*   **全局错误处理中间件**: 在 Express 应用程序中实现一个全局错误处理中间件，捕获所有未处理的错误，并根据错误类型返回适当的 HTTP 状态码和错误信息。
*   **自定义错误类**: 定义一系列自定义错误类（例如 `RegistrationDisabledError`, `SystemAlreadyInitializedError`, `ApiKeyNotFoundError`, `TaskNotFoundError`, `OptimizationRunNotFoundError`, `LogFileError`, `SettingNotFoundError`, `UnauthorizedError` 等），以便在业务逻辑层抛出特定错误，并在控制器层进行统一处理。

---

我已将详细的后端功能补全与完善计划写入 `docs/PLAN.zh.md` 文件。

现在，我将更新待办事项列表，将“制定详细的后端功能补全与完善计划”标记为完成。

<update_todo_list>
<todos>
[x] 了解现有代码中关于Halo API端点和文章更新逻辑的实现。
[x] 评估现有代码以确定需要修改哪些文件来支持新的 `/apis/content.halo.run/v1alpha1/posts` PATCH JSON-patch 端点。
[x] 基于用户提供的“World”、“Requirements”和“Specifications”重新设计项目架构。
[x] 绘制Mermaid图，清晰地展示新的系统架构和关键模块间的交互。
[x] 制定详细的实现计划，包括前端Web UI、后端API、持久化存储、账户系统（MelodyAuth）和部署方案。
[x] 定义API层、服务层和基础设施层的具体职责和接口。
[x] 在 docs 目录下创建架构文档 (ARCHITECTURE.zh.md)。
[x] 编写架构概述。
[x] 阐述各层的具体职责、主要组件和接口。
[x] 规划 DTO（数据传输对象）的使用，并在文档中阐述。
[x] 重构 HaloClient 以使用新的 PATCH JSON-patch API 端点。
[x] 实现 MelodyAuthClient 用于与 MelodyAuth 服务交互。
[x] 扩展 DatabaseManager 以存储用户账户、API Keys、优化配置和任务调度信息，并实现 better-sqlite3 备份。
[x] 在服务层实现 SeoService、ArticleService、TaskService、ConfigService 和 AuthService。
[x] 在 API 层构建 RESTful API 端点，集成 AuthService，并进行请求参数校验。
[x] 创建 React 前端项目。
[x] 实现登录和注册界面。
[x] 创建初始化页面。
[x] 创建 `README.md` 并包含注册逻辑。
[x] 实现 MFA 验证界面。
[x] 实现 API Key 和配置管理界面。
[x] 实现任务调度界面。
[x] 实现优化状态监控和日志查看界面。
[x] 创建 `SettingsPage`。
[x] 编写 pkg 打包脚本以及 Dockerfile 和 docker-compose.yml 文件用于部署。
[x] 征求用户对新架构和计划的批准。
[x] 切换到合适的模式（例如“Code”模式）开始实施。
[x] 制定详细的后端功能补全与完善计划。
</todos>
</update_todo_list>