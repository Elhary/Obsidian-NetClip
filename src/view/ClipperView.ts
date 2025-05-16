import { ItemView, WorkspaceLeaf, TFile, setIcon } from 'obsidian'
import NetClipPlugin from '../main'
import { getDomain } from '../utils'
import { DeleteConfirmationModal } from '../modal/deleteFiles'
import { ClipperContextMenu } from '../contextMenu'
import { VIEW_TYPE_WORKSPACE_WEBVIEW, WorkspaceLeafWebView } from './EditorWebView'
import { ClipModal } from 'src/modal/clipModal'
import { DEFAULT_IMAGE } from '../assets/image'
import { Menu } from 'obsidian'
import { t } from '../translations'
import { findFirstImageInNote } from '../mediaUtils'

export const CLIPPER_VIEW = 'clipper-view';

export class ClipperHomeView extends ItemView {
    private plugin: NetClipPlugin;
    settings: any;
    private currentCategory: string = '';
    icon = 'newspaper';

    constructor(leaf: WorkspaceLeaf, plugin: NetClipPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.settings = plugin.settings;
    }

    getViewType(): string {
        return CLIPPER_VIEW;
    }

    getDisplayText(): string {
        return t('clipper_view')
    }

    public async reloadView() {
        this.containerEl.empty();
        await this.onOpen();
    }

