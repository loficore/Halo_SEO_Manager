import dotenv from 'dotenv';
import { HaloClient } from '../haloClient';
import { SeoOptimizer } from '../seoOptimizer';
import { SeoValidator } from '../seoValidator';
import { SeoMeta, SeoValidationError } from '../types/seo';

dotenv.config();

const haloBaseUrl = process.env.HALO_BASE_URL;
const haloToken = process.env.HALO_API_TOKEN;
const openaiKey = process.env.OPENAI_API_KEY;
const openaiBaseUrl = process.env.OPENAI_BASE_URL;
const openaiModel = process.env.OPENAI_MODEL_NAME;

if (!haloBaseUrl || !haloToken || !openaiKey || !openaiBaseUrl || !openaiModel) {
  throw new Error('HALO_* and OPENAI_* environment variables must be set for live SEO optimizer tests.');
}

jest.setTimeout(150000);

describe('Live SEO optimization pipeline', () => {
  const haloClient = new HaloClient(haloBaseUrl, haloToken);
  const optimizer = new SeoOptimizer({
    apiKey: openaiKey,
    baseURL: openaiBaseUrl,
    model: openaiModel,
  });
  const validator = new SeoValidator();

  it('generates validated SEO meta for a Halo article snippet with iterative feedback', async () => {
    const postsResponse: any = await haloClient.getPosts(1, 1);
    if (!postsResponse?.items?.length) {
      throw new Error('No posts returned from Halo API for integration test.');
    }

    const rawArticle: any = postsResponse.items[0];
    const articleId: string = rawArticle.post.metadata.name;
    const fullContent: string = await haloClient.getPostContent(articleId);
    expect(fullContent.length).toBeGreaterThan(200);

    const contentForOptimization = fullContent.slice(0, 2000);

    let previous: SeoMeta | null = null;
    let feedback: string[] = [];
    let finalMeta: SeoMeta | null = null;
    let finalReport: ReturnType<typeof validator.validateSeoMetaReport> | null = null;

    for (let attempt = 1; attempt <= 4; attempt++) {
      const seoMeta = await optimizer.optimizeArticle(articleId, contentForOptimization, {
        previous,
        feedback: feedback.length ? feedback : undefined,
        attempt,
      });

      expect(seoMeta).not.toBeNull();
      if (!seoMeta) {
        throw new Error('SeoOptimizer returned null meta data.');
      }

      const report = validator.validateSeoMetaReport(seoMeta);
      if (report.valid) {
        finalMeta = seoMeta;
        finalReport = report;
        break;
      }

      previous = seoMeta;
      const nextFeedback: string[] = report.errors.map((error: SeoValidationError) => {
        const details = [] as string[];
        if (error.currentLength !== undefined) {
          details.push(`currentLength=${error.currentLength}`);
        }
        if (error.requirement) {
          details.push(`requirement=${error.requirement}`);
        }
        return `${error.field} -> ${error.message}${details.length ? ` (${details.join(', ')})` : ''}`;
      });
      const metaDescriptionError = report.errors.find(err => err.field === 'metaDescription' && typeof err.currentLength === 'number');
      if (metaDescriptionError?.currentLength !== undefined) {
        const needed = Math.max(85 - metaDescriptionError.currentLength, 10);
        nextFeedback.push(`Increase metaDescription length by at least ${needed} additional characters while staying within 80-160 characters.`);
      }
      if (report.errors.some(err => err.field === 'slug')) {
        nextFeedback.push('Slug must be converted to lowercase ASCII letters and hyphens only. Remove any Chinese characters or other symbols.');
      }
      feedback = nextFeedback;
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    expect(finalMeta).not.toBeNull();
    expect(finalReport?.valid).toBe(true);

    const seoMeta = finalMeta!;
    expect(typeof seoMeta.metaTitle).toBe('string');
    expect(seoMeta.metaTitle.length).toBeGreaterThan(0);
    expect(seoMeta.metaDescription.length).toBeGreaterThanOrEqual(80);
    expect(seoMeta.metaDescription.length).toBeLessThanOrEqual(160);
    expect(Array.isArray(seoMeta.keywords)).toBe(true);
    expect(seoMeta.keywords.length).toBeGreaterThanOrEqual(2);
    expect(typeof seoMeta.slug).toBe('string');
  });
});
