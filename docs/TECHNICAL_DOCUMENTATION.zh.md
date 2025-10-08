# 技术文档

## 1. 项目概述

`SEO Manager` 是一个 Node.js 应用程序，旨在自动化博客文章的 SEO（搜索引擎优化）元数据生成、验证和发布。它与 Halo CMS API 集成，并利用大型语言模型（LLM）智能地为文章生成优化的 `metaTitle`、`metaDescription` 和 `keywords`，确保这些元数据符合 SEO 最佳实践。该项目的核心价值在于提高内容的可发现性，减轻内容创作者手动优化 SEO 的负担，从而提升网站的搜索引擎排名和流量。

## 2. 项目架构

该项目采用模块化设计，主要模块及其职责如下：

*   **`src/index.ts`** (主入口):
    *   项目的启动点，负责初始化所有核心组件，如数据库、Halo 客户端、SEO 优化器、验证器和发布器。
    *   协调整个工作流程，包括从 Halo 获取文章、将文章保存到数据库、启动调度器进行 SEO 优化，并在程序终止时进行优雅关闭。
*   **`src/scheduler.ts`** (调度器):
    *   定期（默认为每小时）扫描数据库中需要进行 SEO 优化的文章。
    *   维护一个任务队列 (`taskQueue`)，将符合条件的文章加入队列。
    *   以固定间隔（每 10 秒）处理队列中的文章，触发 SEO 优化、验证和发布流程。
    *   实现优雅的启动和停止机制，确保在程序关闭时等待当前任务完成。
*   **`src/haloClient.ts`** (Halo API 交互):
    *   封装了与 Halo CMS API 的所有交互逻辑。
    *   提供获取文章列表、获取特定文章内容、从原始 Halo 数据中提取标准化文章信息 (`ArticleData`) 以及更新文章 SEO 元数据等功能。
    *   处理 API 请求的认证（使用 API 令牌）和错误日志记录。
    *   在提取文章数据时，会过滤掉已删除或未发布的文章，并生成文章内容的 SHA256 哈希值以检测内容变更。
*   **`src/seoOptimizer.ts`** (LLM 元数据生成):
    *   负责与 OpenAI（或其他兼容 OpenAI API 的 LLM 服务）进行交互，利用大型语言模型为文章生成 SEO 元数据。
    *   根据文章内容生成 `metaTitle`、`metaDescription`、`keywords` 和 `slug`。
    *   内置重试机制（指数退避策略），以应对 LLM API 调用失败的情况。
    *   强制 LLM 输出 JSON 格式的元数据，并对 `metaDescription` 的长度有严格要求（80-160 字符）。
*   **`src/seoValidator.ts`** (SEO 元数据验证):
    *   对 LLM 生成的 SEO 元数据进行严格的格式和长度校验。
    *   校验规则包括：
        *   `metaTitle`：非空，长度不超过 60 字符。
        *   `metaDescription`：非空，长度在 80 到 160 字符之间（严格）。
        *   `keywords`：非空数组，包含 2 到 5 个关键词，每个关键词非空。
        *   `slug`：非空，符合简短英文单词加连字符的格式（例如 `my-article-slug`）。
*   **`src/seoPublisher.ts`** (SEO 元数据发布):
    *   负责将经过优化和验证的 SEO 元数据发布回 Halo CMS。
    *   通过调用 `HaloClient` 的 `updatePostSeoMeta` 方法实现。
    *   在发布过程中记录成功或失败的日志。
*   **`src/database.ts`** (数据库管理):
    *   使用 SQLite 作为数据存储，负责数据库的初始化、表的创建（`articles`、`seo_runs`、`settings`）。
    *   提供文章的保存、获取、更新等 CRUD 操作。
    *   管理 SEO 运行记录，包括每次优化的状态、错误信息、LLM 调用次数、token 使用量、耗时、尝试次数和模型版本。
    *   提供获取需要优化文章的逻辑，根据上次优化时间、内容变更和强制重新优化设置来筛选文章。
    *   管理应用程序设置，如最小/最大内容长度、最小优化间隔天数和强制重新优化标志。
