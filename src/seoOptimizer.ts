import OpenAI from 'openai';
import { log, logLLMSeoGeneration, Modules } from './logger';
import { SeoMeta, SeoValidationError } from './types/seo';

interface SeoOptimizerConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

/**
 * 中文注释：SEO优化器类
 * 负责分析文章内容并生成SEO元数据
 * English comment: SEO Optimizer class
 * Responsible for analyzing article content and generating SEO meta data
 */
export class SeoOptimizer {
  private openai: OpenAI;
  private model: string;
  // Retries are handled by Scheduler. Keep single-attempt here.

  constructor(config: SeoOptimizerConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model;
    log(
      'info',
      Modules.SeoOptimizer,
      'SeoOptimizer initialized with LLM configuration.',
    );
  }

  /**
   * 中文注释：优化文章的SEO元数据
   * English comment: Optimize article's SEO meta data
   * @param articleId 文章ID / Article ID
   * @param content 文章内容 / Article content
   * @returns SeoMeta对象 / SeoMeta object
   */
  async optimizeArticle(
    articleId: string,
    content: string,
    options?: {
      previous?: SeoMeta | null;
      feedback?: string[] | SeoValidationError[];
      attempt?: number;
    },
  ): Promise<SeoMeta | null> {
    const { previous, feedback, attempt } = options || {};
    log(
      'info',
      Modules.SeoOptimizer,
      `Optimizing SEO for article ID: ${articleId} using LLM.`,
      { articleId: articleId, attempt },
    );

    try {
      let feedbackLines: string[] = [];
      if (feedback && feedback.length) {
        if (typeof feedback[0] === 'string') {
          feedbackLines = (feedback as string[])
            .map((line) => line.trim())
            .filter(Boolean);
        } else {
          feedbackLines = (feedback as SeoValidationError[]).map((error) => {
            const parts: string[] = [`Field "${error.field}"`, error.message];
            if (error.currentLength !== undefined) {
              parts.push(`currentLength=${error.currentLength}`);
            }
            if (error.requirement) {
              parts.push(`requirement=${error.requirement}`);
            }
            if (
              error.currentValue !== undefined &&
              typeof error.currentValue !== 'object'
            ) {
              parts.push(`currentValue=${error.currentValue}`);
            }
            return parts.join(' | ');
          });
        }
      }

      const feedbackBlock = `### Validation Feedback\n${
        feedbackLines.length
          ? feedbackLines.map((line) => `- ${line}`).join('\n')
          : '- No previous validation feedback. Produce SEO meta that satisfies all requirements on the first try.'
      }`;

      const previousBlock = `### Previous Output\n${
        previous
          ? `${JSON.stringify(previous, null, 2)}\n(Revise this JSON directly. Only change fields required to satisfy the feedback.)`
          : 'None. Create a new SEO meta JSON from scratch that will pass validation.'
      }`;

      const fixedRequirements = `### Fixed Optimization Requirements
1) metaTitle: <= 60 characters; concise; include core keywords early.
2) metaDescription: ABSOLUTELY MUST be between 80 and 160 characters. The 80-character minimum is a strict requirement. To meet this, generate a detailed and engaging description by elaborating on the article's key points and benefits. Do not be brief; expand your response to meet the length requirement.
3) keywords: 2–5 relevant keywords; no stuffing; each non-empty string.
4) slug: lowercase English words and hyphens only; match regex ^[a-z0-9]+(?:-[a-z0-9]+)*$.
5) Keep language consistent with the article content; prefer Chinese title/description if content is Chinese.
6) Output must be valid JSON with keys exactly: metaTitle, metaDescription, keywords, slug.`;

      const attemptReminder =
        attempt && attempt > 1
          ? `Attempt ${attempt} of 3. Resolve every issue from the validation feedback without regressing any previously correct fields.`
          : '';

      const promptSections = [
        'You are an SEO assistant. Generate or revise SEO meta for the article.',
        attemptReminder,
        feedbackBlock,
        previousBlock,
        fixedRequirements,
        `### Article Content\n${content}`,
      ].filter((section) => section && section.trim().length > 0);

      const prompt = promptSections.join('\n\n');

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });

      const rawOutput = completion.choices[0].message?.content;
      if (!rawOutput) {
        throw new Error('LLM did not return any content.');
      }

      const seoMeta: SeoMeta = JSON.parse(rawOutput);
      log(
        'info',
        Modules.SeoOptimizer,
        `LLM successfully generated SEO meta for article ID: ${articleId}`,
        {
          articleId: articleId,
          seoMeta: seoMeta,
        },
      );
      logLLMSeoGeneration(`LLM generated SEO meta for ${articleId}`, seoMeta); // Log the generated SEO meta to the separate file

      // After generation, apply post-processing to enforce constraints that the LLM struggles with.
      const finalSeoMeta = this._truncateMetaDescription(seoMeta, articleId);

      return finalSeoMeta;
    } catch (err: any) {
      log(
        'error',
        Modules.SeoOptimizer,
        `LLM optimization failed for article ID: ${articleId}:`,
        {
          articleId: articleId,
          error: err.message,
          stack: err.stack,
        },
      );
      return null;
    }
  }

  /**
   * Truncates the meta description to be at most 160 characters.
   * It tries to find a natural break point (sentence or clause) to make the truncation cleaner.
   * @param seoMeta The SEO meta object.
   * @param articleId The ID of the article for logging purposes.
   * @returns The SEO meta object with the potentially truncated description.
   */
  private _truncateMetaDescription(
    seoMeta: SeoMeta,
    articleId: string,
  ): SeoMeta {
    const maxLength = 160;
    if (seoMeta.metaDescription && seoMeta.metaDescription.length > maxLength) {
      const originalLength = seoMeta.metaDescription.length;
      let truncated = seoMeta.metaDescription.substring(0, maxLength);

      // Try to find a better truncation point (sentence or clause end)
      const lastPunctuationIndex = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('。'),
        truncated.lastIndexOf(','),
        truncated.lastIndexOf('，'),
      );

      if (lastPunctuationIndex > 0) {
        truncated = truncated.substring(0, lastPunctuationIndex + 1);
      }

      seoMeta.metaDescription = truncated;
      log(
        'info',
        Modules.SeoOptimizer,
        `Truncated metaDescription for article ${articleId} to meet length requirements.`,
        {
          articleId: articleId,
          originalLength: originalLength,
          newLength: truncated.length,
          finalDescription: truncated,
        },
      );
    }
    return seoMeta;
  }
}
