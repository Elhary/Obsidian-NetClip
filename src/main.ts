import { Notice, Plugin, requestUrl, WorkspaceLeaf, TFile, TAbstractFile } from 'obsidian';
import { CLIPPER_VIEW, ClipperHomeView } from './view/ClipperView';
import { sanitizePath, getDomain, normalizeUrl } from './utils';
import { ContentExtractors } from './Extractors/extractor';
import { VIEW_TYPE_WORKSPACE_WEBVIEW, WorkspaceLeafWebView } from './view/EditorWebView';
import { WebViewModal } from './view/ModalWebView';
import { ClipModal } from './modal/clipModal';
import { DEFAULT_SETTINGS, NetClipSettings, AIPrompt } from './settings';
import { GeminiService } from './services/gemini';
import NetClipSettingTab from './settingTabs';

export default class NetClipPlugin extends Plugin {
  private readonly DEMO_CATEGORIES = ['Articles', 'Research', 'Tech'];
  contentExtractors: ContentExtractors;
  seenItems: Set<string> = new Set();
  settings: NetClipSettings;
  private geminiService: GeminiService | null = null;

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
    if (existingLeaf.length > 0) return;

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      leaf.setViewState({ type: VIEW_TYPE_WORKSPACE_WEBVIEW });
    }
  }

  private async FoldersExist() {
    const mainFolderPath = this.settings.parentFolderPath 
      ? `${this.settings.parentFolderPath}/${this.settings.defaultFolderName}`
      : this.settings.defaultFolderName;
    
    const mainFolder = this.app.vault.getFolderByPath(mainFolderPath);
    if (!mainFolder) {
      if (this.settings.parentFolderPath && !this.app.vault.getFolderByPath(this.settings.parentFolderPath)) {
        await this.app.vault.createFolder(this.settings.parentFolderPath);
      }
      
      await this.app.vault.createFolder(mainFolderPath);

      for (const category of this.DEMO_CATEGORIES) {
        const categoryPath = `${mainFolderPath}/${category}`;
        await this.app.vault.createFolder(categoryPath);
        if (!this.settings.categories.includes(category)) {
          this.settings.categories.push(category);
        }
      }
      await this.saveSettings();
      new Notice(`Created folders in ${mainFolderPath}`);
    }

    for (const category of this.settings.categories) {
      const categoryPath = `${mainFolderPath}/${category}`;
      const categoryFolder = this.app.vault.getFolderByPath(categoryPath);
      if (!categoryFolder) {
        await this.app.vault.createFolder(categoryPath);
      }
    }
  }

  async onload() {
    await this.loadSettings();

    if (this.settings.geminiApiKey) {
      this.geminiService = new GeminiService(this.settings.geminiApiKey, this.settings);
    }
    this.app.workspace.onLayoutReady(() => this.initWebViewLeaf());
    this.contentExtractors = new ContentExtractors(this);

    this.addRibbonIcon('newspaper', 'NetClip', async () => this.activateView());

    this.addCommand({
      id: 'open-clipper',
      name: 'Open clipper',
      callback: () => this.activateView()
    });

    this.addCommand({
      id: 'open-modal-clipper',
      name: 'Open modal clipper',
      callback: () => new ClipModal(this.app, this).open()
    });

    this.addCommand({
      id: 'open-web-editor',
      name: 'Open page on editor',
      callback: async () => {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TYPE_WORKSPACE_WEBVIEW, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });

    this.addCommand({
      id: 'open-web-modal',
      name: 'Open page in modal',
      callback: () => {
        const defaultUrl = this.settings.defaultWebUrl || 'https://google.com';
        new WebViewModal(this.app, defaultUrl, this).open();
      }
    });

    this.registerView(CLIPPER_VIEW, (leaf) => 
      new ClipperHomeView(leaf, this)
    );

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
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(CLIPPER_VIEW)[0] || null;

    if (!leaf) {
      switch (this.settings.viewPosition) {
        case 'left': leaf = workspace.getLeftLeaf(false); break;
        case 'right': leaf = workspace.getRightLeaf(false); break;
        default: leaf = workspace.getLeaf(false);
      }
    }

    if (leaf) {
      await leaf.setViewState({ type: CLIPPER_VIEW, active: true });
      workspace.revealLeaf(leaf);
    }
  }

  async clipWebpage(
    url: string, 
    category: string = '', 
    selectedPrompt: AIPrompt | AIPrompt[] | null = null, 
    selectedVariables: Record<string, Record<string, string>> | Record<string, string> = {}
  ): Promise<string> {
    if (!this.contentExtractors) {
      throw new Error("Content extractors not initialized");
    }

    if (category) {
      await this.FoldersExist();
    }
    new Notice("Clipping...");

    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl || !normalizedUrl.startsWith('http')) {
      throw new Error("Invalid URL provided");
    }

    const urlDomain = getDomain(normalizedUrl).toLowerCase();
    let effectiveCategory = category;
    let customSaveLocation = '';

    if (!category) {
      const domainMapping = this.settings.defaultSaveLocations.domainMappings[urlDomain];
      if (domainMapping) {
        customSaveLocation = domainMapping;
      } else if (this.settings.defaultSaveLocations.defaultLocation) {
        customSaveLocation = this.settings.defaultSaveLocations.defaultLocation;
      }
    }

    const useProxy = this.settings.enableCorsProxy;
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const targetUrl = useProxy ? `${proxyUrl}${normalizedUrl}` : normalizedUrl;

    const response = await requestUrl({
      url: targetUrl,
      headers: useProxy ? {
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'http://localhost'
      } : {}
    });

    const html = response.text;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    let title = doc.querySelector('title')?.textContent || '';
    if (!title) {
      const headingElement = doc.querySelector('h1, .title');
      title = headingElement?.textContent?.trim() || `Article from ${getDomain(url)}`;
    }
    title = title.replace(/[#"]/g, '').trim();

    let content = this.contentExtractors.extractMainContent(doc, normalizedUrl);
    const thumbnailUrl = this.contentExtractors.extractThumbnail(doc);
    const author = this.contentExtractors.extractAuthor(doc);
    const desc = this.contentExtractors.extractDescription(doc);
    const publishTime = this.contentExtractors.extractPublishTime(doc);
    const price = this.contentExtractors.extractPrice(doc);
    const brand = this.contentExtractors.extractBrand(doc);
    const rating = this.contentExtractors.extractRating(doc);

    let folderPath;
    if (customSaveLocation) {
      folderPath = customSaveLocation;
    } else if (category) {
      const baseFolderPath = this.settings.parentFolderPath 
        ? `${this.settings.parentFolderPath}/${this.settings.defaultFolderName}`
        : this.settings.defaultFolderName;
      folderPath = `${baseFolderPath}/${effectiveCategory}`;
    } else {
      folderPath = this.settings.parentFolderPath || '';
    }

    if (folderPath && !this.app.vault.getFolderByPath(folderPath)) {
      await this.app.vault.createFolder(folderPath);
    }

    const wordCount = content.split(/\s+/).length;
    const readingTime = this.calculateReadingTime(wordCount);

    const frontmatter = this.generateFrontmatter(
      title, url, publishTime, author, desc, readingTime, price, brand, rating, thumbnailUrl
    );

    const formattedContent = content.trim()
      .split('\n')
      .map(line => line.trim())
      .join('\n');

    const completeNote = `${frontmatter}\n${formattedContent}\n`;

    let processedContent = completeNote;
    if (this.geminiService && selectedPrompt) {
      processedContent = await this.geminiService.processContent(completeNote, selectedPrompt, selectedVariables);
      
      const titleMatch = processedContent.match(/^---[\s\S]*?\ntitle: "([^"]+)"[\s\S]*?\n---/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1];
      }
    }

    const fileName = sanitizePath(`${title}.md`);
    const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

    await this.app.vault.create(filePath, processedContent);
    await this.updateHomeView();
    new Notice(`Successfully clipped ${title}`);

    return filePath;
  }

  private calculateReadingTime(wordCount: number): string {
    const min = Math.floor(wordCount / 250);
    const max = Math.ceil(wordCount / 200);
    return min === max ? `${min}` : `${min}~${max}`;
  }

  private generateFrontmatter(
    title: string, url: string, publishTime: string | null,
    author: string | null, desc: string | null, readingTime: string,
    price: string | null, brand: string | null, rating: string | null,
    thumbnailUrl: string | null
  ): string {
    return `---\n` +
      `title: "${title}"\n` +
      `source: "${url}"\n` +
      (publishTime ? `published: ${new Date(publishTime).toISOString().split('T')[0]}\n` : '') +
      (author ? `author: "${author}"\n` : '') +
      (desc ? `desc: "${desc}"\n` : '') +
      `readingTime: "${readingTime}min"\n` +
      (price ? `price: "${price}"\n` : '') +
      (brand ? `brand: "${brand}"\n` : '') +
      (rating ? `rating: "${rating}"\n` : '') +
      `---\n\n` +
      (thumbnailUrl ? `![Thumbnail](${thumbnailUrl}?crossorigin=anonymous)\n\n` : '');
  }

  public async updateHomeView() {
    const leaves = this.app.workspace.getLeavesOfType(CLIPPER_VIEW);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof ClipperHomeView) {
        const tabsContainer = view.containerEl.querySelector(".netclip_category_tabs");
        if (tabsContainer instanceof HTMLElement) {
          view.renderCategoryTabs(tabsContainer);
        }
        const container = view.containerEl.querySelector(".netclip_saved_container");
        if (container instanceof HTMLDivElement) {
          await view.renderSavedContent(container);
        }
      }
    }
  }

  async processExistingNote(filePath: string, prompt: AIPrompt, variables: Record<string, string>): Promise<void> {
    if (!this.geminiService) {
      throw new Error("AI service not initialized");
    }

    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) {
      throw new Error("File not found");
    }

    const currentContent = await this.app.vault.read(file);
    const processedContent = await this.geminiService.processContent(
      currentContent,
      prompt,
      variables
    );

    await this.app.vault.modify(file, processedContent);
    new Notice(`Successfully processed with ${prompt.name}`);
  }
}
