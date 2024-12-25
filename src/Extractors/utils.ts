import { CONSTANTS} from './constants'

export class DOMHelper {
    static setContentSafely(element: Element, content: string): void {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      
      while (element.firstChild) {
        element.removeChild(element.firstChild);
      }
      
      Array.from(doc.body.childNodes).forEach(node => {
        element.appendChild(document.importNode(node, true));
      });
    }
  
    static resolveUrl(url: string, base: string): string {
      if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
      try {
        return new URL(url, base).toString();
      } catch {
        return url;
      }
    }
  
    static extractFromSelectors(doc: Document, selectors: string[]): string | null {
      return selectors.reduce((acc, selector) => 
        acc || doc.querySelector(selector)?.textContent?.trim() || null, null);
    }
  }
  
  export class TextHelper {
    static cleanText(text: string, maxLength: number): string {
      return text
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, '')
        .trim()
        .substring(0, maxLength)
        .replace(/\w+$/, '')
        .trim() + (text.length > maxLength ? '...' : '');
    }
  
    static cleanAuthor(author: string): string {
      return author
        .replace(/^(by|written by|posted by|authored by)\s+/i, '')
        .replace(/\s*\|\s*\d+.*$/, '')
        .replace(/\s*\(\d+.*\)/, '')
        .replace(/\s*[,\|]\s*(staff\s+writer|contributor|guest\s+author|editor).*/i, '')
        .trim();
    }
  
    static cleanBrand(brand: string): string {
      return brand
        .replace(/^(brand|by|visit|store|shop)[:|\s]+/i, '')
        .replace(/\s*(›|»|»|·|\||\-|—)\s*.*/i, '')
        .trim();
    }
  
    static normalizePrice(price: string): string {
      const match = price.match(/\d+([.,]\d{2})?/);
      return match ? match[0].replace(/,(\d{2})$/, '.$1').replace(/^(\d+),(\d{2,})$/, '$1.$2') : '0.00';
    }
  
    static extractCurrency(text: string): string | undefined {
      const symbol = text.match(/[\$€£]|USD|EUR|GBP/)?.[0];
      return symbol ? CONSTANTS.CURRENCY_MAP[symbol as keyof typeof CONSTANTS.CURRENCY_MAP] : undefined;
    }
  }
  