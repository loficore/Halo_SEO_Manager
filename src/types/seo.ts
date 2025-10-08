export interface SeoMeta {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  slug: string;
}

// 结构化校验错误，便于提示词针对性修正
export interface SeoValidationError {
  field: 'metaTitle' | 'metaDescription' | 'keywords' | 'slug';
  code:
    | 'empty'
    | 'too_long'
    | 'too_short'
    | 'length_range'
    | 'count_range'
    | 'item_empty'
    | 'pattern';
  message: string;
  currentValue?: any;
  currentLength?: number;
  requirement?: string;
}

export interface SeoValidationReport {
  valid: boolean;
  errors: SeoValidationError[];
}