*   **`src/logger.ts`** (日志系统):
    *   基于 Winston 实现统一的、分模块的日志记录系统。
    *   支持多种日志级别（`fatal`, `error`, `warn`, `info`, `debug`, `trace`）。
    *   日志文件按模块和日期轮转，方便管理和追溯。
    *   控制台输出支持颜色区分，提高可读性。
    *   提供 `log` 函数用于通用日志记录，以及 `logLLMSeoGeneration` 专门用于记录 LLM 生成的 SEO 元数据，以便单独分析。
    *   详细的日志策略总结见“日志记录策略”部分。
*   **`src/types/seo.ts`** (类型定义):
    *   定义了 `SeoMeta` 接口，规范了 SEO 元数据的结构（`metaTitle`, `metaDescription`, `keywords`, `slug`）。

## 3. 已实现功能

### Halo API 交互

*   **获取文章列表**: 通过 `HaloClient.getAllPosts` 方法从 Halo CMS 获取多页文章数据，支持分页和延迟以避免 API 限流。
*   **获取文章内容**: `HaloClient.getPostContent` 方法能根据文章 ID 获取文章的详细内容，并尝试从不同路径提取内容以确保兼容性。
*   **更新 SEO 元数据**: `HaloClient.updatePostSeoMeta` 方法负责将优化后的 SEO 元数据（`metaTitle`, `metaDescription`, `keywords`, `slug`）通过 PATCH 请求更新回 Halo CMS 的文章。`metaDescription` 和 `keywords` 通过 `annotations` 存储。

### LLM 元数据生成

*   **向 LLM 发送请求**: `SeoOptimizer.optimizeArticle` 方法构建详细的 Prompt，包含对 SEO 元数据的生成要求（长度、格式等），并发送给配置的 OpenAI 兼容 API 端点。
*   **接收 LLM 响应**: 接收 LLM 返回的 JSON 格式响应。
*   **解析 LLM 输出**: 将 LLM 返回的 JSON 字符串解析为 `SeoMeta` 对象。
*   **重试机制**: 内置指数退避重试逻辑，增加 LLM 调用成功的健壮性。

### 文章数据处理

*   **从 Halo 原始数据中提取文章信息**: `HaloClient.extractArticleData` 方法解析原始的 Halo 文章对象，提取出 `article_id`、`title`、`content`、`excerpt`、`tags`、`categories`、`url`、`slug` 等关键信息。
*   **过滤文章**: 在提取过程中，会自动跳过 `deleted` 或 `unpublished` 的文章。
*   **生成内容哈希**: 为文章内容生成 SHA256 哈希，用于后续判断文章内容是否发生变化，从而决定是否需要重新优化。
*   **保存文章到数据库**: `DatabaseManager.saveArticle` 方法将提取并处理后的文章数据保存或更新到本地 SQLite 数据库的 `articles` 表中。

### SEO 元数据验证

*   `SeoValidator.validateSeoMeta` 方法对 LLM 生成的 `SeoMeta` 对象进行多项严格校验：
    *   `metaTitle`：检查是否为空，长度是否超过 60 字符。
    *   `metaDescription`：检查是否为空，长度是否严格在 80 到 160 字符之间。
    *   `keywords`：检查是否为非空数组，长度是否在 2 到 5 之间，且每个关键词是否非空。
    *   `slug`：检查是否为空，并使用正则表达式验证其是否符合简短英文单词加连字符的格式。

### 最终发布

*   `SeoPublisher.publishSeoMeta` 方法将经过 `SeoOptimizer` 生成和 `SeoValidator` 验证的 SEO 元数据，通过 `HaloClient` 发布到 Halo CMS。

### 调度器操作

*   **任务启动**: `Scheduler.start` 方法启动一个 cron 定时任务（默认每小时执行一次）和一个队列处理器（每 10 秒执行一次），立即触发一次文章入队操作。
*   **任务停止**: `Scheduler.stop` 方法停止 cron 任务和队列处理器，并等待任何正在处理的任务完成，确保优雅关闭。
*   **文章入队**: `Scheduler.enqueueArticlesForOptimization` 方法查询数据库中需要优化的文章（根据上次优化时间、内容哈希变化和强制重新优化设置），并将其加入内部任务队列。
*   **文章出队与处理**: `Scheduler.processQueue` 方法从任务队列中取出文章，依次执行 LLM 优化、SEO 验证和 SEO 发布流程。
*   **重试机制**: `SeoOptimizer` 内部包含 LLM 调用的重试机制。
*   **状态记录**: 每次文章处理完成后，无论成功或失败，都会通过 `DatabaseManager.recordSeoRun` 记录详细的运行状态、错误信息以及 LLM 相关的指标。

