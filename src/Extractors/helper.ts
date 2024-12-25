import WebClipperPlugin from '../main';

export class ProcessNodeHelper {
  private plugin: WebClipperPlugin;
  private recentLinks: Set<string> = new Set();
  private seenImages: Set<string> = new Set();

  constructor(plugin: WebClipperPlugin) {
    this.plugin = plugin;
  }

  resetProcessingFlags(): void {
    this.seenImages.clear();
    this.recentLinks.clear();
  }

  processNode(node: Node, baseUrl: string): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').trim();
    }

    if (!(node instanceof HTMLElement)) {
      return '';
    }

    const element = node as HTMLElement;
    return this.processElement(element, baseUrl);
  }

  private processElement(element: HTMLElement, baseUrl: string): string {
    const tagProcessors: Record<string, (el: HTMLElement) => string> = {
      BLOCKQUOTE: (el) => this.processBlockquote(el, baseUrl),
      A: (el) => this.processAnchor(el, baseUrl),
      STRONG: (el) => this.processWrappedContent(el, baseUrl, '**'),
      EM: (el) => this.processWrappedContent(el, baseUrl, '*'),
      H1: (el) => this.processHeading(el, baseUrl, 1),
      H2: (el) => this.processHeading(el, baseUrl, 2),
      H3: (el) => this.processHeading(el, baseUrl, 3),
      H4: (el) => this.processHeading(el, baseUrl, 4),
      H5: (el) => this.processHeading(el, baseUrl, 5),
      H6: (el) => this.processHeading(el, baseUrl, 6),
      TABLE: (el) => this.processTable(el as HTMLTableElement, baseUrl),
      UL: (el) => this.processList(el, baseUrl, 'ul'),
      OL: (el) => this.processList(el, baseUrl, 'ol'),
      P: (el) => this.processParagraph(el, baseUrl),
      BR: () => '\n',
      HR: () => '---\n\n',
      IMG: (el) => this.processImage(el as HTMLImageElement, baseUrl),
      FIGCAPTION: (el) => this.processFigcaption(el, baseUrl),
      IFRAME: (el) => this.processIframe(el),
      VIDEO: (el) => this.processVideo(el),
      CODE: (el) => this.processCode(el),
      PRE: (el) => this.processPre(el, baseUrl),
    };

    const processor = tagProcessors[element.tagName];
    if (processor) {
      return processor(element);
    }

    return Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('');
  }

  private processBlockquote(element: HTMLElement, baseUrl: string): string {
    const content = Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('')
      .trim();
    return content ? `> ${content.replace(/\n/g, '\n> ')}\n\n` : '';
  }

  private processAnchor(element: HTMLElement, baseUrl: string): string {
    const href = element.getAttribute('href');
    const text = element.textContent?.trim() || '';

    if (!href || !text) return text;

    const absoluteLink = this.resolveUrl(baseUrl, href);
    const linkKey = `${text}:${absoluteLink}`;

    if (this.recentLinks.has(linkKey)) return text;

    this.recentLinks.add(linkKey);
    if (this.recentLinks.size > 10) {
      const oldestLink = this.recentLinks.values().next().value;
      this.recentLinks.delete(oldestLink);
    }

    const prefixSpace = this.shouldAddSpace(element.previousSibling);
    const suffixSpace = this.shouldAddSpace(element.nextSibling);
    return `${prefixSpace}[${text}](${absoluteLink})${suffixSpace}`;
  }

  private processWrappedContent(element: HTMLElement, baseUrl: string, wrapper: string): string {
    const content = Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('');
    return `${wrapper}${content}${wrapper}`;
  }

  private processHeading(element: HTMLElement, baseUrl: string, level: number): string {
    const content = Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('');
    return `${'#'.repeat(level)} ${content}\n`;
  }

  private processTable(table: HTMLTableElement, baseUrl: string): string {
    let content = '\n';
    const rows = table.rows;
    const columnCount = Math.max(...Array.from(rows).map((row) => row.cells.length));

    // Process header
    if (rows.length > 0) {
      const headerRow = rows[0];
      content += '|' + Array.from(headerRow.cells)
        .map((cell) => this.processNode(cell, baseUrl).replace(/\|/g, '\\|').trim())
        .join('|') + '|\n';
      content += '|' + Array(columnCount).fill('---').join('|') + '|\n';
    }

    for (let i = 1; i < rows.length; i++) {
      content += '|' + Array.from(rows[i].cells)
        .map((cell) => this.processNode(cell, baseUrl).replace(/\|/g, '\\|').trim())
        .join('|') + '|\n';
    }

    return content + '\n';
  }

  private processList(element: HTMLElement, baseUrl: string, type: 'ul' | 'ol'): string {
    const listItems = Array.from(element.childNodes)
      .filter((child) => child.nodeName === 'LI')
      .map((child, index) => {
        const content = this.processNode(child, baseUrl).trim();
        return type === 'ul' ? `- ${content}` : `${index + 1}. ${content}`;
      });
    return listItems.join('\n') + '\n\n';
  }

  private processParagraph(element: HTMLElement, baseUrl: string): string {
    const content = Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('');
    return `${content}\n\n`;
  }

  private resolveUrl(baseUrl: string, href: string): string {
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href; 
    }
  }

  private shouldAddSpace(sibling: Node | null): string {
    return sibling && sibling.nodeType === Node.TEXT_NODE && /\S$/.test(sibling.textContent || '') ? ' ' : '';
  }

  private processImage(element: HTMLImageElement, baseUrl: string): string {
    const src = element.getAttribute('src');
    const alt = element.getAttribute('alt') || '';
    if (!src || this.seenImages.has(src)) return '';

    this.seenImages.add(src);
    return `![${alt}](${this.resolveUrl(baseUrl, src)})\n\n`;
  }

  private processFigcaption(element: HTMLElement, baseUrl: string): string {
    return Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('') + '\n\n';
  }

  private processIframe(element: HTMLElement): string {
    const src = element.getAttribute('src');
    return src ? `[Embedded content](${src})\n\n` : '';
  }

  private processVideo(element: HTMLElement): string {
    const src = element.getAttribute('src');
    return src ? `[Video content](${src})\n\n` : '';
  }

  private processCode(element: HTMLElement): string {
    const content = element.textContent || '';
    return `\`${content.trim()}\``;
  }

  private processPre(element: HTMLElement, baseUrl: string): string {
    const content = Array.from(element.childNodes)
      .map((child) => this.processNode(child, baseUrl))
      .join('');
    return `\`\`\`\n${content.trim()}\n\`\`\`\n\n`;
  }
}
