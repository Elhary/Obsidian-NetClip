import {Notice, Plugin, requestUrl, WorkspaceLeaf} from 'obsidian'
import {CLIPPER_VIEW, clipperHomeView } from './view/ClipperView'
import {DEFAULT_SETTINGS, NetClipSettingTab} from './settings'
import { sanitizePath, getDomain, normalizeUrl } from './utils'
import { ContentExtractors } from './Extractors/extractors'
import { VIEW_TYPE_WORKSPACE_WEBVIEW, WorkspaceLeafWebView } from './view/EditorWebView'
import { WebViewModal } from './view/ModalWebView'

export default class NetClipPlugin extends Plugin {
  private ClipperView: clipperHomeView | null = null;
  settings: NetClipSettingTab;
  contentExtractors: ContentExtractors; 
  seenItems: Set<string> = new Set();
  private seenImages: Set<string> = new Set();

  isNewContent(content: string): boolean {
    if (this.seenItems.has(content)) {
      return false;
    }
    this.seenItems.add(content);
    return true;
  }

  processContent(content: string): string {
    const lines = content.split('\n');
    const uniqueLines = lines.filter(line => this.isNewContent(line.trim()));
    return uniqueLines.join('\n');
  }

  async onload() {
    await this.loadSettings();
    
    

    this.contentExtractors = new ContentExtractors(this);
    this.addRibbonIcon('newspaper', 'NetClip', async () => {
      await this.activateView();
    });


    
    this.addCommand({
      id: 'open-clipper',
      name: 'Open View Clipper',
      callback: () => {
        this.activateView();
      }
    });

    
    this.addCommand({
      id: 'open-web-editor',
      name: 'Open Web on editor',
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
          type: VIEW_TYPE_WORKSPACE_WEBVIEW,
          active: true
        });
        this.app.workspace.revealLeaf(leaf);
      }
    });

    
    this.addCommand({
      id: 'open-web-modal',
      name: 'Open Web on Modal',
      checkCallback: (checking) => {
        if (checking) {
          return true;
        }
        const defaultUrl = this.settings.defaultWebUrl || 'https://google.com';
        new WebViewModal(this.app, defaultUrl, this).open();
      }
    });


    
    this.registerView(CLIPPER_VIEW, (leaf) => {
      this.ClipperView = new clipperHomeView(leaf, this);
      return this.ClipperView;
    });
    
    this.registerView(VIEW_TYPE_WORKSPACE_WEBVIEW, (leaf) => 
      new WorkspaceLeafWebView(leaf, this)
    );
    

    this.addSettingTab(new NetClipSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }





  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(CLIPPER_VIEW);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      switch (this.settings.viewPosition) {
        case 'left':
          leaf = workspace.getLeftLeaf(false);
          break;
        case 'right':
          leaf = workspace.getRightLeaf(false);
          break;
        default:
          leaf = workspace.getLeaf(false);
      }
    }

    if (leaf) {
      await leaf.setViewState({
        type: CLIPPER_VIEW,
        active: true,
      });
      workspace.revealLeaf(leaf);
    } 
  }

  async clipWebpage(url: string) {
    if (!this.contentExtractors) {
      return;
    }

    new Notice("Clipping...");

    const folderPath = this.settings.defaultFolderName;
    const folderExists = this.app.vault.getAbstractFileByPath(folderPath);

    if (!folderExists) {
      await this.app.vault.createFolder(folderPath);
    }

    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      throw new Error("Invalid URL provided");
    }

    const response = await requestUrl(normalizedUrl);
    const html = response.text;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    let title = doc.querySelector('title')?.textContent || '';

    if (!title) {
      const headingElement = doc.querySelector('h1') || doc.querySelector('.title');
      if (headingElement && headingElement.textContent) {
        title = headingElement.textContent.trim();
      }
    }

    if (!title) {
      title = `Article from ${getDomain(url)}`;
    }

    title = title.replace(/[#"]/g, '').trim();


    const content = this.contentExtractors.extractMainContent(doc, normalizedUrl);
    const thumbnailUrl = this.contentExtractors.extractThumbnail(doc);
    const author = this.contentExtractors.extractAuthor(doc);
    const desc = this.contentExtractors.extractDescription(doc);
    const publishTime = this.contentExtractors.extractPublishTime(doc);
    const price = this.contentExtractors.extractPrice(doc);
    const brand = this.contentExtractors.extractBrand(doc);
    const rating = this.contentExtractors.extractRating(doc);

    const wordCount = content.split(/\s+/).length;
    const minReadTime = Math.floor(wordCount / 250);
    const maxReadTime = Math.ceil(wordCount / 200);
    const readingTime = minReadTime === maxReadTime
    ?`${minReadTime}`
    :`${minReadTime}~${maxReadTime}`;


    const fileName = sanitizePath(`${title}.md`);
    const filePath = `${folderPath}/${fileName}`;


  
    await this.app.vault.create(
      filePath,
      `---\n` +
      `title: "${title}"\n` +
      `source: "${url}"\n` +
      (publishTime ? `published: ${publishTime}\n` : '') + 
      (author ? `author: "${author}"\n` : '') +
      (desc ? `desc: "${desc}"\n` : '') +
      (readingTime ? `readingTime: "${readingTime}min"\n` : '') +
      (price ? `price: "${price}"\n` : '') +
      (brand ? `brand: "${brand}"\n` : '') +
      (rating ? `brand: "${rating}"\n` : '') +
      `---\n\n` +
      (thumbnailUrl ? `![Thumbnail](${thumbnailUrl})\n\n` : '') +
      `${content}`
    );

    await this.updateHomeView();
    new Notice(`Successfully clipped ${title}`);
  }

  private async updateHomeView() {
    if (this.ClipperView) {
      const container = this.ClipperView.containerEl.querySelector(".netclip_saved_container");
      if (container instanceof HTMLDivElement) {
        await this.ClipperView.renderSavedContent(container);
        
      }
    }
  }


  
}
