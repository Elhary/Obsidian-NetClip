import WebClipperPlugin from '../main';
import { ProcessNodeHelper } from './helper';
import { Readability } from '@mozilla/readability';
import { ReadabilityArticle, MediaContent, PriceInfo } from './types/index';
import { CONSTANTS } from './constants';
import { DOMHelper, TextHelper } from './utils';


export class ContentExtractors {
  private plugin: WebClipperPlugin;
  private processNodeHelper: ProcessNodeHelper;
  private mediaContents = new Set<string>();

  constructor(plugin: WebClipperPlugin) {
    this.plugin = plugin;
    this.processNodeHelper = new ProcessNodeHelper(plugin);
  }

  extractMainContent(doc: Document, baseUrl: string): string {
    this.processNodeHelper.resetProcessingFlags();
    this.mediaContents.clear();

    const docClone = doc.cloneNode(true) as Document;
    docClone.querySelectorAll('img[src*=".gif"], img[data-src*=".gif"]').forEach(gif => gif.classList.add('gif'));

    const article = new Readability(docClone, {
      charThreshold: 20,
      classesToPreserve: ['markdown', 'highlight', 'code', 'gif'],
      nbTopCandidates: 5,
      maxElemsToParse: 0,
      keepClasses: true
    }).parse() as ReadabilityArticle | null;

    if (!article) return this.fallbackExtraction(doc, baseUrl);

    const container = document.createElement('div');
    DOMHelper.setContentSafely(container, article.content || '');
    const mediaElements = this.processMediaElements(container, baseUrl);
    
    return this.buildMetadata(article) + 
           this.processNodeHelper.processNode(container, baseUrl).replace(/\n{3,}/g, '\n\n').trim() + 
           mediaElements;
  }

  private processMediaElements(container: Element, baseUrl: string): string {
    const mediaElements: MediaContent[] = [];
    container.querySelectorAll('img[src*=".gif"], img[data-src*=".gif"], .gif').forEach(gif => {
      const url = DOMHelper.resolveUrl(gif.getAttribute('src') || gif.getAttribute('data-src') || '', baseUrl);
      const alt = gif.getAttribute('alt') || 'GIF';
      
      if (url && !this.mediaContents.has(url)) {
        this.mediaContents.add(url);
        mediaElements.push({ type: 'gif', url, alt });
      }
    });

    return mediaElements.map(media => `\n![${media.alt}](${media.url})\n`).join('');
  }

  

  extractThumbnail(doc: Document): string {
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
        const content = ogImage.getAttribute('content');
        return content ? `${content}?crossorigin=anonymous` : '';
    }

