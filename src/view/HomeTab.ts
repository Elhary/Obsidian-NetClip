import { ItemView, WorkspaceLeaf, setIcon, TFile, Menu, Notice, MarkdownView } from 'obsidian';
import NetClipPlugin from '../main';
import { t } from '../translations';
import { VIEW_TYPE_WORKSPACE_WEBVIEW } from './EditorWebView';
import { DEFAULT_IMAGE } from '../assets/image';
import { getDomain } from '../utils';
import { ShortcutModal, Shortcut } from '../modal/ShortcutModal';
import { CLIPPER_VIEW } from './ClipperView';
import { ClipModal } from 'src/modal/clipModal';
import { findFirstImageInNote } from '../mediaUtils';

export const HOME_TAB_VIEW = 'netclip-home-tab-view';

export class HomeTabView extends ItemView {
    private plugin: NetClipPlugin;
    private searchInput: HTMLInputElement;
    private shortcuts: Shortcut[] = [];
    private shortcutsContainer: HTMLElement;
    navigation = false
    allowNoFile = true
    icon = 'home'

    constructor(leaf: WorkspaceLeaf, plugin: NetClipPlugin){
        super(leaf);
        this.plugin = plugin;
        this.shortcuts = this.plugin.settings.shortcuts || [];
        

        if (this.plugin.settings.enableWebview) {
            this.addAction('globe', 'Open web view', (evt: MouseEvent) => {
                this.openWebView();
            })
        }

        this.addAction('newspaper', 'newspaper', (evt: MouseEvent) => {
            this.openCliperView();
        })

        this.addAction("refresh-cw", 'reload', (evt: MouseEvent) => {
            this.refreshContent();
        })

        this.addAction('scissors',  'Open Clip', (evt: MouseEvent) => {
            this.showClipModal();
        });

        this.addAction('file-plus', 'create new file', (evt: MouseEvent)=> {
            this.createNewFile();
        })
    }

    getViewType(): string {
        return HOME_TAB_VIEW
    }

    getDisplayText(): string {
        return 'Home'
    }

    getState(): any {
        return {}
    }

    setState(state: any, result: any): any {
        return;
    }

    private updateBackgroundImage() {
        const { backgroundImage, backgroundBlur, textColor, textBrightness } = this.plugin.settings.homeTab;
        const leafContent = this.containerEl.closest('.workspace-leaf-content[data-type="netclip-home-tab-view"]');
        if (leafContent) {
            if (backgroundImage) {
                leafContent.setAttribute('style', 
                    `--background-image: url('${backgroundImage}'); 
                     --background-blur: ${backgroundBlur}px;
                     --custom-text-color: ${textColor};
                     --text-brightness: ${textBrightness}%;`
                );
            } else {
                leafContent.removeAttribute('style');
            }
        }
    }

