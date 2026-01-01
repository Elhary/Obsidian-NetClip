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
import { Menu, Editor, MarkdownView } from 'obsidian';
import { HOME_TAB_VIEW, HomeTabView } from './view/HomeTab';
import { t } from './translations';

export default class NetClipPlugin extends Plugin {
  private readonly DEMO_CATEGORIES = ['Articles', 'Research', 'Tech'];
  contentExtractors: ContentExtractors;
  seenItems: Set<string> = new Set();
  settings: NetClipSettings;
  public geminiService: GeminiService | null = null;
  private originalWindowOpen?: typeof window.open;

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

  public async FoldersExist() {
    const mainFolderPath = this.settings.parentFolderPath 
      ? `${this.settings.parentFolderPath}/${this.settings.defaultFolderName}`
      : this.settings.defaultFolderName;
    
    try {
      if (this.settings.parentFolderPath && !this.app.vault.getFolderByPath(this.settings.parentFolderPath)) {
        try {
          await this.app.vault.createFolder(this.settings.parentFolderPath);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }
      
      if (!this.app.vault.getFolderByPath(mainFolderPath)) {
        try {
          await this.app.vault.createFolder(mainFolderPath);
          
          for (const category of this.DEMO_CATEGORIES) {
            const categoryPath = `${mainFolderPath}/${category}`;
            if (!this.app.vault.getFolderByPath(categoryPath)) {
              try {
                await this.app.vault.createFolder(categoryPath);
                if (!this.settings.categories.includes(category)) {
                  this.settings.categories.push(category);
                }
              } catch (error) {
                if (!error.message.includes('already exists')) {
                  throw error;
                }
              }
            }
          }
          await this.saveSettings();
          new Notice(`Created folders in ${mainFolderPath}`);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }

      for (const category of this.settings.categories) {
        const categoryPath = `${mainFolderPath}/${category}`;
        if (!this.app.vault.getFolderByPath(categoryPath)) {
          try {
            await this.app.vault.createFolder(categoryPath);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              throw error;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error creating folders:', error);
      throw error;
    }
  }

  async onload() {
    await this.loadSettings();
    await this.FoldersExist();

    if (this.settings.geminiApiKey) {
      this.geminiService = new GeminiService(this.settings.geminiApiKey, this.settings);
    }

    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        
      
        const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
        
        let match;
        let url: string | null = null;
        

        while ((match = mdLinkRegex.exec(line)) !== null) {
          const linkStart = match.index;
          const linkEnd = linkStart + match[0].length;
          if (cursor.ch >= linkStart && cursor.ch <= linkEnd) {
            url = match[2];
            break;
          }
        }
        
        if (!url) {
          while ((match = urlRegex.exec(line)) !== null) {
            const linkStart = match.index;
            const linkEnd = linkStart + match[0].length;
            if (cursor.ch >= linkStart && cursor.ch <= linkEnd) {
              url = match[0];
              break;
            }
          }
        }

        if (url) {
          if (this.settings.enableWebview) {
            menu.addItem((item) => {
              item
                .setTitle("Open in WebView")
                .setIcon("globe")
                .onClick(async () => {
                  const leaf = this.app.workspace.getLeaf(true);
                  await leaf.setViewState({
                    type: VIEW_TYPE_WORKSPACE_WEBVIEW,
                    state: { url: url }
                  });
                  this.app.workspace.revealLeaf(leaf);
                });
            });

            menu.addItem((item) => {
              item
                .setTitle("Open in Modal WebView")
                .setIcon("picture-in-picture-2")
                .onClick(() => {
                  if (url) {
                    new WebViewModal(this.app, url, this).open();
                  } else {
                    new Notice('No valid URL found to open in WebView.');
                  }
                });
            });
          }
        }
      })
    );

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.enableWebview) this.initWebViewLeaf();
    });

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

