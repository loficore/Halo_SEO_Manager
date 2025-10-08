/**
 * SEO Manager 主入口文件
 * 负责协调各个模块的工作流程
 */

import { DatabaseManager } from './database';
import HaloClient from './haloClient';
import { Scheduler } from './scheduler';
import { SeoPublisher } from './seoPublisher';
import { SeoOptimizer } from './seoOptimizer'; // Import SeoOptimizer
import { SeoValidator } from './seoValidator'; // Import SeoValidator
import { initLogger, log, ModuleKey } from './logger'; // Import the unified logger
import 'dotenv/config'; // Import dotenv to load environment variables

// 全局异常捕获
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// 中文注释：主函数
// English comment: Main function
async function main() {
  initLogger(); // Initialize the logger at the start
  console.log('Logger initialized - testing console output');
  console.log('Environment Variables:', {
    HALO_BASE_URL: process.env.HALO_BASE_URL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  });
  log('info', 'App', 'SEO Manager starting...');

  try {
    // 中文注释：初始化数据库
    // English comment: Initialize database
    const dbManager = new DatabaseManager();
    await dbManager.initDatabase();
    log('info', 'App', 'Database initialized successfully');

    // 中文注释：初始化Halo客户端
    // English comment: Initialize Halo client
    // 注意：请根据实际情况修改Halo站点URL和API令牌
    const haloClient = new HaloClient(
      process.env.HALO_BASE_URL || 'https://your-halo-site.com',
      process.env.HALO_API_TOKEN || null
    );
    log('info', 'App', 'Halo client initialized');

    // 中文注释：初始化SeoPublisher
    // English comment: Initialize SeoPublisher
    const seoPublisher = new SeoPublisher(haloClient);
    log('info', 'App', 'SeoPublisher initialized');

    // 中文注释：初始化SeoOptimizer和SeoValidator
    // English comment: Initialize SeoOptimizer and SeoValidator
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const openaiBaseUrl = process.env.OPENAI_BASE_URL;
    const openaiModelName = process.env.OPENAI_MODEL_NAME;
 
     if (!openaiApiKey || !openaiBaseUrl || !openaiModelName) {
       log('fatal', 'App', 'Missing OpenAI API configuration in .env file. Please check OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL_NAME.');
       process.exit(1);
     }

    const seoOptimizer = new SeoOptimizer({
      apiKey: openaiApiKey,
      baseURL: openaiBaseUrl,
      model: openaiModelName,
    });
    log('info', 'App', 'SeoOptimizer initialized');

    const seoValidator = new SeoValidator();
    log('info', 'App', 'SeoValidator initialized');

    // 中文注释：初始化并启动调度器
    // English comment: Initialize and start the scheduler
    const scheduler = new Scheduler(
      dbManager,
      haloClient,
      seoOptimizer, // Pass SeoOptimizer instance
      seoValidator, // Pass SeoValidator instance
      seoPublisher
    );
    scheduler.start();
    log('info', 'App', 'Scheduler started');

      // 冒烟测试：确保各模块日志能落盘（调试后可删除）
    function smokeTestLogs() {
      const now = new Date().toISOString();
      const items: ModuleKey[] = [
        'App',
        'HaloClient',
        'Database',
        'Scheduler',
        'SeoOptimizer',
        'SeoPublisher',
        'SeoValidator',
        'llmSeoGenerations',
      ];
      for (const m of items) {
        log('debug', m, `[SMOKE] ${m} OK ${now}`, { tag: 'smoke' });
      }
    }
    smokeTestLogs();
    

    // 中文注释：获取所有文章并保存到数据库
    // English comment: Get all posts and save to database
    log('info', 'App', 'Fetching posts from Halo...');
    const posts = await haloClient.getAllPosts(5); // 限制获取5页文章用于测试
    log('info', 'App', `Fetched ${posts.length} posts from Halo`, { count: posts.length });

    // 中文注释：处理每篇文章
    // English comment: Process each post
    for (const post of posts) {
      log('debug', 'App', 'Processing raw post data:', { post: post }); // 添加日志输出原始 post 数据
      const articleData = await haloClient.extractArticleData(post);
      log('debug', 'App', 'Extracted ArticleData:', { articleData: articleData }); // 添加日志输出 articleData 生成结果
      if (articleData) {
        await dbManager.saveArticle(articleData);
        log('info', 'App', `Saved article: ${articleData.title}`, { articleId: articleData.article_id, title: articleData.title });
      } else {
        log('warn', 'App', `Skipped saving article due to null or incomplete articleData for post: ${post.post.spec.title}`, { postTitle: post.post.spec.title, rawPost: post }); // 如果 articleData 为 null 或不完整，输出日志
      }
    }

    // 中文注释：获取并显示所有文章
    // English comment: Get and display all articles
    const articles = await dbManager.getAllArticles();
    log('info', 'App', `Total articles in database: ${articles.length}`, { count: articles.length });

    // 中文注释：显示前5篇文章
    // English comment: Display first 5 articles
    log('info', 'App', 'First 5 articles:');
    articles.slice(0, 5).forEach((article: any) => {
      log('info', 'App', `- ${article.title} (${article.article_id})`, { articleId: article.article_id, title: article.title });
    });

    // 中文注释：应用程序现在处于长期运行模式。
    // English comment: The application is now in long-running mode.
    // 调度器将定期检查需要优化的文章。
    // The scheduler will periodically check for articles to optimize.
    // 优雅关闭由 SIGINT 和 SIGTERM 进程信号处理。
    // Graceful shutdown is handled by SIGINT and SIGTERM process signals.
    log('info', 'App', 'SEO Manager is now running. Press Ctrl+C to stop.');

    // 中文注释：处理程序终止信号，确保优雅关闭
    // English comment: Handle process termination signals for graceful shutdown
    process.on('SIGINT', async () => {
      log('info', 'App', 'Received SIGINT. Shutting down gracefully...');
      await scheduler.stop(); // Ensure stop is awaited here as well
      await dbManager.close();
      process.exit(0);
    });
 
    process.on('SIGTERM', async () => {
      log('info', 'App', 'Received SIGTERM. Shutting down gracefully...');
      await scheduler.stop(); // Ensure stop is awaited here as well
      await dbManager.close();
      process.exit(0);
    });
  } catch (err: any) {
    log('error', 'App', 'Error in SEO Manager:', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
}

// 中文注释：运行主函数
// English comment: Run main function
main();