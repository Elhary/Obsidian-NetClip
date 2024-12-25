import { Readability } from '@mozilla/readability';

export interface ReadabilityArticle {
  title: string | null;
  byline: string | null;
  dir: string | null;
  content: string | null;
  textContent: string | null;
  length: number;
  excerpt: string | null;
  siteName: string | null;
}

export type MediaType = 'image' | 'gif';

export interface MediaContent {
  type: MediaType;
  url: string;
  alt?: string;
  poster?: string;
  title?: string;
}

export interface PriceInfo {
  amount: string;
  currency?: string;
  type?: 'sale' | 'regular' | 'list';
}