import { SeoValidator } from '../seoValidator';
import { SeoMeta } from '../types/seo';

describe('SeoValidator', () => {
  let validator: SeoValidator;

  beforeEach(() => {
    validator = new SeoValidator();
  });

  it('marks perfectly formatted meta data as valid', () => {
    const meta: SeoMeta = {
      metaTitle: 'Lo-fi Synth Pads for Night Production',
      metaDescription: 'Explore lush lo-fi synth pad presets, workflow tips, and mixing tricks to add dreamy texture to every late-night production session.',
      keywords: ['lofi synth', 'pad presets', 'music production'],
      slug: 'lofi-synth-pad-production-guide',
    };

    const report = validator.validateSeoMetaReport(meta);
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(validator.validateSeoMeta(meta)).toBe(true);
  });

  it('returns detailed reasons when meta data violates requirements', () => {
    const invalidMeta: SeoMeta = {
      metaTitle: '',
      metaDescription: 'Too short',
      keywords: [''],
      slug: 'Invalid Slug',
    };

    const report = validator.validateSeoMetaReport(invalidMeta);
    expect(report.valid).toBe(false);
    expect(report.errors.length).toBeGreaterThanOrEqual(4);

    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'metaTitle', code: 'empty' }),
        expect.objectContaining({ field: 'metaDescription', code: 'length_range' }),
        expect.objectContaining({ field: 'keywords', code: 'count_range' }),
        expect.objectContaining({ field: 'keywords', code: 'item_empty' }),
        expect.objectContaining({ field: 'slug', code: 'pattern' }),
      ])
    );

    const detailed = validator.validateSeoMetaDetailed(invalidMeta);
    expect(detailed.valid).toBe(false);
    expect(detailed.errors.some(entry => entry.includes('metaTitle'))).toBe(true);
  });
});