    const imgElements = doc.querySelectorAll('img[data-lazy-srcset], img[data-srcset], img[data-src]');
    for (const img of Array.from(imgElements)) {
        const srcset = img.getAttribute('data-lazy-srcset') || img.getAttribute('data-srcset');
        if (srcset) {
            const urls = srcset.split(',').map(entry => entry.trim().split(' ')[0]);
            const httpsUrl = urls.find(url => url.startsWith('https://'));
            if (httpsUrl) return httpsUrl;
        }
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc?.startsWith('https://')) return dataSrc;
    }

    const imgSrc = doc.querySelector('img[src^="https://"]')?.getAttribute('src');
    if (imgSrc) return imgSrc;

    return doc.querySelector('.a-dynamic-image')?.getAttribute('src') || '';
}

  extractDescription(doc: Document): string | null {
    const jsonLd = this.parseJsonLd(doc);
    const sources = [
      () => jsonLd.description || jsonLd.articleBody?.substring(0, CONSTANTS.MAX_DESCRIPTION_LENGTH),
      () => doc.querySelector('meta[name="description"]')?.getAttribute('content'),
      () => doc.querySelector('meta[property="og:description"]')?.getAttribute('content'),
      () => doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content'),
      () => DOMHelper.extractFromSelectors(doc, [
        '[itemprop="description"]',
        '.product-description',
        '#productDescription',
        '.description',
        '#description'
      ])
    ];

    const description = sources.reduce((acc, source) => acc || source(), null);
    return description ? TextHelper.cleanText(description, CONSTANTS.MAX_DESCRIPTION_LENGTH) : null;
  }

  extractPublishTime(doc: Document): string | null {
    const jsonLd = this.parseJsonLd(doc);
    const sources = [
      () => jsonLd.datePublished || jsonLd.dateCreated || jsonLd.dateModified,
      () => doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content'),
      () => doc.querySelector('meta[property="og:published_time"]')?.getAttribute('content'),
      () => doc.querySelector('time[datetime]')?.getAttribute('datetime'),
      () => DOMHelper.extractFromSelectors(doc, [
        '[itemprop="datePublished"]',
        '.published-date',
        '.post-date',
        '.article-date'
      ])
    ];

    const date = sources.reduce((acc, source) => acc || source(), null);
    return date ? new Date(date).toISOString() : null;
  }

  extractAuthor(doc: Document): string | null {
    const jsonLd = this.parseJsonLd(doc);
    const sources = [
      () => {
        const article = new Readability(doc.cloneNode(true) as Document).parse() as ReadabilityArticle;
        return article?.byline;
      },
      () => jsonLd.author?.name || (typeof jsonLd.author === 'string' ? jsonLd.author : null),
      () => doc.querySelector('meta[name="author"]')?.getAttribute('content'),
      () => DOMHelper.extractFromSelectors(doc, [
        '[itemProp="author"] [itemProp="name"]',
        '[itemProp="author"]',
        '.author-name',
        '.author',
        '[class*="author"]'
      ])
    ];

    const author = sources.reduce((acc, source) => acc || source(), null);
    return author ? TextHelper.cleanAuthor(author) : null;
  }

  extractPrice(doc: Document): string | null {
    const prices = this.extractPriceInfo(doc);
    return prices.length ? prices.map(price => 
      price.currency ? 
        `${price.currency === 'USD' ? '$' : price.currency === 'GBP' ? '£' : '€'}${price.amount}` :
        price.amount
    ).join(', ') : null;
  }

  private extractPriceInfo(doc: Document): PriceInfo[] {
    const jsonLd = this.parseJsonLd(doc);
    const prices: PriceInfo[] = [];

    if (jsonLd.offers?.price) {
      prices.push({
        amount: jsonLd.offers.price.toString(),
        currency: jsonLd.offers.priceCurrency
      });
    }

    CONSTANTS.SELECTORS.PRICE.forEach(selector => {
      const priceText = doc.querySelector(selector)?.textContent?.trim();
      if (priceText?.match(/(?:\$|€|£|USD|EUR|GBP)?\s*\d+([.,]\d{2})?/)) {
        prices.push({
          amount: TextHelper.normalizePrice(priceText),
          currency: TextHelper.extractCurrency(priceText)
        });
      }
    });

    return Array.from(new Map(
      prices.map(price => [`${price.currency || ''}${price.amount}`, price])
    ).values());
  }

  extractBrand(doc: Document): string | null {
    const jsonLd = this.parseJsonLd(doc);
    const sources = [
      () => jsonLd.brand?.name || jsonLd.manufacturer?.name,
      () => doc.querySelector('meta[property="og:brand"]')?.getAttribute('content'),
      () => doc.querySelector('meta[property="product:brand"]')?.getAttribute('content'),
      () => DOMHelper.extractFromSelectors(doc, [
        '#brand',
        '.brand',
        '[itemprop="brand"]',
        '.product-brand',
        '#bylineInfo'
      ])
    ];

    const brand = sources.reduce((acc, source) => acc || source(), null);
    return brand ? TextHelper.cleanBrand(brand) : null;
  }

  extractRating(doc: Document): string | null {
    const ratingElement = doc.querySelector([
      '#acrPopover',
      'meta[itemprop="rating"]',
      '.average-rating',
      '.star-rating',
      '[class*="rating"]'
    ].join(','));

    let rating = ratingElement?.textContent?.trim();
    if (!rating) {
      const stars = Array.from(doc.querySelectorAll('span, div'))
        .find(el => el.textContent?.trim().match(/^★+$/))?.textContent;
      if (stars) {
        rating = `${stars.length} out of 5 stars`;
      }
    }

    if (rating) {
      const numericMatch = rating.match(/(\d+(\.\d+)?)\s*out\s*of\s*5/i);
      if (numericMatch) {
        const value = parseFloat(numericMatch[1]);
        const stars = '★'.repeat(Math.round(value)) + '☆'.repeat(5 - Math.round(value));
        return `${value} out of 5 stars (${stars})`;
      }

      const starMatch = rating.match(/★+/);
      if (starMatch) {
        const value = starMatch[0].length;
        const stars = '★'.repeat(value) + '☆'.repeat(5 - value);
        return `${value} out of 5 stars (${stars})`;
      }
    }

    return null;
  }

  private buildMetadata(article: ReadabilityArticle): string {
    return [
      article.title ? `# ${article.title}\n\n` : '',
      article.byline ? `*By ${article.byline}*\n\n` : '',
      article.excerpt ? `> ${article.excerpt}\n\n` : ''
    ].join('');
  }

  private fallbackExtraction(doc: Document, baseUrl: string): string {
    const mainContent = CONSTANTS.SELECTORS.MAIN_CONTENT.reduce((acc, selector) => 
      acc || doc.querySelector(selector), doc.body as Element);

    this.cleanupElements(mainContent);
    const mediaElements = this.processMediaElements(mainContent, baseUrl);

    return this.processNodeHelper.processNode(mainContent, baseUrl)
      .replace(/\n{3,}/g, '\n\n').trim() + mediaElements;
  }

  private cleanupElements(element: Element): void {
    const removeSelectors = CONSTANTS.SELECTORS.CLEANUP.join(',');

    element.querySelectorAll(removeSelectors).forEach(el => {
      if (!el.matches('img[src*=".gif"], .gif') && !el.querySelector('img[src*=".gif"], .gif')) {
        el.remove();
      }
    });
  }

  private parseJsonLd(doc: Document): any {
    try {
      return JSON.parse(doc.querySelector('script[type="application/ld+json"]')?.textContent || '{}');
    } catch {
      return {};
    }
  }
}
