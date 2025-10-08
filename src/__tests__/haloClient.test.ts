import dotenv from 'dotenv';
import { HaloClient } from '../haloClient';

dotenv.config();

const haloBaseUrl = process.env.HALO_BASE_URL;
const haloToken = process.env.HALO_API_TOKEN;

if (!haloBaseUrl || !haloToken) {
  throw new Error('HALO_BASE_URL and HALO_API_TOKEN must be set in the environment for live HaloClient tests.');
}

jest.setTimeout(60000);

describe('HaloClient live API integration', () => {
  const client = new HaloClient(haloBaseUrl, haloToken);

  it('fetches a small batch of posts and extracts normalized article data', async () => {
    const page = 1;
    const size = 2;
    const postsResponse: any = await client.getPosts(page, size);

    expect(postsResponse).toBeTruthy();
    expect(Array.isArray(postsResponse.items)).toBe(true);
    expect(postsResponse.items.length).toBeGreaterThan(0);

    const items: any[] = postsResponse.items;
    let normalized = null as Awaited<ReturnType<typeof client.extractArticleData>> | null;

    for (const raw of items) {
      const extracted = await client.extractArticleData(raw);
      if (extracted) {
        normalized = extracted;
        break;
      }
    }

    expect(normalized).not.toBeNull();
    if (!normalized) {
      return;
    }

    expect(typeof normalized.article_id).toBe('string');
    expect(normalized.article_id.length).toBeGreaterThan(0);
    expect(normalized.content.length).toBeGreaterThan(100);
    expect(normalized.content_hash.length).toBe(64);

    const parsedTags = JSON.parse(normalized.tags) as string[];
    expect(Array.isArray(parsedTags)).toBe(true);
    expect(parsedTags.length).toBeGreaterThan(0);

    const parsedCategories = JSON.parse(normalized.categories) as string[];
    expect(Array.isArray(parsedCategories)).toBe(true);
  });

  it('fetches post content separately to minimize payload size', async () => {
    const postsResponse: any = await client.getPosts(1, 1);
    expect(postsResponse?.items?.length).toBeGreaterThan(0);

    const firstPost = postsResponse.items[0];
    const postName: string = firstPost.post.metadata.name;

    const content = await client.getPostContent(postName);
    expect(typeof content).toBe('string');
    expect(content.length).toBeGreaterThan(100);
  });
});
