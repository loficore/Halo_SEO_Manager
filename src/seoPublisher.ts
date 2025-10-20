/**
 * SEO信息发布模块
 * 负责将优化和校验后的SEO元数据更新到目标平台（如Halo CMS）
 */

import HaloClient from './haloClient';
import { SeoMeta } from './types/seo';
import { log } from './logger';

// 中文注释：SEO发布器类
// English comment: SEO Publisher Class
export class SeoPublisher {
  private haloClient: HaloClient;

  constructor(haloClient: HaloClient) {
    this.haloClient = haloClient;
  }

  /**
   * 中文注释：发布SEO元数据到Halo CMS
   * English comment: Publish SEO meta data to Halo CMS
   * @param articleId 文章ID / Article ID
   * @param seoMeta SEO元数据 / SEO meta data
   * @returns 发布是否成功 / Whether publishing was successful
   */
  async publishSeoMeta(article: any, seoMeta: SeoMeta): Promise<boolean> {
    const articleId = article?.metadata?.name;
    if (!articleId) {
      log(
        'error',
        'SeoPublisher',
        'Invalid article object provided to publishSeoMeta.',
        { article },
      );
      return false;
    }
    log(
      'info',
      'SeoPublisher',
      `Attempting to publish SEO meta for article ID: ${articleId}`,
      { articleId, seoMeta },
    );
    try {
      const { success, error } = await this.haloClient.updatePostSeoMeta(
        article,
        seoMeta,
      );
      if (success) {
        log(
          'info',
          'SeoPublisher',
          `Successfully published SEO meta for article ID: ${articleId}`,
          { articleId, seoMeta },
        );
        return true;
      } else {
        log(
          'error',
          'SeoPublisher',
          `Failed to publish SEO meta for article ID: ${articleId}. Reason: ${error}`,
          {
            articleId: articleId,
            error: error,
          },
        );
        return false;
      }
    } catch (error: any) {
      log(
        'error',
        'SeoPublisher',
        `Error publishing SEO meta for article ID: ${articleId}:`,
        {
          articleId: articleId,
          error: error.message,
          stack: error.stack,
        },
      );
      return false;
    }
  }
}
