# 项目架构设计文档

## 1. 概述

本项目旨在为Halo CMS提供一个AI驱动的SEO优化解决方案，解决Halo原生SEO管理工具的不足，并降低SEO优化的技术门槛。根据用户需求，系统将从单一后端服务扩展为包含Web UI、后端API、持久化存储和账户管理功能的全栈应用。

本次架构设计旨在提升系统的模块化、可维护性、可扩展性和安全性，通过分层架构实现职责分离。

## 2. 整体架构概览

系统采用经典的分层架构，主要分为以下三层：

1.  **API 层 (API Layer)**: 负责处理外部请求，暴露RESTful API接口。
2.  **服务层 (Service Layer)**: 封装核心业务逻辑，协调各基础设施组件。
3.  **基础设施层 (Infrastructure Layer)**: 提供底层技术支持，如数据库访问、外部API调用、日志记录等。

### 架构图

```mermaid
graph TD
    User[用户] --> |访问| WebUI[Web UI (Frontend)]
    WebUI --> |API请求| APILayer[API Layer]

    subgraph Backend 服务
        APILayer --> ServiceLayer[Service Layer]
        ServiceLayer --> InfrastructureLayer[Infrastructure Layer]
    end

    APILayer --> Authentication[MelodyAuth 认证]

    subgraph Service Layer
        SeoService[SeoService]
        ArticleService[ArticleService]
        TaskService[TaskService]
        ConfigService[ConfigService]
        AuthService[AuthService]
    end

    subgraph Infrastructure Layer
        HaloClient[HaloClient]
        DatabaseManager[DatabaseManager]
        MelodyAuthClient[MelodyAuth Client]
        Logger[Logger]
        SeoOptimizer[SeoOptimizer (AI驱动)]
        SeoValidator[SeoValidator]
    end

    AuthService --> MelodyAuthClient
    HaloClient --> |PATCH JSON-patch| HaloCMS[Halo CMS]
    DatabaseManager --> SQLiteDB[SQLite 数据库]

    SeoService --> HaloClient
    SeoService --> ArticleService
    SeoService --> DatabaseManager
    SeoService --> SeoOptimizer
    SeoService --> SeoValidator

    ArticleService --> HaloClient
    ArticleService --> DatabaseManager

    TaskService --> SeoService
    ConfigService --> DatabaseManager
    APILayer --> AuthService

    subgraph Deployment
        DockerCompose[Docker Compose]
        PkgExecutable[Pkg 可执行文件]
    end

    Backend服务 --> DockerCompose
    Backend服务 --> PkgExecutable

    User --> |查阅| GitHubDocs[GitHub 文档站]

    style HaloCMS fill:#f9f,stroke:#333,stroke-width:2px
    style WebUI fill:#bbf,stroke:#333,stroke-width:2px
    style Backend服务 fill:#dfd,stroke:#333,stroke-width:2px
    style SQLiteDB fill:#ffc,stroke:#333,stroke-width:2px
    style MelodyAuth fill:#fcc,stroke:#333,stroke-width:2px
    style Deployment fill:#eef,stroke:#333,stroke-width:2px
    style GitHubDocs fill:#cfc,stroke:#333,stroke-width:2px
```

## 3. 各层职责与接口

### 3.1 API 层 (API Layer)

**职责**:
*   接收并处理所有外部HTTP请求。
*   将HTTP请求映射到对应的服务层方法。
*   对请求参数进行初步的格式校验。
*   处理认证和授权（通过调用 `AuthService`）。
*   统一的错误处理和响应格式（如JSON）。
*   不包含核心业务逻辑，仅作为服务层的门面。

**主要组件**:
*   **Controller/Router**: 定义API路由和处理函数。
*   **Middleware**: 用于认证、授权、日志、错误处理等。

**API 列表**:

*   **认证与用户管理**:
    *   `POST /api/auth/login`: 用户登录
    *   `POST /api/auth/register`: 用户注册
    *   `POST /api/auth/verify-mfa`: MFA验证
    *   `GET /api/auth/profile`: 获取当前用户个人资料
    *   `POST /api/auth/logout`: 用户登出
    *   `POST /api/auth/refresh-token`: 刷新访问令牌

*   **文章管理**:
    *   `GET /api/articles`: 获取文章列表 (支持分页、筛选、搜索)
    *   `GET /api/articles/:articleId`: 获取单篇文章详情

*   **SEO 优化**:
    *   `PATCH /api/articles/:articleId/seo`: 更新文章SEO元数据
    *   `POST /api/articles/:articleId/seo/optimize-now`: 立即启动单篇文章SEO优化