### 数据库操作

*   **初始化**: `DatabaseManager.initDatabase` 方法负责创建 `seo_manager.db` 文件（如果不存在），并初始化 `articles`、`seo_runs` 和 `settings` 表，同时创建必要的索引。
*   **保存文章**: `DatabaseManager.saveArticle` 用于将文章数据插入或更新到 `articles` 表。
*   **获取文章**: `DatabaseManager.getAllArticles` 和 `DatabaseManager.getArticleById` 用于查询文章数据。
*   **记录 SEO 运行状态**: `DatabaseManager.recordSeoRun` 记录每次 SEO 优化尝试的详细结果，包括生成的 SEO 元数据、状态（成功、失败、验证失败等）、错误信息和 LLM 使用指标。
*   **管理设置**: `DatabaseManager` 管理应用程序的运行时设置，如 `min_content_length`、`max_content_length`、`min_days_since_last_optimization` 和 `force_reoptimize`，并提供 `getSetting` 和 `setSetting` 方法。

### 日志记录策略

项目采用 Winston 作为日志库，实现了详细且分层的日志记录策略：

*   **文件分工**:
    *   `application.%DATE%.log`: 记录通用应用程序级别的日志（`info` 及以上级别），不包含特定模块的详细调试信息。
    *   `[moduleName].%DATE%.log`: 为每个核心模块（`haloClient`, `llmService`, `seoValidator`, `seoPublisher`, `scheduler`, `database` 等）创建独立的日志文件。这些文件默认记录 `debug` 及以上级别的所有详细信息，便于模块级别的故障排查。
    *   `llmSeoGenerations.%DATE%.log`: 专门用于记录 LLM 生成的 SEO 元数据，级别为 `info`。通过 `logLLMSeoGeneration` 函数写入，其内容结构包含 `seoMeta` 对象，便于后续分析 LLM 输出质量。
    *   `exceptions.%DATE%.log`: 记录未捕获的异常。
    *   `rejections.%DATE%.log`: 记录未处理的 Promise 拒绝。
*   **命名**: 日志文件采用 `[moduleName].YYYY-MM-DD.log` 格式，并支持日志文件按日期轮转和压缩归档。
*   **内容结构**: 每条日志消息都包含时间戳、日志级别、模块名称和消息内容。对于包含额外上下文信息（`meta`）的日志，这些信息会以 JSON 字符串形式附加在消息之后，方便结构化分析。
*   **级别应用**:
    *   `fatal`, `error`, `warn`: 用于指示严重错误、警告和潜在问题。
    *   `info`: 用于记录应用程序的关键事件和状态变化。
    *   `debug`: 用于记录详细的执行流程和变量状态，主要用于开发和调试。
    *   `trace`: (新增) 用于记录最细粒度的代码执行路径，提供更深入的调试信息。
*   **控制台输出**: 控制台默认只显示 `info` 及以上级别的日志，并使用颜色区分不同级别，便于实时监控关键信息。

## 4. 未来展望 (可选)

*   **更丰富的 LLM 集成**: 探索支持更多 LLM 提供商，如 Google Gemini、Claude 等，提供更灵活的选择。
*   **可配置的 SEO 规则**: 允许用户通过配置文件或 UI 自定义 SEO 验证规则（例如 `metaDescription` 的长度范围）。
*   **性能监控与报告**: 增加 LLM 调用成本、响应时间等性能指标的监控和报告功能。
*   **Webhook 通知**: 在 SEO 优化完成后（成功或失败）向指定 Webhook 发送通知。
*   **UI 界面**: 开发一个简单的 Web 界面，用于查看优化状态、管理设置和手动触发优化。
