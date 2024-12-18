import  WebClipperPlugin  from './main';

export class ProcessNodeHelper {

  private plugin: WebClipperPlugin;
  private recentLinks: Set<string> = new Set();
  private seenImages: Set<string> = new Set();
  private firstImageProcessed: boolean = false;

  constructor(plugin: WebClipperPlugin) {
    this.plugin = plugin;
  }
  resetProcessingFlags(): void {
    this.firstImageProcessed = false;
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

    let content = '';
    const element = node as HTMLElement;

    switch (element.tagName) {
      case 'BLOCKQUOTE': {
        const quoteContent = Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')
          .trim();
              if (quoteContent) {
          content += `> ${quoteContent.replace(/\n/g, '\n> ')}\n\n`;
        }
        break;
      }
      case 'A': {
        const href = element.getAttribute('href');
        const text = element.textContent?.trim() || '';
        
        if (href && text) {
          const previousTextNode = element.previousSibling;
          const nextTextNode = element.nextSibling;
          const prefixSpace = this.shouldAddSpace(previousTextNode);
          const suffixSpace = this.shouldAddSpace(nextTextNode);
          const absoluteLink = this.resolveUrl(baseUrl, href);
        
          if (!this.isRepeatedLink(text, absoluteLink)) {
            content += `${prefixSpace}[${text}](${absoluteLink})${suffixSpace}`;
          }
        }
        break;
      }
      case 'STRONG': {
        content += `**${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}**`;
        break;
      }
      case 'EM': {
        content += `*${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}*`;
        break;
      }
      case 'H1': {
        content += `# ${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}\n\n`;
        break;
      }
      case 'H2': {
        content += `## ${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}\n\n`;
        break;
      }
      case 'H3': {
        content += `### ${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}\n\n`;
        break;
      }
      case 'H4': {
        content += `#### ${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}\n\n`;
        break;
      }
      case 'H5': {
        content += `##### ${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}\n\n`;
        break;
      }
      case 'H6': {
        content += `###### ${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}\n\n`;
        break;
      }
      case 'TABLE': {
        content += this.processTableElement(element as HTMLTableElement);
        break;
      }
      case 'UL': {
        content += Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .filter(item => item.trim())
          .map(item => `- ${item.trim()}`)
          .join('\n') + '\n\n';
        break;
      }
      case 'OL': {
        content += Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .filter(item => item.trim())
          .map(item => `- ${item.trim()}`)
          .join('\n') + '\n\n';
        break;
      }
      case 'P': {
        content += Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('') + '\n\n';
        break;
      }
      case 'BR': {
        content += '\n';
        break;
      }
      case 'HR': {
        content += '---\n\n';
        break;
      }
      case 'IMG': {
        const imgSrc = this.resolveImageSrc(node as HTMLImageElement, baseUrl);
        if (imgSrc) {
          const altText = (node as HTMLImageElement).getAttribute('alt') || 'Image';
  
          if ((node as HTMLImageElement).closest('.heading,[class*="thumbnailImage"]') || 
              altText.toLowerCase() === 'heading') {
            break;
          }
  
          if (!this.firstImageProcessed) {
            this.firstImageProcessed = true;
            break;
          }
  
          if (!this.seenImages.has(imgSrc)) {
            content += `![${altText}](${imgSrc})\n\n`;
            this.seenImages.add(imgSrc);
          }
        }
        break;
      }

      case 'FIGCAPTION': {
        content += `*${Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('')}*\n\n`;
        break;
      }
      case 'IFRAME': {
        const iframeSrc = element.getAttribute('src');
        const iframeTitle = element.getAttribute('title') || 'Embedded Video/Content';
        
        if (iframeSrc) {
    
      
          content += `<iframe src="${iframeSrc}" title="${iframeTitle}"></iframe>\n\n`;
        }
        break;
      }
      
      case 'CODE': {
        const codeContent = element.textContent || '';
        content += `\`\`\`\n${codeContent.trim()}\n\`\`\`\n\n`;
        break;
      }
      case 'PRE': {
        const preContent = Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('');
        content += `\`\`\`\n${preContent.trim()}\n\`\`\`\n\n`;
        break;
      }
      default: {
        content += Array.from(element.childNodes)
          .map(child => this.processNode(child, baseUrl))
          .join('');
        break;
      }
    }
    return content;
  }





  private shouldAddSpace(node: Node | null): string {
    if (!node) return '';
    
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      return text && !text.endsWith(' ') ? ' ' : '';
    }
    
    return '';
  }
    






  private isRepeatedLink(text: string, link: string): boolean {
    const linkKey = `${text}:${link}`;
    if (this.recentLinks.has(linkKey)) {
      return true;
    }
    this.recentLinks.add(linkKey);
    if (this.recentLinks.size > 10) {
      const oldestLink = this.recentLinks.values().next().value;
      this.recentLinks.delete(oldestLink);
    }
    
    return false;
  }







  private resolveImageSrc(img: HTMLImageElement, baseUrl: string): string {
    const possibleSrcAttributes = [
      'data-src', 'src', 'data-original',
      'data-lazy', 'data-fallback-src',
      'srcset' 
    ];
  
    for (const attr of possibleSrcAttributes) {
      let src = img.getAttribute(attr);
      
      if (attr === 'data-src' && !src) {
        src = img.getAttribute('src');
      }
  
      if (attr === 'srcset' && src) {
        src = src.split(',')[0].trim().split(' ')[0];
      }
      
      if (src) {
        if (src.startsWith('data:') || src.startsWith('http')) {
          return src;
        }
        
        return this.resolveUrl(baseUrl, src);
      }
    }
    return '';
  }











  private processTableElement(tableElement: HTMLTableElement): string {
    let tableContent = '\n\n';
    const thead = tableElement.querySelector('thead');
    const tbody = tableElement.querySelector('tbody');

    if (thead) {
      const headerRows = thead.querySelectorAll('tr');
      headerRows.forEach(row => {
        const headerCells = Array.from(row.querySelectorAll('th,td'));
        const headerContent = headerCells
          .map(cell => cell.textContent?.trim().replace(/\|/g, '\\|') || '')
          .join('|');
        const headerSeparator = headerCells.map(() => '---').join('|');
        tableContent += `${headerContent}\n${headerSeparator}\n`;
      });
    }



    const bodyRows = tbody
      ? tbody.querySelectorAll('tr')
      : tableElement.querySelectorAll('tr');

    bodyRows.forEach((row, index) => {
      if (thead && index < thead.querySelectorAll('tr').length) return;

      const cells = Array.from(row.querySelectorAll('th,td'));
      const rowContent = cells
        .map(cell => cell.textContent?.trim().replace(/\|/g, '\\|') || '')
        .join('|');

      tableContent += `${rowContent}\n`;
    });

    tableContent += '\n';
    return tableContent;
  }




  private resolveUrl(base: string, relative: string): string {
    try {
      return new URL(relative, base).toString();
    } catch {
      return relative;
    }
  }

}