*   **配置管理**:
    *   `GET /api/configs`: 获取当前用户配置
    *   `PUT /api/configs`: 更新当前用户配置

*   **任务调度**:
    *   `POST /api/tasks/schedule`: 调度SEO优化任务
    *   `GET /api/tasks/:taskId/status`: 获取指定任务状态
    *   `POST /api/tasks/:taskId/cancel`: 取消指定任务
    *   `GET /api/tasks`: 获取所有任务列表

### 3.2 服务层 (Service Layer)

**职责**:
*   包含核心业务逻辑和业务规则。
*   编排和协调基础设施层的操作，完成复杂的业务流程。
*   执行更深层次的业务数据校验。
*   处理事务。
*   保持与基础设施层的松耦合。

**主要组件**:
*   **AuthService**: 处理用户认证、注册、MFA、会话管理。
*   **ArticleService**: 管理文章数据的业务逻辑。
*   **SeoService**: 负责SEO元数据的优化、校验和发布流程。
*   **TaskService**: 管理SEO优化任务的生命周期（调度、执行、取消、状态）。
*   **ConfigService**: 管理应用程序的各种配置参数。

**接口示例**:

1.  **AuthService**:
    *   `login(loginData: LoginRequestDTO): Promise<AuthResultDTO>`
    *   `register(registerData: RegisterRequestDTO): Promise<AuthResultDTO>`
    *   `verifyMfa(userId: string, token: string): Promise<boolean>`
    *   `getUserProfile(userId: string): Promise<UserProfileDTO | null>`
    *   `logout(userId: string): Promise<boolean>`
    *   `refreshAccessToken(refreshToken: string): Promise<string | null>`
    *   `checkPermission(userId: string, permission: string): Promise<boolean>`

2.  **ArticleService**:
    *   `getArticles(pagination: PaginationDTO, filters: ArticleFilterDTO): Promise<PaginatedResultDTO<ArticleDTO>>`
    *   `getArticleById(articleId: string): Promise<ArticleDetailDTO | null>`
    *   `saveArticle(article: ArticleData): Promise<boolean>` (ArticleData 为基础设施层对象)
    *   `updateArticleContentHash(articleId: string, newHash: string): Promise<boolean>`

3.  **SeoService**:
    *   `optimizeArticleSeo(articleId: string, previousSeoMeta: SeoMetaDTO | null, validationFeedback: ValidationFeedbackDTO | null): Promise<OptimizedSeoMetaDTO>`
    *   `validateSeoMeta(seoMeta: SeoMetaDTO): Promise<ValidationResultDTO>`
    *   `publishSeoMeta(articleId: string, seoMeta: OptimizedSeoMetaDTO): Promise<PublishResultDTO>`

4.  **TaskService**:
    *   `scheduleOptimizationTask(taskConfig: TaskConfigDTO): Promise<TaskStatusDTO>`
    *   `cancelTask(taskId: string): Promise<boolean>`
    *   `getTaskStatus(taskId: string): Promise<TaskStatusDTO | null>`
    *   `startImmediateOptimization(articleId: string, userId: string): Promise<TaskStatusDTO>`

5.  **ConfigService**:
    *   `getAppConfig(userId: string): Promise<AppConfigDTO | null>`
    *   `updateAppConfig(userId: string, config: UpdateConfigRequestDTO): Promise<boolean>`
    *   `getHaloApiToken(userId: string): Promise<string | null>`
    *   `getOpenAIApiKey(userId: string): Promise<string | null>`

### 3.3 基础设施层 (Infrastructure Layer)

**职责**:
*   封装与外部系统（Halo CMS、MelodyAuth）和底层资源（数据库、文件系统）的交互细节。
*   提供原子性的操作接口，供服务层调用。
*   处理数据转换（如从数据库模型到业务领域模型）。

**主要组件**:

1.  **HaloClient**:
    *   **职责**: 与Halo CMS API交互，获取文章数据并使用JSON Patch更新SEO元数据。
    *   **接口**: `getPost(postName: string): Promise<RawHaloPostData | null>`, `getAllPosts(maxPages: number): Promise<RawHaloPostData[]>`, `updatePostSeoMeta(postName: string, jsonPatchOperations: Operation[]): Promise<{ success: boolean; error?: string }>`.

2.  **DatabaseManager**:
    *   **职责**: 管理SQLite数据库连接、CRUD操作、数据备份。
    *   **接口**: `initDb(): Promise<void>`, `saveArticleData(article: ArticleData): Promise<void>`, `getArticleData(articleId: string): Promise<ArticleData | null>`, `updateArticleOptimizationStatus(articleId: string, status: 'pending' | 'optimized' | 'failed', timestamp: Date): Promise<void>`, `saveConfig(userId: string, key: string, value: string): Promise<void>`, `getConfig(userId: string, key: string): Promise<string | null>`, `backupDatabase(destinationPath: string): Promise<void>`.

