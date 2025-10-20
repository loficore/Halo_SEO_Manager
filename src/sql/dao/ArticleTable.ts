import { Database } from 'sqlite';
import {
  INSERT_OR_REPLACE_ARTICLE,
  GET_ALL_ARTICLES,
  GET_ARTICLE_BY_ID,
  GET_EXISTING_ARTICLE_HASHES,
  DELETE_ARTICLES_BY_IDS,
  GET_ARTICLES_FOR_OPTIMIZATION,
} from './articles.sql';

export class ArticleTable {
  constructor(private db: Database) {}

  async saveArticle(articleData: {
    article_id: string;
    title: string;
    content: string;
    excerpt: string;
    tags: string;
    categories: string;
    url: string;
    slug: string;
    content_hash: string;
  }) {
    await this.db.run(INSERT_OR_REPLACE_ARTICLE, {
      article_id: articleData.article_id,
      title: articleData.title,
      content: articleData.content,
      excerpt: articleData.excerpt,
      tags: articleData.tags,
      categories: articleData.categories,
      url: articleData.url,
      slug: articleData.slug,
      content_hash: articleData.content_hash,
    });
  }

  async getAllArticles() {
    return await this.db.all(GET_ALL_ARTICLES);
  }

  async getArticleById(articleId: string) {
    return await this.db.get(GET_ARTICLE_BY_ID, { article_id: articleId });
  }

  async getExistingArticleHashes() {
    return await this.db.all(GET_EXISTING_ARTICLE_HASHES);
  }

  async deleteArticlesByIds(articleIds: string[]) {
    const placeholders = articleIds.map(() => '?').join(',');
    await this.db.run(DELETE_ARTICLES_BY_IDS(placeholders), articleIds);
  }

  async getArticlesForOptimization(forceReoptimize: boolean, minDays: number) {
    return await this.db.all(GET_ARTICLES_FOR_OPTIMIZATION, {
      force_reoptimize: forceReoptimize.toString(),
      min_days: minDays.toString(),
    });
  }
}