    async onOpen() {
        this.containerEl = this.containerEl.children[1] as HTMLElement;
        this.containerEl.empty();

        const clipperContainer = this.containerEl.createEl('div', { cls: 'net_clipper_container' });
        
        const clipperHeader = clipperContainer.createEl('div', { cls: 'net_clipper_header' });
        const rightContainer = clipperHeader.createEl('div', { cls: 'net_clipper_header_right' });

        const openWeb = rightContainer.createEl('span', { cls: 'netopen_Web', attr: { 'aria-label': t('open_web') } });
        const openSettings = rightContainer.createEl('span', { cls: 'netopen_settings', attr: { 'aria-label': t('open_settings') } });
        setIcon(openWeb, 'globe')
        setIcon(openSettings, 'lucide-bolt');

        const searchBoxContainer = clipperContainer.createEl('div', { cls: 'netclip_search_box' });
        const searchIcon = searchBoxContainer.createEl('span', { cls: 'netclip_search_icon' });
        setIcon(searchIcon, 'search');
        const searchInput = searchBoxContainer.createEl('input', {
            type: 'text',
            cls: 'netclip_search_input',
            placeholder: t('search_saved_articles')
        });

        const bottomContainer = clipperContainer.createEl('div', {cls: 'netclip_bottom_container'})
        const categoryTabsContainer = bottomContainer.createEl('div', { cls: 'netclip_category_tabs'});
        this.renderCategoryTabs(categoryTabsContainer);

        const sortContainer = bottomContainer.createEl('div', { cls: 'netclip_sort_container' });
        const domainSortButton = sortContainer.createEl('button', { 
            cls: 'netclip_sort_button',
            attr: { 'aria-label': t('domain_filter') }
        });
        const sortButton = sortContainer.createEl('button', { 
            cls: 'netclip_sort_button',
            attr: { 'aria-label': t('sort_by') }
        });
        setIcon(sortButton, 'arrow-up-down');
        setIcon(domainSortButton, 'earth');

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const savedContainer = this.containerEl.querySelector('.netclip_saved_container') as HTMLElement;
            this.renderSavedContent(savedContainer, searchTerm);
        })

        const clipButtonContainer = clipperHeader.createEl('div', { cls: 'netclip_button_container' });
        const clipButton = clipButtonContainer.createEl('button', {
            cls: 'netclip_btn',
            attr: { 'aria-label': t('add_clip') }
        });
        setIcon(clipButton, 'plus');

        sortButton.addEventListener('click', (event) => {
            const menu = new Menu();
            
            menu.addItem((item) => 
                item
                    .setTitle(t('sort_a_z'))
                    .setIcon('arrow-up')
                    .onClick(() => this.applySort('a-z'))
            );
            
            menu.addItem((item) => 
                item
                    .setTitle(t('sort_z_a'))
                    .setIcon('arrow-down')
                    .onClick(() => this.applySort('z-a'))
            );
            
            menu.addItem((item) => 
                item
                    .setTitle(t('sort_newest_first'))
                    .setIcon('arrow-down')
                    .onClick(() => this.applySort('new-old'))
            );
            
            menu.addItem((item) => 
                item
                    .setTitle(t('sort_oldest_first'))
                    .setIcon('arrow-up')
                    .onClick(() => this.applySort('old-new'))
            );

            menu.showAtMouseEvent(event);
        });

        domainSortButton.addEventListener('click', async (event) => {
            const menu = new Menu();
            const files = this.app.vault.getMarkdownFiles();
            const domains = new Set<string>();

            const baseFolderPath = this.settings.parentFolderPath 
                ? `${this.settings.parentFolderPath}/${this.settings.defaultFolderName}`
                : this.settings.defaultFolderName;

            await Promise.all(files.map(async file => {
                if (file.path.startsWith(baseFolderPath)) {
                    const content = await this.app.vault.cachedRead(file);
                    const urlMatch = content.match(/source: "([^"]+)"/);
                    if (urlMatch) {
                        const domain = getDomain(urlMatch[1]);
                        domains.add(domain);
                    }
                }
            }));

            menu.addItem((item) => 
                item
                    .setTitle(t('all_domains'))
                    .setIcon('dot')
                    .onClick(() => this.applyDomainFilter(''))
            );

            domains.forEach(domain => {
                const displayName = domain.replace('.com', '');
                menu.addItem((item) => 
                    item
                        .setTitle(displayName)
                        .setIcon('dot')
                        .onClick(() => this.applyDomainFilter(domain))
                );
            });

            menu.showAtMouseEvent(event);
        });

        const SavedContentBox = clipperContainer.createEl("div", { cls: "netclip_saved_container" });

        openWeb.addEventListener('click', async () => {
            const defaultUrl = this.settings.defaultWebUrl || 'https://google.com';
            const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_WEBVIEW)
                .find((leaf: any) => {
                    const view = leaf.view as WorkspaceLeafWebView;
                    return view.url === defaultUrl;
                });

            if (existingLeaf) {
                this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
            } else {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.setViewState({
                    type: VIEW_TYPE_WORKSPACE_WEBVIEW,
                    state: { url: defaultUrl }
                });

                this.app.workspace.setActiveLeaf(leaf, { focus: true });
            }
        });
        
        openSettings.addEventListener('click', () => {
            (this.app as any).setting.open();
            (this.app as any).setting.openTabById(this.plugin.manifest.id);
        });
          
        clipButton.addEventListener("click", () => {
            new ClipModal(this.app, this.plugin).open();
        });

        await this.renderSavedContent(SavedContentBox)
    }

    private async applySort(sortOrder: string) {
        const savedContainer = this.containerEl.querySelector('.netclip_saved_container') as HTMLElement;
        await this.renderSavedContent(savedContainer, '', sortOrder);
    }

    private async applyDomainFilter(domain: string) {
        const savedContainer = this.containerEl.querySelector('.netclip_saved_container') as HTMLElement;
        await this.renderSavedContent(savedContainer, '', 'a-z', domain);
    }

    public renderCategoryTabs(tabsContainer: HTMLElement){
        tabsContainer.empty();

        const allTab = tabsContainer.createEl('div', { 
            cls: `netclip_category_tab ${this.currentCategory === '' ? 'active' : ''}`,
        });
        
        const allTabContent = allTab.createEl('div', { cls: 'netclip-category-content' });
        allTabContent.createEl('span', { text: t('all') });

        allTab.addEventListener('click', () => this.switchCategory('', tabsContainer));

        this.plugin.settings.categories.forEach(category => {
            const tab = tabsContainer.createEl('div', {
                cls: `netclip_category_tab ${this.currentCategory === category ? 'active' : ''}`,
            });
            
            const tabContent = tab.createEl('div', { cls: 'netclip-category-content' });
            
            if (this.plugin.settings.categoryIcons[category]) {
                const iconSpan = tabContent.createEl('span', { cls: 'category-icon' });
                setIcon(iconSpan, this.plugin.settings.categoryIcons[category]);
            }
            
            tabContent.createEl('span', { text: category });
            
            tab.addEventListener('click', () => this.switchCategory(category, tabsContainer));
        })
    }

    private async switchCategory(category: string, tabsContainer: HTMLElement) {
        this.currentCategory = category;
        
        const tabs = tabsContainer.querySelectorAll('.netclip_category_tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if ((category === '' && tab.textContent === t('all')) || 
                tab.textContent === category) {
                tab.classList.add('active');
            }
        });

        const savedContainer = this.containerEl.querySelector(".netclip_saved_container") as HTMLElement;
        await this.renderSavedContent(savedContainer);
    }

    public async renderSavedContent(container: HTMLElement, filter: string = '', sortOrder: string = 'new-old', domainFilter: string = '') {
        container.empty();

        const files = this.app.vault.getMarkdownFiles();
        const baseFolderPath = this.settings.parentFolderPath 
            ? `${this.settings.parentFolderPath}/${this.settings.defaultFolderName}`
            : this.settings.defaultFolderName;

        const clippedFiles = files.filter(file => {
            const isInMainFolder = file.path.startsWith(baseFolderPath);
            if (!this.currentCategory) {
                return isInMainFolder;
            }
            return file.path.startsWith(`${baseFolderPath}/${this.currentCategory}`);
        });

        let filteredFiles = filter
            ? clippedFiles.filter(file => file.basename.toLowerCase().includes(filter))
            : clippedFiles;

        if (domainFilter) {
            filteredFiles = (await Promise.all(filteredFiles.map(async file => {
                const content = await this.app.vault.cachedRead(file);
                const urlMatch = content.match(/source: "([^"]+)"/);
                if (urlMatch) {
                    const domain = getDomain(urlMatch[1]);
                    return domain === domainFilter ? file : null;
                }
                return null;
            }))).filter(Boolean) as TFile[];
        }

        const sortedFiles = filteredFiles.sort((a, b) => {
            switch (sortOrder) {
                case 'a-z':
                    return a.basename.localeCompare(b.basename);
                case 'z-a':
                    return b.basename.localeCompare(a.basename);
                case 'new-old':
                    return b.stat.mtime - a.stat.mtime;
                case 'old-new':
                    return a.stat.mtime - b.stat.mtime;
                default:
                    return 0;
            }
        });

        if (sortedFiles.length === 0) {
            const emptyContainer = container.createEl('div', { cls: 'empty_box' });
            const emptyIcon = emptyContainer.createEl("span", { cls: 'empty_icon' });
            setIcon(emptyIcon, 'lucide-book-open');
            emptyContainer.createEl("p", { text: t('no_matching_articles') });
            return;
        }

        for (const file of sortedFiles) {
            const content = await this.app.vault.cachedRead(file);
            const clippedEl = container.createEl('div', { cls: 'netClip_card' });

            if (this.settings.cardDisplay.showThumbnail) {
                const frontmatterMatch = content.match(/^---[\s\S]*?thumbnail: "([^"]+)"[\s\S]*?---/);
                let thumbnailUrl = frontmatterMatch ? frontmatterMatch[1] : null;

                if (!thumbnailUrl) {
                    const thumbnailMatch = content.match(/!\[Thumbnail\]\((.+)\)/);
                    thumbnailUrl = thumbnailMatch ? thumbnailMatch[1] : null;
                }

                if (!thumbnailUrl) {
                    thumbnailUrl = await findFirstImageInNote(this.app, content);
                }

                clippedEl.createEl("img", { 
                    attr: { 
                        src: thumbnailUrl || DEFAULT_IMAGE,
                        loading: "lazy"
                    } 
                });
            }

            const contentContainer = clippedEl.createEl('div', { cls: 'netclip_card_content' });
    
            const topContainer = contentContainer.createEl('div', { cls: 'netclip_card_top' });
            const clippedTitle = topContainer.createEl("h6", { text: file.basename });
            clippedTitle.addEventListener('click', () => {
                this.openArticle(file);
            });

            if (this.settings.cardDisplay.showDescription) {
                const descriptionMatch = content.match(/desc:\s*(?:"([^"]+)"|([^\n]+))/);
                if (descriptionMatch) {
                    topContainer.createEl("p", { 
                        cls: "netclip_card_description",
                        text: descriptionMatch[1] || descriptionMatch[2]
                    });
                }
            }

            const metaContainer = topContainer.createEl("div", { cls: "netclip_card_meta" });

            if (this.settings.cardDisplay.showAuthor) {
                const authorMatch = content.match(/author:\s*(?:"([^"]+)"|([^\n]+))/);
                if (authorMatch) {
                    metaContainer.createEl("span", {
                        cls: "netclip_card_author",
                        text: authorMatch[1] || authorMatch[2]
                    });
                }
            }

            if (this.settings.cardDisplay.showDate) {
                const creationDate = new Date(file.stat.ctime);
                const formattedDate = creationDate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                metaContainer.createEl("span", {
                    cls: "netclip_card_date",
                    text: formattedDate
                });
            }

            const bottomContent = contentContainer.createEl("div", { cls: "netclip_card_bottom" });
            const urlMatch = content.match(/source: "([^"]+)"/);

            if (this.settings.cardDisplay.showDomain && urlMatch) {
                const articleUrl = urlMatch[1];
                const domainName = getDomain(articleUrl);
                bottomContent.createEl("a", {
                    cls: "domain",
                    href: articleUrl,
                    text: domainName
                });
            }

            this.createMenuButton(bottomContent, file, urlMatch?.[1]);
            container.appendChild(clippedEl);
        }
    }

    private createMenuButton(bottomContent: HTMLElement, file: TFile, url?: string) {
        const menuButton = bottomContent.createEl("span", { cls: "menu-button" });
        setIcon(menuButton, 'more-vertical');

        menuButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const contextMenu = new ClipperContextMenu(
                this.app,
                file,
                this.showDeleteConfirmation.bind(this),
                this.openArticle.bind(this),
                url
            );
            contextMenu.show(menuButton);
        });
    }

    private showDeleteConfirmation(file: TFile) {
        const modal = new DeleteConfirmationModal(
            this.app,
            file,
            async () => {
                await this.app.fileManager.trashFile(file);
                const savedContainer = this.containerEl.querySelector(".netclip_saved_container") as HTMLElement;
                await this.renderSavedContent(savedContainer);
            }
        );
        modal.open();
    }

    private openArticle(file: TFile) {
        const openLeaves = this.app.workspace.getLeavesOfType("markdown");
        const targetLeaf = openLeaves.find((leaf) => {
            const viewState = leaf.getViewState();
            return viewState.type === "markdown" && viewState.state?.file === file.path;
        });

        if (targetLeaf) {
            this.app.workspace.revealLeaf(targetLeaf);
        } else {
            this.app.workspace.openLinkText(file.path, '', true);
        }
    }
}