    // Web-related commands are registered but they check the setting at runtime
    this.addCommand({
      id: 'open-web-editor',
      name: 'Open page on editor',
      callback: async () => {
        if (!this.settings.enableWebview) {
          new Notice(t('webview_disabled_notice'));
          return;
        }
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({ type: VIEW_TYPE_WORKSPACE_WEBVIEW, active: true });
        this.app.workspace.revealLeaf(leaf);
      }
    });

    this.addCommand({
      id: 'open-web-modal',
      name: 'Open page in modal',
      callback: () => {
        if (!this.settings.enableWebview) {
          new Notice(t('webview_disabled_notice'));
          return;
        }
        const defaultUrl = this.settings.defaultWebUrl || 'https://google.com';
        new WebViewModal(this.app, defaultUrl, this).open();
      }
    });

    this.addCommand({
      id: 'open-link-in-webview',
      name: 'Open link under cursor in WebView',
      editorCallback: (editor: Editor) => {
        if (!this.settings.enableWebview) {
          new Notice(t('webview_disabled_notice'));
          return;
        }
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const url = this.getLinkUnderCursor(line, cursor.ch);
        
        if (url) {
          const leaf = this.app.workspace.getLeaf(true);
          leaf.setViewState({
            type: VIEW_TYPE_WORKSPACE_WEBVIEW,
            state: { url: url }
          });
          this.app.workspace.revealLeaf(leaf);
        } else {
          new Notice(t('no_link_found'));
        }
      },
      hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'z' }]
    });

    this.addCommand({
      id: 'open-link-in-modal-webview',
      name: 'Open link under cursor in Modal WebView',
      editorCallback: (editor: Editor) => {
        if (!this.settings.enableWebview) {
          new Notice(t('webview_disabled_notice'));
          return;
        }
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const url = this.getLinkUnderCursor(line, cursor.ch);
        
        if (url) {
          new WebViewModal(this.app, url, this).open();
        } else {
          new Notice(t('no_link_found'));
        }
      },
      hotkeys: [{ modifiers: ['Ctrl', 'Alt'], key: 'z' }]
    });


    this.registerView(CLIPPER_VIEW, (leaf) => 
      new ClipperHomeView(leaf, this)
    );

    this.registerView(VIEW_TYPE_WORKSPACE_WEBVIEW, (leaf) => 
      new WorkspaceLeafWebView(leaf, this)
    );

    this.addSettingTab(new NetClipSettingTab(this.app, this));

    this.registerView(HOME_TAB_VIEW, (leaf) => new HomeTabView(leaf, this))

    this.registerEvent(this.app.workspace.on('layout-change', () => {
      if (this.settings.replaceTabHome) {
        this.replaceTabHome();
      }
    }));

    this.addCommand({
      id: 'open-home-tab',
      name: 'Open Home Tab',
      callback: () => this.activateHomeTab()
    });

    this.registerGlobalLinkHandler();
  }

  onunload() {
    if (this.originalWindowOpen) {
      window.open = this.originalWindowOpen;
      this.originalWindowOpen = undefined;
    }
  }

  private registerGlobalLinkHandler() {
    if (this.originalWindowOpen) {
      return;
    }

    this.originalWindowOpen = window.open;

    window.open = (url?: string | URL, target?: string, features?: string): WindowProxy | null => {
      let urlString = '';

      if (typeof url === 'string') {
        urlString = url;
      } else if (url instanceof URL) {
        urlString = url.toString();
      }

      const isHttpLink = urlString.startsWith('http://') || urlString.startsWith('https://');
      const shouldFallback = !urlString || (urlString === 'about:blank' && !!features) || !isHttpLink;

      if (shouldFallback || !this.settings.enableWebview) {
        // If webview is disabled, fallback to original window.open behavior
        return this.originalWindowOpen
          ? this.originalWindowOpen.call(window, url as any, target, features)
          : null;
      }

      new WebViewModal(this.app, urlString, this).open();
      return null;
    };
  }



  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    
    if (this.settings.shortcuts && this.settings.shortcuts.length === 0) {
      const githubShortcut = {
        id: Date.now().toString(),
        name: '',
        url: 'https://github.com/Elhary/Obsidian-NetClip',
        favicon: `https://www.google.com/s2/favicons?domain=github.com&sz=128`
      };
      const youtubeShortcut = {
        id: Date.now().toString(),
        name: '',
        url: 'https://youtube.com',
        favicon: `https://www.google.com/s2/favicons?domain=youtube.com&sz=128`
      };
      const redditShortcut = {
        id: Date.now().toString(),
        name: '',
        url: 'https://www.reddit.com/r/ObsidianMD/',
        favicon: `https://www.google.com/s2/favicons?domain=reddit.com&sz=128`
      };
      const obsidianShortcut = {
        id: Date.now().toString(),
        name: '',
        url: 'https://forum.obsidian.md/',
        favicon: `https://www.google.com/s2/favicons?domain=obsidian.md&sz=128`
      };
      this.settings.shortcuts.push(githubShortcut, youtubeShortcut, redditShortcut, obsidianShortcut );
      this.saveSettings();
    }
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
    selectedVariables: Record<string, Record<string, string>> | Record<string, string> = {},
    keepOriginalContent: boolean = true
  ): Promise<string> {
    if (!this.contentExtractors) {
      throw new Error("Content extractors not initialized");
    }

    await this.FoldersExist();
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

    const response = await requestUrl({
      url: normalizedUrl
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
      folderPath = this.settings.parentFolderPath 
        ? `${this.settings.parentFolderPath}/${this.settings.defaultFolderName}`
        : this.settings.defaultFolderName;
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
      processedContent = await this.geminiService.processContent(
        completeNote, 
        selectedPrompt, 
        selectedVariables,
        keepOriginalContent
      );
      
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
      (thumbnailUrl ? `![Thumbnail](${thumbnailUrl})\n\n` : '');
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


  private getLinkUnderCursor(line: string, cursorPos: number): string | null {
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    
    let match;

    while ((match = mdLinkRegex.exec(line)) !== null) {
        const linkStart = match.index;
        const linkEnd = linkStart + match[0].length;
        if (cursorPos >= linkStart && cursorPos <= linkEnd) {
            return match[2];
        }
    }

    while ((match = urlRegex.exec(line)) !== null) {
        const linkStart = match.index;
        const linkEnd = linkStart + match[0].length;
        if (cursorPos >= linkStart && cursorPos <= linkEnd) {
            return match[0];
        }
    }
    
    return null;
  }


  private replaceTabHome() {
    const emptyLeaves = this.app.workspace.getLeavesOfType('empty');
    if (emptyLeaves.length > 0) {
      emptyLeaves.forEach(leaf => {
        leaf.setViewState({
          type: HOME_TAB_VIEW
        });
      });
    }
  }

  
  public activateHomeTab() {
    const leaf = this.app.workspace.getLeaf('tab');
    if (leaf) {
      leaf.setViewState({
        type: HOME_TAB_VIEW
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  public refreshHomeViews(): void {
    this.app.workspace.getLeavesOfType(HOME_TAB_VIEW).forEach((leaf) => {
        if (leaf.view instanceof HomeTabView) {
            leaf.detach();
            const newLeaf = this.app.workspace.getLeaf();
            newLeaf.setViewState({
                type: HOME_TAB_VIEW,
                active: true
            });
        }
    });
  }

  // Toggle webview availability at runtime
  public async setWebviewEnabled(enabled: boolean): Promise<void> {
    this.settings.enableWebview = enabled;
    await this.saveSettings();
    if (!enabled) {
      this.closeAllWebViewLeaves();
    } else {
      this.initWebViewLeaf();
    }
  }

  public closeAllWebViewLeaves(): void {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_WEBVIEW);
    for (const leaf of existingLeaves) {
      try {
        leaf.setViewState({ type: CLIPPER_VIEW, active: true });
      } catch (e) {
        try { leaf.detach(); } catch (err) {}
      }
    }
  }
}

