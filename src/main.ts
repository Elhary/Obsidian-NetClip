import { Notice, Plugin, requestUrl, WorkspaceLeaf } from 'obsidian'
import { CLIPPER_VIEW, clipperHomeView } from './view/ClipperView'
import { sanitizePath, getDomain, normalizeUrl } from './utils'
import { ContentExtractors } from './Extractors/extractor'
import { VIEW_TYPE_WORKSPACE_WEBVIEW, WorkspaceLeafWebView } from './view/EditorWebView'
import { WebViewModal } from './view/ModalWebView'
import { ClipModal } from './modal/clipModal'
import { NetClipSettings, DEFAULT_SETTINGS } from './settings';
import NetClipSettingTab from './settingTabs';

export default class NetClipPlugin extends Plugin {
  private ClipperView: clipperHomeView | null = null;
  private readonly DEMO_CATEGORIES = ['Articles', 'Research', 'Tech'];
  contentExtractors: ContentExtractors;
  seenItems: Set<string> = new Set();
  settings: NetClipSettings;

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

  private initWebViewLeaf(): void {

    const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_WEBVIEW);
    if (existingLeaf.length > 0) {
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      leaf.setViewState({
        type: VIEW_TYPE_WORKSPACE_WEBVIEW,
      });
    }
  }

  private async FoldersExist() {
    const mainFolder = this.app.vault.getAbstractFileByPath(this.settings.defaultFolderName);
    if (!mainFolder) {
      await this.app.vault.createFolder(this.settings.defaultFolderName);
  
      for (const category of this.DEMO_CATEGORIES) {
        const categoryPath = `${this.settings.defaultFolderName}/${category}`;
        await this.app.vault.createFolder(categoryPath);
        if (!this.settings.categories.includes(category)) {
          this.settings.categories.push(category);
        }
      }
      await this.saveSettings();
      new Notice(`Created folders in ${this.settings.defaultFolderName}`);
    }

    for (const category of this.settings.categories) {
      const categoryPath = `${this.settings.defaultFolderName}/${category}`;
      const categoryFolder = this.app.vault.getAbstractFileByPath(categoryPath);
      if (!categoryFolder) {
        await this.app.vault.createFolder(categoryPath);
      }
    }
  }
  

  async onload() {

    await this.loadSettings();

    this.app.workspace.onLayoutReady(() => {
      this.initWebViewLeaf();
    });

    this.contentExtractors = new ContentExtractors(this);
    this.addRibbonIcon('newspaper', 'NetClip', async () => {
      await this.activateView();
    });

    this.addCommand({
      id: 'open-clipper',
      name: 'Open clipper',
      callback: () => {
        this.activateView();
      }
    });

    this.addCommand({
      id: 'open-clipper',
      name: 'Open modal clipper',
      callback: () => {
        new ClipModal(this.app, this).open()
      }
    });

    this.addCommand({
      id: 'open-web-editor',
      name: 'Open page on editor',
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
      name: 'Open page in modal',
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
    await this.updateHomeView();
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

  async clipWebpage(url: string, category: string = '') {
    if (!this.contentExtractors) {
      return;
    }
    await this.FoldersExist();

    new Notice("Clipping...");

    let folderPath = this.settings.defaultFolderName;
    if (category) {
      folderPath = `${folderPath}/${category}`;
    }

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
      ? `${minReadTime}`
      : `${minReadTime}~${maxReadTime}`;

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

  public async updateHomeView() {
    if (this.ClipperView) {

      const tabsContainer = this.ClipperView.containerEl.querySelector(".netclip_category_tabs");
      if (tabsContainer instanceof HTMLElement) {
        this.ClipperView.renderCategoryTabs(tabsContainer);
      }

      const container = this.ClipperView.containerEl.querySelector(".netclip_saved_container");
      if (container instanceof HTMLDivElement) {
        await this.ClipperView.renderSavedContent(container);
      }
    }
  }

}
