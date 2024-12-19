import WebClipperPlugin from './main';
import { ProcessNodeHelper } from './helper';

export class ContentExtractors {
  private plugin: WebClipperPlugin;
  private processNodeHelper: ProcessNodeHelper;

  constructor(plugin: WebClipperPlugin) {
    this.plugin = plugin;
    this.processNodeHelper = new ProcessNodeHelper(plugin);
  }

  extractMainContent(doc: Document, baseUrl: string): string {
    this.processNodeHelper.resetProcessingFlags();

    const mainSelectors = [
      'main', 'article', '.main-content', '#main-content',
      '.entry-content', '#productDescription', '#feature-bullets', '.markdown', '[class*="blog"]',
      '#centerCol', '.a-section.a-spacing-none', '.Blog', '[class*="blog"]'
    ];


    let mainContent = this.findMainContentElement(doc, mainSelectors);

    this.removeUnnecessaryElements(mainContent);

    return this.processNodeHelper.processNode(mainContent, baseUrl)
      .replace(/\n{5,}/g, '\n\n')
      .trim();
  }

  private findMainContentElement(doc: Document, selectors: string[]): Element {
    for (const selector of selectors) {
      const content = doc.querySelector(selector);
      if (content) return content;
    }
    return doc.body;
  }

  private removeUnnecessaryElements(mainContent: Element): void {

    mainContent.querySelectorAll('*').forEach(el => {
      if (el.className && /\brelated\b/i.test(el.className)) {
        el.remove();
      }
    });
    const elementsToRemove = [
      'script', 'style', 'svg', 'nav', 'footer', 'header', 'aside',
      '[class*="footer"]', '[class*="nav"]', '[class*="sidebar"]', '[class*="sticky"]',
      '.ad-container', '.advertisement', '.cookie-consent', '.menu', '[class*="menu"]',
      '.tags', '[class*="tags"]', '[class*="popup"]', '[class*="related"]', '.related',
      '[class*="header"]', '[class*="newsletter"]', '[class*="form"]', '[aria-label="Navigation"]',
      '[class*="share"]', '[class*="author"]', '.read-next', '[class*="read-next"]',
      '[data-module="newsletter"]', '[data-component="navigation"]', '[class*="icon"]', '.flex-col'
    ].join(',');

    const preservedTags = [
      'main', 'article', '[class*="article"]', '[class*="main"]', '.article',
      'p', 'img', 'ul', 'ol', '[class*="blog"]', '.entry-content', '.Blog',
      'header'
    ];


    // Remove elements
    mainContent.querySelectorAll(elementsToRemove).forEach(el => {
      const tagName = el.tagName.toLowerCase();
      if (!preservedTags.includes(tagName)) {
        el.remove();
      }
    });
  }





  extractDescription(doc: Document): string | null {
    const metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute('content');
    const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');

    const description = metaDescription || ogDescription;
    return description ? description.replace(/[<>#"]/g, '').trim() : null;
  }






  extractThumbnail(doc: Document): string {
    const ogImageTag = doc.querySelector('meta[property="og:image"]');
    const amazonImage = doc.querySelector('.a-dynamic-image');

    const ogImage = ogImageTag?.getAttribute('content');
    const amazonImageSrc = amazonImage?.getAttribute('src');

    return ogImage || amazonImageSrc || '';
  }









  extractPublishTime(doc: Document): string {
    const publishDate = doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content');
    return publishDate || '';
  }





  extractAuthor(doc: Document): string | null {
    const authorMeta = doc.querySelector('meta[name="author"]')?.getAttribute('content');
    const authorElement = Array.from(
      doc.querySelectorAll('[class*="Author"],[class*="author"],[id*="Author"],[id*="author"]')
    ).find(el => el.textContent?.trim());

    const byline = authorElement?.textContent?.trim();
    const possibleOrg = doc.querySelector('meta[name="publisher"],meta[property="og:site_name"]')?.getAttribute('content');

    return authorMeta || byline || possibleOrg || "";
  }





  extractPrice(doc: Document): string | null {
    const priceSelectors = [
      '.price', 'meta[itemprop="price"]', '.current-price',
      '.x-price-primary', '.priceToPay', '.a-price'
    ];

    for (const selector of priceSelectors) {
      const priceElement = doc.querySelector(selector);
      if (priceElement) {
        return priceElement.textContent?.trim() || null;
      }
    }
    return null;
  }





  extractBrand(doc: Document): string | null {
    const brandSelectors = ['#bylineInfo'];

    for (const selector of brandSelectors) {
      const brandElement = doc.querySelector(selector);
      if (brandElement) {
        const brandText = brandElement.textContent?.trim() || '';
        const brandLinkElement = brandElement.querySelector('a');
        const brandLink = brandLinkElement?.getAttribute('href');

        if (brandLink) {
          const absoluteBrandLink = this.resolveUrl(brandLink, window.location.href);
          return `[${brandText}](${absoluteBrandLink})`;
        }

        return brandText;
      }
    }
    return null;
  }





  extractRating(doc: Document): string | null {
    const ratingSelectors = [
      '#acrPopover',
      'meta[itemprop="rating"]',
      'meta[itemprop="review"]',
      '.average-rating',
      '.star-rating',
      '[class*="rating"]',
    ];

    let ratingText: string | null = null;


    for (const selector of ratingSelectors) {
      const ratingElement = doc.querySelector(selector);
      if (ratingElement) {
        const text = ratingElement.textContent?.trim();
        if (text) {
          ratingText = text;
          break;
        }
      }
    }


    if (!ratingText) {
      const starIcons = Array.from(doc.querySelectorAll('span, div')).find(
        el => el.textContent?.trim().match(/^★+$/)
      );
      if (starIcons) {
        const starCount = starIcons.textContent!.length;
        ratingText = `${starCount} out of 5 stars`;
      }
    }

    if (ratingText) {

      const numericMatch = ratingText.match(/(\d+(\.\d+)?)\s*out\s*of\s*5/i);
      if (numericMatch) {
        const numericRating = parseFloat(numericMatch[1]);
        const roundedStars = Math.round(numericRating);
        const stars = '★'.repeat(roundedStars) + '☆'.repeat(5 - roundedStars);
        return `${numericRating} out of 5 stars (${stars})`;
      }

      const starMatch = ratingText.match(/★+/);
      if (starMatch) {
        const starRating = starMatch[0].length;
        const stars = '★'.repeat(starRating) + '☆'.repeat(5 - starRating);
        return `${starRating} out of 5 stars (${stars})`;
      }
    }

    return null;
  }







  private resolveUrl(base: string, relative: string): string {
    try {
      return new URL(relative, base).toString();
    } catch {
      return relative;
    }
  }




}
