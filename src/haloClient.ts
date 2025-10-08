/**
 * Halo CMS API客户端模块
 * 负责与Halo内容管理系统的API进行交互，获取文章数据
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { SeoMeta } from './types/seo'; // Import SeoMeta
import { log } from './logger'; // Import the unified logger

// 中文注释：Halo文章数据接口
// English comment: Halo post data interface
interface HaloPost {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    annotations?: {
      [key: string]: string;
    };
    [key: string]: any;
  };
  spec: {
    title: string;
    slug: string;
    excerpt?: {
      raw?: string;
    };
    tags?: string[];
    categories?: string[];
    deleted?: boolean;
    publish?: boolean;
    [key: string]: any;
  };
  status: {
    excerpt?: string;
    permalink?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// 定义新的接口来匹配 extractArticleData 的输入结构
interface RawHaloPostData {
  post: HaloPost;
  categories: { spec: { displayName: string } }[];
  tags: { spec: { displayName: string } }[];
  [key: string]: any;
}

// 中文注释：文章数据接口
// English comment: Article data interface
export interface ArticleData {
  article_id: string;
  title: string;
  content: string;
  excerpt: string;
  tags: string;
  categories: string;
  url: string;
  slug: string;
  content_hash: string;
  last_optimized: Date | null;
  force_reoptimize: boolean;
}

// 中文注释：Halo API客户端类
// English comment: Halo API client class
export class HaloClient {
  private baseUrl: string;
  private apiToken: string | null;
  private axiosInstance: AxiosInstance;

  /**
   * 中文注释：初始化Halo客户端
   * English comment: Initialize Halo client
   * @param baseUrl Halo站点的基础URL / Base URL of the Halo site
   * @param apiToken API令牌（如果需要认证） / API token (if authentication is required)
   */
  constructor(baseUrl: string, apiToken: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾的斜杠 / Remove trailing slash
    this.apiToken = apiToken;

    // 中文注释：创建axios实例
    // English comment: Create axios instance
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'User-Agent': 'SEO-Manager/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
      }
    });

    // 中文注释：添加响应拦截器处理错误
    // English comment: Add response interceptor to handle errors
    this.axiosInstance.interceptors.response.use(
      response => response,
      err => {
        log('error', 'HaloClient', 'API request error:', {
          data: err.response?.data,
          message: err.message,
          stack: err.stack
        });
        return Promise.reject(err);
      }
    );
  }

  /**
   * 中文注释：发送HTTP请求的内部方法
   * English comment: Internal method to send HTTP requests
   * @param method HTTP方法 / HTTP method
   * @param endpoint API端点 / API endpoint
   * @param config 请求配置 / Request configuration
   */
  private async makeRequest<T>(method: string, endpoint: string, config: any = {}): Promise<AxiosResponse<T> | null> {
    const url = `${this.baseUrl}${endpoint}`;
    log('debug', 'HaloClient', `Making request: ${method} ${url}`);
    try {
      const response = await this.axiosInstance({
        method,
        url: endpoint,
        ...config
      });
      return response;
    } catch (err: any) {
      log('error', 'HaloClient', `Request to ${url} failed:`, {
        error: err.response?.data || err.message,
        url: url,
        method: method,
        stack: err.stack
      });
      throw err; // Rethrow the error to be handled by the calling function
    }
  }

  /**
   * 中文注释：获取文章列表
   * English comment: Get list of posts
   * @param page 页码 / Page number
   * @param size 每页大小 / Page size
   */
  async getPosts(page: number = 1, size: number = 10): Promise<any> {
    const endpoint = `/apis/api.console.halo.run/v1alpha1/posts?page=${page}&size=${size}`;
    try {
      const response = await this.makeRequest<any>('GET', endpoint);
      return response ? response.data : null;
    } catch (error) {
      // The interceptor will log the error, so we just return null here.
      return null;
    }
  }

  /**
   * 中文注释：获取特定文章的内容
   * English comment: Get content of a specific post
   * @param postName 文章名称 / Post name
   */
  async getPostContent(postName: string): Promise<string> {
    // 中文注释：尝试两种可能的端点
    // English comment: Try two possible endpoints
    const endpoints = [
      `/apis/api.content.halo.run/v1alpha1/posts/${postName}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest<any>('GET', endpoint);
        if (response && response.data) {
          let content: string | undefined;
          // 尝试从不同的路径提取内容
          // 检查 content 字段，如果存在且为字符串，则直接使用
          if (typeof response.data.content === 'string') {
            content = response.data.content;
          } else if (response.data.content && typeof response.data.content.raw === 'string') {
            // 如果 content 是一个对象，且其 raw 属性为字符串，则使用 raw 属性
            content = response.data.content.raw;
          } else if (response.data.spec && response.data.spec.content && typeof response.data.spec.content.raw === 'string') {
            // 如果内容在 spec.content.raw 中
            content = response.data.spec.content.raw;
          }

          if (content !== undefined) {
            log('info', 'HaloClient', `Successfully extracted content for post ${postName} from endpoint: ${endpoint}.`, {
              postName: postName,
              endpoint: endpoint,
              contentLength: content.length,
              contentType: typeof content
            });
            return content;
          } else {
            log('warn', 'HaloClient', `Extracted content for post ${postName} from endpoint: ${endpoint} is not a string or could not be found.`, {
              postName: postName,
              endpoint: endpoint,
              contentType: typeof content,
              rawData: response.data
            });
          }
        }
      } catch (err: any) {
        log('warn', 'HaloClient', `Failed to fetch content for post ${postName} from endpoint: ${endpoint}.`, {
          postName: postName,
          endpoint: endpoint,
          error: err.response?.status || err.message,
          stack: err.stack
        });
      }
    }
 
    log('error', 'HaloClient', `Could not fetch content for post: ${postName} after trying all endpoints.`, { postName: postName });
    return ''; // 获取内容失败时返回空字符串
  }

  /**
   * 中文注释：获取所有文章（分页）
   * English comment: Get all posts (paginated)
   * @param maxPages 最大页数 / Maximum number of pages
   */
  async getAllPosts(maxPages: number = 10): Promise<RawHaloPostData[]> {
    const allPosts: RawHaloPostData[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let postsData;
      try {
        postsData = await this.getPosts(page, 20);
      } catch (err: any) {
        log('error', 'HaloClient', `Error fetching posts on page ${page}:`, {
          page: page,
          error: err.message,
          stack: err.stack
        });
        break; // Stop fetching if an error occurs
      }

      if (!postsData || !postsData.items) {
        break;
      }

      const posts: RawHaloPostData[] = postsData.items;
      allPosts.push(...posts);

      // 中文注释：如果当前页没有数据，则停止获取更多页面
      // English comment: Stop fetching more pages if current page has no data
      if (posts.length === 0) {
        break;
      }

      // 中文注释：添加延迟以避免API限制
      // English comment: Add delay to avoid API rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return allPosts;
  }

  /**
   * 中文注释：从Halo文章数据中提取所需字段
   * English comment: Extract required fields from Halo post data
   * @param rawPostData Halo文章数据 / Halo post data
   */
  async extractArticleData(rawPostData: RawHaloPostData): Promise<ArticleData | null> {
    try {
      const post = rawPostData.post;

      // 1. 文章状态检查
      // Article status check
      if (post.spec.deleted === true || post.spec.publish === false) {
        log('info', 'HaloClient', `Skipping deleted or unpublished article: ${post.metadata.name}`, { articleName: post.metadata.name });
        return null;
      }

      // 2. 提取基本信息
      // Extract basic information
      const articleId = post.metadata.name;
      const title = post.spec.title || '';
      // 优先使用 status.excerpt，其次使用 spec.excerpt.raw
      const excerpt = post.status.excerpt || post.spec.excerpt?.raw || '';
      const slug = post.spec.slug || '';
      // 优先使用 status.permalink，其次拼接 baseUrl 和 slug
      const url = post.status.permalink ? `${this.baseUrl}${post.status.permalink}` : `${this.baseUrl}/${slug}`;

      // 3. 获取文章内容
      // Get article content
      let content: string = await this.getPostContent(articleId);
      if (!content) {
        log('warn', 'HaloClient', `Could not fetch content for article ID: ${articleId} or content is empty.`, { articleId: articleId });
        return null; // If content cannot be fetched or is empty, return null for the entire article data
      }

      // 4. 生成内容哈希 (SHA256)
      // Generate content hash (SHA256)
      const contentHash = content ? crypto.createHash('sha256').update(content).digest('hex') : '';

      // 5. 提取分类和标签
      // Extract categories and tags
      const categories = JSON.stringify(rawPostData.categories.map(cat => cat.spec.displayName));
      const tags = JSON.stringify(rawPostData.tags.map(tag => tag.spec.displayName));

      // 6. 返回文章数据
      // Return article data
      return {
        article_id: articleId,
        title: title,
        content: content,
        excerpt: excerpt,
        tags: tags,
        categories: categories,
        url: url,
        slug: slug,
        content_hash: contentHash,
        last_optimized: null,
        force_reoptimize: false
      };
    } catch (err: any) {
      log('error', 'HaloClient', `Error extracting article data for post: ${rawPostData.post?.metadata?.name || 'unknown'}:`, {
        postName: rawPostData.post?.metadata?.name || 'unknown',
        error: err.message,
        stack: err.stack
      });
      return null;
    }
  }
  /**
   * 中文注释：获取单篇文章的完整信息
   * English comment: Get complete information for a single post
   * @param articleId 文章ID (对应Halo的post name) / Article ID (corresponds to Halo's post name)
   */
  async getPost(articleId: string): Promise<any | null> {
    const endpoint = `/apis/api.console.halo.run/v1alpha1/posts?fieldSelector=metadata.name=='${articleId}'&size=1`;
    try {
      const response = await this.makeRequest<any>('GET', endpoint);
      if (response && response.data && response.data.items && response.data.items.length > 0) {
        return response.data.items[0];
      }
      log('warn', 'HaloClient', `Post with article ID: ${articleId} not found.`, { articleId });
      return null;
    } catch (error) {
      log('error', 'HaloClient', `Error fetching post with article ID: ${articleId}`, { articleId, error });
      return null;
    }
  }

  /**
   * 中文注释：更新文章的SEO元数据到Halo CMS
   * English comment: Update article's SEO meta data to Halo CMS
   * @param articleId 文章ID (对应Halo的post name) / Article ID (corresponds to Halo's post name)
   * @param seoMeta SEO元数据 / SEO meta data
   */
  async updatePostSeoMeta(postToUpdate: any, seoMeta: SeoMeta): Promise<{ success: boolean; error?: string }> {
    const articleId = postToUpdate?.metadata?.name;
    if (!articleId) {
      const errorMsg = 'Invalid post object provided: missing metadata.name';
      log('error', 'HaloClient', errorMsg, { postObject: postToUpdate });
      return { success: false, error: errorMsg };
    }

    // 2. 直接在原始文章对象上合并SEO元数据
    // 2. Merge SEO meta data directly into the original post object
    postToUpdate.apiVersion = "content.halo.run/v1alpha1";
    postToUpdate.kind = "Post";
    postToUpdate.spec.title = seoMeta.metaTitle;
    postToUpdate.spec.slug = seoMeta.slug;

    // 确保 annotations 对象存在
    if (!postToUpdate.metadata.annotations) {
      postToUpdate.metadata.annotations = {};
    }
    postToUpdate.metadata.annotations['seo.manager.halo.run/metaDescription'] = seoMeta.metaDescription;
    postToUpdate.metadata.annotations['seo.manager.halo.run/keywords'] = JSON.stringify(seoMeta.keywords);

    const endpoint = `/apis/api.console.halo.run/v1alpha1/posts/${articleId}`;

    // 移除 status.observedVersion 字段，因为它可能由服务器端管理
    if (postToUpdate.status && postToUpdate.status.observedVersion !== undefined) {
      delete postToUpdate.status.observedVersion;
    }

    try {
      const requestPayload = { post: postToUpdate };
      log('info', 'HaloClient', 'Sending PUT request with payload:', requestPayload);
      const response = await this.makeRequest<any>('PUT', endpoint, { data: requestPayload });
      if (response && response.status >= 200 && response.status < 300) {
        log('info', 'HaloClient', `Successfully updated SEO meta for article ID: ${articleId}`, { articleId: articleId });
        return { success: true };
      } else {
        const errorMsg = `Failed to update SEO meta for article ID: ${articleId}. Status: ${response?.status}`;
        log('error', 'HaloClient', errorMsg, {
          articleId: articleId,
          status: response?.status,
          data: response?.data,
        });
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = `Error updating SEO meta for article ID: ${articleId}: ${err.message}`;
      log('error', 'HaloClient', errorMsg, {
        articleId: articleId,
        error: err.message,
        responseData: err.response?.data,
        stack: err.stack,
      });
      return { success: false, error: errorMsg };
    }
  }
}

// 中文注释：导出默认实例
// English comment: Export default instance
export default HaloClient;