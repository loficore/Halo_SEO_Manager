# SEO 管理器

## 概述

`SEO Manager` 是一个 Node.js 应用程序，旨在自动化博客文章的 SEO（搜索引擎优化）元数据生成、验证和发布。它与 Halo CMS API 集成，并利用大型语言模型（LLM）智能地为文章生成优化的 `metaTitle`、`metaDescription` 和 `keywords`，确保这些元数据符合 SEO 最佳实践。该项目的核心价值在于提高内容的可发现性，减轻内容创作者手动优化 SEO 的负担，从而提升网站的搜索引擎排名和流量。

## 功能

*   **自动化 SEO 优化**：自动为您的文章生成 SEO 元数据。
*   **Halo CMS 集成**：与 Halo CMS 无缝集成。
*   **LLM 驱动**：使用大型语言模型生成高质量的 SEO 元数据。
*   **SEO 最佳实践**：根据 SEO 最佳实践验证生成的元数据。
*   **计划任务**：按计划运行以保持您的文章优化。

## 入门

### 先决条件

*   Node.js
*   npm
*   Halo CMS 实例
*   OpenAI API 密钥

### 安装

1.  克隆存储库：

    ```bash
    git clone https://github.com/your-username/seo-manager.git
    ```

2.  安装依赖项：

    ```bash
    npm install
    ```

3.  在项目根目录中创建一个 `.env` 文件，并添加以下变量：

    ```
    HALO_BASE_URL=<your-halo-site-url>
    HALO_API_TOKEN=<your-halo-api-token>
    OPENAI_API_KEY=<your-openai-api-key>
    OPENAI_BASE_URL=<your-openai-base-url>
    OPENAI_MODEL_NAME=<your-openai-model-name>
    ```

### 使用

要启动应用程序，请运行以下命令：

```bash
npm start
```

## 贡献

欢迎贡献！请随时提交拉取请求。

## 许可证

该项目根据 MIT 许可证授权。