3.  **MelodyAuthClient**:
    *   **职责**: 与外部MelodyAuth服务进行通信，处理实际的认证和授权请求。
    *   **接口**: `authenticate(credentials: any): Promise<any>`, `registerUser(userData: any): Promise<any>`, `verifyMfaToken(userId: string, token: string): Promise<boolean>`, `authorize(userId: string, resource: string, action: string): Promise<boolean>`.

4.  **Logger**:
    *   **职责**: 提供统一的日志记录功能。
    *   **接口**: `log(level: LogLevel, module: string, message: string, context?: any): void`.

5.  **SeoOptimizer (旧SeoOptimizer)**:
    *   **职责**: 封装与LLM的交互逻辑，生成SEO元数据。
    *   **接口**: `optimizeArticle(title: string, content: string, currentSeoMeta: SeoMeta | null, previousOutput: string | null, validationFeedback: ValidationFeedback | null): Promise<SeoMeta | null>`.

6.  **SeoValidator (旧SeoValidator)**:
    *   **职责**: 封装SEO元数据验证规则。
    *   **接口**: `validate(seoMeta: SeoMeta): ValidationResult`.

## 4. DTO (数据传输对象) 规划

为了确保各层之间的数据传输格式一致且清晰，我们将广泛使用DTO。DTO将定义数据结构，用于API请求/响应、服务层方法参数和返回值。

**DTO的优势**:
*   **解耦**: 隔离领域模型与外部接口，防止领域模型细节泄露。
*   **数据校验**: 可以在API层对DTO进行初步校验，减少服务层负担。
*   **清晰性**: 明确数据预期格式，提升可读性和可维护性。
*   **安全性**: 可以筛选出需要暴露给客户端的数据。

**DTO 类型示例**:

1.  **认证相关**:
    *   `LoginRequestDTO`: { username: string, password: string }
    *   `RegisterRequestDTO`: { username: string, password: string, email: string }
    *   `AuthResponseDTO`: { accessToken: string, refreshToken: string, userProfile: UserProfileDTO }
    *   `UserProfileDTO`: { userId: string, username: string, email: string, roles: string[] }

2.  **文章相关**:
    *   `GetArticlesRequestDTO`: { page?: number, size?: number, sortBy?: string, order?: 'asc' | 'desc', search?: string }
    *   `ArticleDTO`: { id: string, title: string, slug: string, excerpt: string, url: string, lastOptimized?: Date }
    *   `ArticleDetailDTO`: { id: string, title: string, content: string, slug: string, excerpt: string, tags: string[], categories: string[], url: string, currentSeoMeta: SeoMetaDTO | null }
    *   `PaginatedResponseDTO<T>`: { items: T[], total: number, page: number, size: number }

3.  **SEO元数据相关**:
    *   `SeoMetaDTO`: { metaTitle: string, metaDescription: string, keywords: string[], slug: string }
    *   `UpdateSeoMetaRequestDTO`: { metaTitle?: string, metaDescription?: string, keywords?: string[], slug?: string }
    *   `OptimizedSeoMetaDTO`: { metaTitle: string, metaDescription: string, keywords: string[], slug: string, llmOutput?: string }
    *   `SeoUpdateResponseDTO`: { success: boolean, message: string, errors?: string[] }
    *   `ValidationFeedbackDTO`: { metaTitleFeedback?: string, metaDescriptionFeedback?: string, keywordsFeedback?: string[], slugFeedback?: string }
    *   `ValidationResultDTO`: { isValid: boolean, errors?: string[] }
    *   `PublishResultDTO`: { success: boolean, message: string }

4.  **配置相关**:
    *   `ConfigDTO`: { haloApiToken: string, openAIApiKey: string, minContentLength: number, maxContentLength: number, ... }
    *   `UpdateConfigRequestDTO`: 同 `ConfigDTO`，但字段可选。

5.  **任务调度相关**:
    *   `ScheduleTaskRequestDTO`: { articleIds?: string[], frequency: 'daily' | 'weekly' | 'monthly' | 'once', startTime: string, userId: string }
    *   `TaskStatusDTO`: { taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled', progress: number, message: string, startTime: string, endTime?: string }
    *   `TaskConfigDTO`: { articles: { id: string, title: string }[], schedule: string, userId: string, ... }

这些DTO将在项目的`src/types`目录下定义，确保类型安全和代码可读性。