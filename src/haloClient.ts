/**
 * Halo CMS API客户端模块
 * 负责与Halo内容管理系统的API进行交互，获取文章数据
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { SeoMeta } from './types/seo'; // Import SeoMeta
import { log } from './logger'; // Import the unified logger
import { dataDiff, Operation } from './jsonPatch'; // Import dataDiff and Operation for JSON Patch

/**
 * @description Halo文章数据接口。
 * @description English: Halo post data interface.
 * @interface HaloPost
 */
interface HaloPost {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    annotations?: {
      [key: string]: string;
    };
    [key: string]: unknown;
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
    [key: string]: unknown;
  };
  status: {
    excerpt?: string;
    permalink?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * @description 定义新的接口来匹配 extractArticleData 的输入结构。
 * @description English: Defines a new interface to match the input structure of extractArticleData.
 * @interface RawHaloPostData
 */
interface RawHaloPostData {
  post: HaloPost;
  categories: { spec: { displayName: string } }[];
  tags: { spec: { displayName: string } }[];
  [key: string]: unknown;
}

/**
 * @description 文章数据接口，用于存储从Halo CMS提取的文章信息。
 * @description English: Article data interface, used to store article information extracted from Halo CMS.
 * @interface ArticleData
 */
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

/**
 * @description Halo CMS API客户端模块。负责与Halo内容管理系统的API进行交互，获取文章数据并更新SEO元数据。
 * @description English: Halo CMS API client module. Responsible for interacting with Halo CMS API to fetch post data and update SEO meta data.
 */
export class HaloClient {
  private baseUrl: string;
  private apiToken: string | null;
  private axiosInstance: AxiosInstance;

  /**
   * @description 初始化Halo客户端。
   * @description English: Initialize Halo client.
   * @param {string} baseUrl - Halo站点的基础URL。
   * @param {string | null} [apiToken=null] - API令牌（如果需要认证）。
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
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
    });

    // 中文注释：添加响应拦截器处理错误
    // English comment: Add response interceptor to handle errors
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (err) => {
        log('error', 'HaloClient', 'API request error:', {
          data: err.response?.data,
          message: err.message,
          stack: err.stack,
        });
        return Promise.reject(err);
      },
    );
  }

  /**
   * @description 发送HTTP请求的内部方法。
   * @description English: Internal method to send HTTP requests.
   * @template T - 响应数据的类型。
   * @param {string} method - HTTP方法 (GET, POST, PUT, PATCH, DELETE)。
   * @param {string} endpoint - API端点。
   * @param {Record<string, unknown>} [config={}] - 请求配置，例如数据、头部等。
   * @returns {Promise<AxiosResponse<T> | null>} Axios响应对象或null。
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    config: Record<string, unknown> = {},
  ): Promise<AxiosResponse<T> | null> {
    const url = `${this.baseUrl}${endpoint}`;
    log('debug', 'HaloClient', `Making request: ${method} ${url}`);
    try {
      const response = await this.axiosInstance({
        method,
        url: endpoint,
        ...config,
      });
      return response;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorResponse = (err as Record<string, unknown>)
        ?.response as Record<string, unknown>;
      log('error', 'HaloClient', `Request to ${url} failed:`, {
        error: errorResponse?.data || errorMessage,
        url: url,
        method: method,
        stack: errorStack,
      });
      throw err; // Rethrow the error to be handled by the calling function
    }
  }

  /**
   * @description 获取文章列表。
   * @description English: Get list of posts.
   * @param {number} [page=1] - 页码。
   * @param {number} [size=10] - 每页大小。
   * @returns {Promise<Record<string, unknown> | null>} 文章列表数据或null。
   */
  async getPosts(
    page: number = 1,
    size: number = 10,
  ): Promise<Record<string, unknown> | null> {
    const endpoint = `/apis/api.console.halo.run/v1alpha1/posts?page=${page}&size=${size}`;
    try {
      const response = await this.makeRequest<Record<string, unknown>>(
        'GET',
        endpoint,
      );
      return response ? response.data : null;
    } catch {
      // The interceptor will log the error, so we just return null here.
      return null;
    }
  }

  /**
   * @description 获取特定文章的内容。
   * @description English: Get content of a specific post.
   * @param {string} postName - 文章的名称。
   * @returns {Promise<string>} 文章内容，如果获取失败则返回空字符串。
   */
  async getPostContent(postName: string): Promise<string> {
    // 中文注释：尝试两种可能的端点
    // English comment: Try two possible endpoints
    const endpoints = [
      `/apis/content.halo.run/v1alpha1/posts/${postName}`, // 更新为新的API端点
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest<Record<string, unknown>>(
          'GET',
          endpoint,
        );
        if (response && response.data) {
          let content: string | undefined;
          const responseData = response.data as Record<string, unknown>;
          // 尝试从不同的路径提取内容
          // 检查 content 字段，如果存在且为字符串，则直接使用
          if (typeof responseData.content === 'string') {
            content = responseData.content;
          } else if (
            responseData.content &&
            typeof (responseData.content as Record<string, unknown>).raw ===
              'string'
          ) {
            // 如果 content 是一个对象，且其 raw 属性为字符串，则使用 raw 属性
            content = (responseData.content as Record<string, unknown>)
              .raw as string;
          } else if (
            responseData.spec &&
            (responseData.spec as Record<string, unknown>).content &&
            typeof (
              (responseData.spec as Record<string, unknown>).content as Record<
                string,
                unknown
              >
            ).raw === 'string'
          ) {
            // 如果内容在 spec.content.raw 中
            content = (
              (responseData.spec as Record<string, unknown>).content as Record<
                string,
                unknown
              >
            ).raw as string;
          }

          if (content !== undefined) {
            log(
              'info',
              'HaloClient',
              `Successfully extracted content for post ${postName} from endpoint: ${endpoint}.`,
              {
                postName: postName,
                endpoint: endpoint,
                contentLength: content.length,
                contentType: typeof content,
              },
            );
            return content;
          } else {
            log(
              'warn',
              'HaloClient',
              `Extracted content for post ${postName} from endpoint: ${endpoint} is not a string or could not be found.`,
              {
                postName: postName,
                endpoint: endpoint,
                contentType: typeof content,
                rawData: response.data,
              },
            );
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        const errorResponse = (err as Record<string, unknown>)
          ?.response as Record<string, unknown>;
        log(
          'warn',
          'HaloClient',
          `Failed to fetch content for post ${postName} from endpoint: ${endpoint}.`,
          {
            postName: postName,
            endpoint: endpoint,
            error: (errorResponse?.status as string) || errorMessage,
            stack: errorStack,
          },
        );
      }
    }

    log(
      'error',
      'HaloClient',
      `Could not fetch content for post: ${postName} after trying all endpoints.`,
      { postName: postName },
    );
    return ''; // 获取内容失败时返回空字符串
  }

  /**
   * @description 获取所有文章（分页）。
   * @description English: Get all posts (paginated).
   * @param {number} [maxPages=10] - 最大页数。
   * @returns {Promise<RawHaloPostData[]>} 所有文章的数据数组。
   */
  async getAllPosts(maxPages: number = 10): Promise<RawHaloPostData[]> {
    const allPosts: RawHaloPostData[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let postsData;
      try {
        postsData = await this.getPosts(page, 20);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        log('error', 'HaloClient', `Error fetching posts on page ${page}:`, {
          page: page,
          error: errorMessage,
          stack: errorStack,
        });
        break; // Stop fetching if an error occurs
      }

      if (!postsData || !postsData.items) {
        break;
      }

      const posts: RawHaloPostData[] =
        postsData.items as unknown as RawHaloPostData[];
      allPosts.push(...posts);

      // 中文注释：如果当前页没有数据，则停止获取更多页面
      // English comment: Stop fetching more pages if current page has no data
      if (posts.length === 0) {
        break;
      }

      // 中文注释：添加延迟以避免API限制
      // English comment: Add delay to avoid API rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return allPosts;
  }

  /**
   * @description 从Halo文章数据中提取所需字段，并进行状态检查。
   * @description English: Extract required fields from Halo post data and perform status checks.
   * @param {RawHaloPostData} rawPostData - 原始的Halo文章数据。
   * @returns {Promise<ArticleData | null>} 提取后的文章数据，如果文章被删除或未发布，或者内容为空，则返回null。
   */
  async extractArticleData(
    rawPostData: RawHaloPostData,
  ): Promise<ArticleData | null> {
    try {
      const post = rawPostData.post;

      // 1. 文章状态检查
      // Article status check
      if (post.spec.deleted === true || post.spec.publish === false) {
        log(
          'info',
          'HaloClient',
          `Skipping deleted or unpublished article: ${post.metadata.name}`,
          { articleName: post.metadata.name },
        );
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
      const url = post.status.permalink
        ? `${this.baseUrl}${post.status.permalink}`
        : `${this.baseUrl}/${slug}`;

      // 3. 获取文章内容
      // Get article content
      const content: string = await this.getPostContent(articleId);
      if (!content) {
        log(
          'warn',
          'HaloClient',
          `Could not fetch content for article ID: ${articleId} or content is empty.`,
          { articleId: articleId },
        );
        return null; // If content cannot be fetched or is empty, return null for the entire article data
      }

      // 4. 生成内容哈希 (SHA256)
      // Generate content hash (SHA256)
      const contentHash = content
        ? crypto.createHash('sha256').update(content).digest('hex')
        : '';

      // 5. 提取分类和标签
      // Extract categories and tags
      const categories = JSON.stringify(
        rawPostData.categories.map((cat) => cat.spec.displayName),
      );
      const tags = JSON.stringify(
        rawPostData.tags.map((tag) => tag.spec.displayName),
      );

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
        force_reoptimize: false,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      log(
        'error',
        'HaloClient',
        `Error extracting article data for post: ${rawPostData.post?.metadata?.name || 'unknown'}:`,
        {
          postName: rawPostData.post?.metadata?.name || 'unknown',
          error: errorMessage,
          stack: errorStack,
        },
      );
      return null;
    }
  }
  /**
   * @description 获取单篇文章的完整信息。
   * @description English: Get complete information for a single post.
   * @param {string} postName - 文章的名称 (对应Halo的post name)。
   * @returns {Promise<Record<string, unknown> | null>} 完整的Halo文章对象，如果未找到则返回null。
   */
  async getPost(postName: string): Promise<Record<string, unknown> | null> {
    const endpoint = `/apis/content.halo.run/v1alpha1/posts/${postName}`; // 更新为新的API端点
    try {
      const response = await this.makeRequest<Record<string, unknown>>(
        'GET',
        endpoint,
      );
      if (response && response.data) {
        return response.data;
      }
      log('warn', 'HaloClient', `Post with name: ${postName} not found.`, {
        postName,
      });
      return null;
    } catch (error) {
      log('error', 'HaloClient', `Error fetching post with name: ${postName}`, {
        postName,
        error,
      });
      return null;
    }
  }

  /**
   * @description 更新文章的SEO元数据到Halo CMS，使用JSON Patch。
   * @description English: Update article's SEO meta data to Halo CMS using JSON Patch.
   * @param {string} postName - 文章的名称 (对应Halo的post name)。
   * @param {Record<string, unknown>} originalPost - 文章的原始Halo对象，用于生成JSON Patch。
   * @param {SeoMeta} seoMeta - 包含要更新的SEO元数据。
   * @returns {Promise<{ success: boolean; error?: string }>} 表示更新操作是否成功及其错误信息。
   */
  async updatePostSeoMeta(
    postName: string,
    originalPost: Record<string, unknown>,
    seoMeta: SeoMeta,
  ): Promise<{ success: boolean; error?: string }> {
    if (!postName) {
      const errorMsg = 'Invalid post name provided.';
      log('error', 'HaloClient', errorMsg, { postName });
      return { success: false, error: errorMsg };
    }
    if (!originalPost) {
      const errorMsg = `Original post data for ${postName} is missing. Cannot generate JSON Patch.`;
      log('error', 'HaloClient', errorMsg, { postName });
      return { success: false, error: errorMsg };
    }

    // 1. 创建一个基于原始文章的副本，并应用SEO元数据
    const updatedPost = JSON.parse(JSON.stringify(originalPost)); // 深拷贝
    updatedPost.apiVersion = 'content.halo.run/v1alpha1';
    updatedPost.kind = 'Post';
    updatedPost.spec.title = seoMeta.metaTitle;
    updatedPost.spec.slug = seoMeta.slug;

    if (!updatedPost.metadata.annotations) {
      updatedPost.metadata.annotations = {};
    }
    updatedPost.metadata.annotations['seo.manager.halo.run/metaDescription'] =
      seoMeta.metaDescription;
    updatedPost.metadata.annotations['seo.manager.halo.run/keywords'] =
      JSON.stringify(seoMeta.keywords);

    // 移除 status.observedVersion 字段，因为它可能由服务器端管理
    if (
      updatedPost.status &&
      updatedPost.status.observedVersion !== undefined
    ) {
      delete updatedPost.status.observedVersion;
    }

    // 2. 计算 JSON Patch
    const patchOperations: Operation[] = dataDiff(originalPost, updatedPost);

    if (patchOperations.length === 0) {
      log(
        'info',
        'HaloClient',
        `No SEO meta changes detected for article ID: ${postName}. Skipping update.`,
        { postName },
      );
      return { success: true };
    }

    const endpoint = `/apis/content.halo.run/v1alpha1/posts/${postName}`;

    try {
      log(
        'info',
        'HaloClient',
        `Sending PATCH request with payload for article ID: ${postName}`,
        { postName, patchOperations },
      );
      const response = await this.makeRequest<Record<string, unknown>>(
        'PATCH',
        endpoint,
        {
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
          data: patchOperations,
        },
      );

      if (response && response.status >= 200 && response.status < 300) {
        log(
          'info',
          'HaloClient',
          `Successfully updated SEO meta for article ID: ${postName}`,
          { postName },
        );
        return { success: true };
      } else {
        const errorMsg = `Failed to update SEO meta for article ID: ${postName}. Status: ${response?.status}`;
        log('error', 'HaloClient', errorMsg, {
          postName: postName,
          status: response?.status,
          data: response?.data,
        });
        return { success: false, error: errorMsg };
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;
      const errorResponse = (err as Record<string, unknown>)
        ?.response as Record<string, unknown>;
      const errorMsg = `Error updating SEO meta for article ID: ${postName}: ${errorMessage}`;
      log('error', 'HaloClient', errorMsg, {
        postName: postName,
        error: errorMessage,
        responseData: errorResponse?.data,
        stack: errorStack,
      });
      return { success: false, error: errorMsg };
    }
  }
}

// 中文注释：导出默认实例
// English comment: Export default instance
export default HaloClient;