    async onOpen(){
        const container = this.containerEl.children[1];
        container.empty();
        
        this.updateBackgroundImage();

        if(this.plugin.settings.showClock){
            const clockSection = container.createEl('div', { cls: 'netclip-clock-section' });
            const timeEl = clockSection.createEl('div', { cls: 'netclip-time' });
            const dateEl = clockSection.createEl('div', { cls: 'netclip-date' });
            
            this.updateClock(timeEl, dateEl);

            const clockInterval = window.setInterval(() => {
                this.updateClock(timeEl, dateEl)
            },1000)

            this.registerInterval(clockInterval)

        }


        const searchContainer = container.createEl('div', { cls: 'netclip-home-tab-search' });
        const searchIcon = searchContainer.createEl('span', { cls: 'netclip-search-icon' });
        setIcon(searchIcon, 'search');
        
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            cls: 'netclip-search-input',
            placeholder: t('search_web') || 'Search the web...'
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.searchInput.value.trim()){
                this.openWebSearch(this.searchInput.value.trim());
            }
        });

        const shortcutsSection = container.createEl('div', { cls: 'netclip-shortcuts-section' });
        this.shortcutsContainer = shortcutsSection.createEl('div', { cls: 'netclip-shortcuts-container' });
        this.renderShortcuts()
        const sectionsContainer = container.createEl('div', { cls: 'netclip-home-tab-sections' });

        if(this.plugin.settings.homeTab.showRecentFiles){
            const recentSection = sectionsContainer.createEl('div', { cls: 'netclip-home-tab-section' });
            const titleContainer = recentSection.createEl('div', { cls: 'netclip-section-title' });
            const titleIcon = titleContainer.createEl('span', { cls: 'netclip-section-icon' });
            setIcon(titleIcon, 'clock');
            const titleText = titleContainer.createEl('h3', { text: 'Recent Files' });
   
       
            const recentFilesContainer = recentSection.createEl('div', { cls: 'netclip-recent-files' });
            await this.renderRecentFiles(recentFilesContainer);
        }

        if (this.plugin.settings.homeTab.showSavedArticles) {
            const savedSection = sectionsContainer.createEl('div', { cls: 'netclip-home-tab-section' });
            const savedTitleContainer = savedSection.createEl('div', { cls: 'netclip-section-title' });
            const savedTitleIcon = savedTitleContainer.createEl('span', { cls: 'netclip-section-icon' });
            setIcon(savedTitleIcon, 'bookmark')
            const savedTitleText = savedTitleContainer.createEl('h3', { text: t('saved_articles') || 'Saved Articles' });
            const savedArticlesContainer = savedSection.createEl('div', { cls: 'netclip-saved-articles' });
            
            await this.renderSavedArticles(savedArticlesContainer);
        }

    }


    onPaneMenu(menu: Menu, source: string): void {
        super.onPaneMenu(menu, source);
         
        menu.addItem((item) => {
            item.setTitle( 'Add shortcut')
                .setIcon('plus')
                .onClick(() => this.addShortcutModal());
        })

        menu.addItem((item) => {
            item.setTitle('open clipper')
            .setIcon('scissors')
            .onClick(() => this.showClipModal());
        })

        
        menu.addItem((item) => {
            item.setTitle('Refresh')
            .setIcon('refresh-cw')
            .onClick(() => this.refreshContent());
        })

        
        menu.addItem((item) => {
            item.setTitle('Create new file')
            .setIcon('file')
            .onClick(() => this.createNewFile());
        })
    }

    onResize(): void {
        
    }

    async onClose(){
        this.containerEl.empty();
    }

    private renderShortcuts(){
        this.shortcutsContainer.empty();
        const shortcutsGrid = this.shortcutsContainer.createEl('div', { cls: 'netclip-shortcuts-grid' });
        
        this.shortcuts.forEach(shortcut => {
            this.shortcutEl(shortcutsGrid, shortcut);
        });
        
        const addShortcutButton = shortcutsGrid.createEl('div', { cls: 'netclip-shortcut-add' });
        const addIcon = addShortcutButton.createEl('div', { cls: 'netclip-shortcut-add-icon' });
        setIcon(addIcon, 'plus');
        addShortcutButton.createEl('div', { cls: 'netclip-shortcut-add-text'});
        
        addShortcutButton.addEventListener('click', () => {
            this.addShortcutModal();
        });
    }

    private shortcutEl(container: HTMLElement, shortcut: Shortcut) {
        const shortcutEl = container.createEl('div', { cls: 'netclip-shortcut' });
        
        const iconContainer = shortcutEl.createEl('div', { cls: 'netclip-shortcut-icon' });
        const domain = getDomain(shortcut.url);
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        iconContainer.createEl('img', { 
            cls: 'netclip-shortcut-favicon',
            attr: { src: faviconUrl }
        });

        shortcutEl.createEl('div', { 
            cls: 'netclip-shortcut-name',
            text: shortcut.name || ''
        });
        
        shortcutEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openShortcut(shortcut);
        });
        
        shortcutEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.shortcutContextMenu(shortcut, e);
        });
    }

    private openShortcut(shortcut: Shortcut) {
        if (!this.plugin.settings.enableWebview) {
            try {
                window.open(shortcut.url);
            } catch (e) {
                new Notice(t('webview_disabled_notice'));
            }
            return;
        }
        const leaf = this.app.workspace.getLeaf(true);
        leaf.setViewState({
            type: VIEW_TYPE_WORKSPACE_WEBVIEW,
            state: { url: shortcut.url }
        });
        this.app.workspace.revealLeaf(leaf);
    }


    
    private shortcutContextMenu(shortcut: Shortcut, event: MouseEvent) {
        const menu = new Menu();
        
        menu.addItem(item => {
            item.setTitle('Edit shortcut')
                .setIcon('pencil')
                .onClick(() => this.editShortcutModal(shortcut));
        });
        
        menu.addItem(item => {
            item.setTitle('Remove shortcut')
                .setIcon('trash')
                .onClick(() => this.removeShortcut(shortcut));
        });
        
        menu.addItem(item => {
            item.setTitle('Add shortcut')
                .setIcon('plus')
                .onClick(() => this.addShortcutModal());
        });
        
        menu.showAtMouseEvent(event);
    }

    private async addShortcutModal() {
        const modal = new ShortcutModal(this.app, null, (shortcut) => {
            if (shortcut) {
                this.addShortcut(shortcut);
            }
        });
        modal.open();
    }

    private async editShortcutModal(shortcut: Shortcut) {
        const modal = new ShortcutModal(this.app, shortcut, (updatedShortcut) => {
            if (updatedShortcut) {
                this.updateShortcut(shortcut.id, updatedShortcut);
            }
        });
        modal.open();
    }

    private addShortcut(shortcut: Shortcut) {
        shortcut.id = Date.now().toString();
        this.shortcuts.push(shortcut);
        this.saveShortcuts();
        this.renderShortcuts();
    }

    private updateShortcut(id: string, updatedShortcut: Shortcut) {
        const index = this.shortcuts.findIndex(s => s.id === id);
        if (index !== -1) {
            updatedShortcut.id = id;
            this.shortcuts[index] = updatedShortcut;
            this.saveShortcuts();
            this.renderShortcuts();
        }
    }


    private removeShortcut(shortcut: Shortcut) {
        this.shortcuts = this.shortcuts.filter(s => s.id !== shortcut.id);
        this.saveShortcuts();
        this.renderShortcuts();
    }

    private async saveShortcuts() {
        this.plugin.settings.shortcuts = this.shortcuts;
        await this.plugin.saveSettings();
    }


    async renderRecentFiles(container: HTMLElement, filter: string = '') {
        container.empty();
        
        let files = this.app.vault.getMarkdownFiles()
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
            .slice(0, 10);
        
        if (filter) {
            const lowerFilter = filter.toLowerCase();
            files = files.filter(file => file.basename.toLowerCase().includes(lowerFilter));
        }
        
        if (files.length === 0) {
            container.createEl('p', { text: t('no_recent_files') || 'No recent files found' });
            return;
        }
        
        for (const file of files) {
            const fileItem = container.createEl('div', { cls: 'netclip-file-item' });
            const fileIcon = fileItem.createEl('span', { cls: 'netclip-file-icon' });
            setIcon(fileIcon, 'file-text');
            
            fileItem.createEl('span', { text: file.basename, cls: 'netclip-file-name' });
            
            const date = new Date(file.stat.mtime);
            const dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            fileItem.createEl('span', { text: dateStr, cls: 'netclip-file-date' });
            
            fileItem.addEventListener('click', () => this.openFile(file));
        }
    }






    async renderSavedArticles(container: HTMLElement) {
        container.empty();
        
        const baseFolderPath = this.plugin.settings.parentFolderPath 
            ? `${this.plugin.settings.parentFolderPath}/${this.plugin.settings.defaultFolderName}`
            : this.plugin.settings.defaultFolderName;
            
        let files = this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(baseFolderPath));
        
        if (files.length === 0) {
            container.createEl('p', { text: t('no_saved_articles') || 'No saved articles found' });
            return;
        }
        
        files = this.shuffleArray(files).slice(0, 9); 
        
        const articlesGrid = container.createEl('div', { cls: 'netclip-articles-grid' });
        
        for (const file of files) {
            const content = await this.app.vault.cachedRead(file);
            const articleCard = articlesGrid.createEl('div', { cls: 'netclip-article-card' });

            const imageContainer = articleCard.createEl('div', { cls: 'netclip-article-image-container' });
            
            const frontmatterMatch = content.match(/^---[\s\S]*?thumbnail: "([^"]+)"[\s\S]*?---/);
            let thumbnailUrl = frontmatterMatch ? frontmatterMatch[1] : null;

            if (!thumbnailUrl) {
                const thumbnailMatch = content.match(/!\[Thumbnail\]\((.+)\)/);
                thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : null;
            }

            if (!thumbnailUrl) {
                thumbnailUrl = await findFirstImageInNote(this.app, content);
            }

            imageContainer.createEl("img", { 
                cls: 'netclip-article-thumbnail',
                attr: { 
                    src: thumbnailUrl || DEFAULT_IMAGE,
                    loading: "lazy"
                } 
            });

            const contentContainer = articleCard.createEl('div', { cls: 'netclip-article-content' });
            
            let displayTitle = file.basename;
            displayTitle = displayTitle.replace(/_/g, ' ');
            if (displayTitle.includes(' - ')) {
                displayTitle = displayTitle.substring(0, displayTitle.indexOf(' - '));
            }
            

            contentContainer.createEl("div", { 
                cls: 'netclip-article-title',
                text: displayTitle
            });
            

            const metaContainer = contentContainer.createEl('div', { cls: 'netclip-article-meta' });
            

            const urlMatch = content.match(/source: "([^"]+)"/);
            if (urlMatch) {
                const sourceContainer = metaContainer.createEl('div', { cls: 'netclip-article-source' });
                const domainName = getDomain(urlMatch[1]);
                sourceContainer.setText(domainName);
                
     
                const dateContainer = metaContainer.createEl('div', { cls: 'netclip-article-date' });
                const creationDate = new Date(file.stat.ctime);
                const formattedDate = creationDate.toLocaleDateString(undefined, { 
                    month: 'short', 
                    day: 'numeric' 
                });
                dateContainer.setText(formattedDate);
            }
            
            articleCard.addEventListener('click', () => this.openFile(file));
        }
        
        const viewAllBtn = container.createEl('button', { 
            cls: 'netclip-view-all-btn',
            text: t('view_all') || 'View All Articles'
        });
        
        viewAllBtn.addEventListener('click', () => this.plugin.activateView());
    }



    private shuffleArray<T>(array: T[]): T[] {
        const newArray = [...array]; 
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]]; // Swap elements
        }
        return newArray;
    }

    private openFile(file: TFile) {
        this.app.workspace.getLeaf(false).openFile(file);
    }



    private openWebSearch(query: string) {
        const searchEngine = this.plugin.settings.searchEngine || 'google';
        let searchUrl = '';
        
        switch (searchEngine) {
            case 'google':
                searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                break;
            case 'bing':
                searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
                break;
            case 'duckduckgo':
                searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
                break;
            case 'youtube':
                searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                break;
            case 'perplexity':
                searchUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
                break;
        }

        if (!this.plugin.settings.enableWebview) {
            try {
                window.open(searchUrl);
            } catch (e) {
                new Notice(t('webview_disabled_notice'));
            }
            return;
        }
        
        const leaf = this.app.workspace.getLeaf(true);
        leaf.setViewState({
            type: VIEW_TYPE_WORKSPACE_WEBVIEW,
            state: { url: searchUrl }
        });
        this.app.workspace.revealLeaf(leaf);
    }


    
    private updateClock(timeEl: HTMLElement, dateEl: HTMLElement) {
        const now = new Date();
        
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeEl.textContent = `${hours}:${minutes}`;
        
        const options: Intl.DateTimeFormatOptions = { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
        };
        dateEl.textContent = now.toLocaleDateString(undefined, options);
    }

    private openWebView() {
        const defaultUrl = this.plugin.settings.defaultWebUrl || 'https://google.com';
        if (!this.plugin.settings.enableWebview) {
            try {
                window.open(defaultUrl);
            } catch (e) {
                new Notice(t('webview_disabled_notice'));
            }
            return;
        }

        const leaf = this.app.workspace.getLeaf(true);
        leaf.setViewState({
            type: VIEW_TYPE_WORKSPACE_WEBVIEW,
            state: { url: defaultUrl }
        });
        this.app.workspace.revealLeaf(leaf);
    }


    private openCliperView(){
        const leaf = this.app.workspace.getLeaf(true)
        leaf.setViewState({
            type: CLIPPER_VIEW
        });
        this.app.workspace.revealLeaf(leaf);
    }


    private showClipModal(){
        new ClipModal(this.app, this.plugin).open()
    }


    private async createNewFile() {
        try {

            const timestamp = new Date().getTime();
            const fileName = `New_Note_${timestamp}.md`;
            const filePath = `${fileName}` 
            const file = await this.app.vault.create(filePath, '');
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView && activeView.editor) {
                activeView.editor.focus();
            }
        } catch (error) {
            console.error('Error creating new file:', error);
            new Notice(`Failed to create new file: ${error.message}`);
        }
    }

    private async refreshContent() {
        this.contentEl.empty();
        await this.onOpen();
        this.updateBackgroundImage();
    }

    async onunload() {
        const leafContent = this.containerEl.closest('.workspace-leaf-content[data-type="netclip-home-tab-view"]');
        if (leafContent) {
            leafContent.removeAttribute('style');
        }
    }
}