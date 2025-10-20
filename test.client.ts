import { HaloClient } from './src/haloClient';
import { SeoOptimizer } from './src/seoOptimizer';
import { SeoValidator } from './src/seoValidator';
import { SeoPublisher } from './src/seoPublisher';
import { DatabaseManager } from './src/database';
import { log, Modules } from './src/logger';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  log('info', Modules.App, 'Starting single article optimization test...');

  // 1. Initialization
  const haloBaseUrl = process.env.HALO_BASE_URL;
  const haloApiToken = process.env.HALO_API_TOKEN;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiBaseUrl = process.env.OPENAI_BASE_URL;
  const openaiModelName = process.env.OPENAI_MODEL_NAME;

  if (
    !haloBaseUrl ||
    !haloApiToken ||
    !openaiApiKey ||
    !openaiBaseUrl ||
    !openaiModelName
  ) {
    log('error', Modules.App, 'Missing required environment variables.');
    return;
  }

  const haloClient = new HaloClient(haloBaseUrl, haloApiToken);
  const seoOptimizer = new SeoOptimizer({
    apiKey: openaiApiKey,
    baseURL: openaiBaseUrl,
    model: openaiModelName,
  });
  const seoValidator = new SeoValidator();
  const seoPublisher = new SeoPublisher(haloClient);
  const dbManager = new DatabaseManager();
  await dbManager.initDatabase();

  try {
    // 2. Get and cache all posts
    log('info', Modules.App, 'Fetching all posts from Halo...');
    const allPosts = await haloClient.getAllPosts();
    if (!allPosts || allPosts.length === 0) {
      log('error', Modules.App, 'Failed to fetch any posts from Halo.');
      return;
    }
    log('info', Modules.App, `Fetched ${allPosts.length} posts.`);

    // 3. Select a random post
    const targetArticleId = 'a41eb6ab-bf98-44a6-a767-da46c903c57d';
    const selectedPost = allPosts.find(
      (post) => post.post.metadata.name === targetArticleId,
    );

    if (!selectedPost) {
      log(
        'error',
        Modules.App,
        `Failed to find article with ID: ${targetArticleId}`,
      );
      return;
    }

    const articleData = await haloClient.extractArticleData(selectedPost);

    if (!articleData) {
      log(
        'error',
        Modules.App,
        'Failed to extract article data from the selected post.',
      );
      return;
    }

    const articleId = articleData.article_id;
    log(
      'info',
      Modules.App,
      `Selected article for optimization: "${articleData.title}" (ID: ${articleId})`,
    );

    // 4. Execute optimization
    log('info', Modules.App, `Optimizing article ID: ${articleId}...`);
    const seoMeta = await seoOptimizer.optimizeArticle(
      articleId,
      articleData.content,
    );

    if (!seoMeta) {
      log('error', Modules.App, 'SEO optimization failed to return metadata.');
      return;
    }
    log('info', Modules.App, 'SEO optimization successful.', { seoMeta });

    // 5. Validate SEO Meta
    const { valid, errors } = seoValidator.validateSeoMetaReport(seoMeta);
    if (!valid) {
      log(
        'error',
        Modules.App,
        `SEO meta validation failed: ${errors.map((e) => e.message).join(', ')}`,
      );
      return;
    }
    log('info', Modules.App, 'SEO meta validation successful.');

    // 6. Attempt to publish
    // Ensure that the original post object contains the content in spec.content
    // This is crucial for Halo API to accept the update without NPE.
    selectedPost.post.spec.content = articleData.content;

    log(
      'info',
      Modules.App,
      `Attempting to publish SEO meta for article ID: ${articleId}...`,
    );
    const publishSuccess = await seoPublisher.publishSeoMeta(
      selectedPost.post,
      seoMeta,
    );

    if (publishSuccess) {
      log(
        'info',
        Modules.App,
        'Test finished successfully: SEO meta published.',
      );
    } else {
      log('error', Modules.App, 'Test failed: Failed to publish SEO meta.');
    }
  } catch (error: any) {
    log('error', Modules.App, 'An unexpected error occurred during the test:', {
      message: error.message,
      stack: error.stack,
    });
  } finally {
    await dbManager.close();
  }
}

runTest();
