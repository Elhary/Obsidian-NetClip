import { ItemView, WorkspaceLeaf, TFile, Setting, setIcon } from 'obsidian'
import NetClipPlugin from '../main'
import { getDomain } from '../utils'
import { DeleteConfirmationModal } from '../modal/deleteFiles'
import { ClipperContextMenu } from '../contextMenu'
import { VIEW_TYPE_WORKSPACE_WEBVIEW, WorkspaceLeafWebView } from './EditorWebView'
import { ClipModal } from 'src/modal/clipModal'
import NetClipSettingTab from 'src/settingTabs'

export const CLIPPER_VIEW = 'netClip_clipper_view';

export class clipperHomeView extends ItemView {
    private plugin: NetClipPlugin;
    settings: NetClipSettingTab;
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
        return 'Clipper View'
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

        const openWeb = rightContainer.createEl('span', { cls: 'netopen_Web' });
        const openSettings = rightContainer.createEl('span', { cls: 'netopen_settings' });
        setIcon(openWeb, 'globe')
        setIcon(openSettings, 'lucide-bolt');


        const searchBoxContainer = clipperContainer.createEl('div', { cls: 'netclip_search_box' });
        const searchIcon = searchBoxContainer.createEl('span', { cls: 'netclip_search_icon' });
        setIcon(searchIcon, 'search');
        const searchInput = searchBoxContainer.createEl('input', {
            type: 'text',
            cls: 'netclip_search_input',
            placeholder: 'Search saved articles...'
        });

        const categoryTabsContainer = clipperContainer.createEl('div', { cls: 'netclip_category_tabs'});
        this.renderCategoryTabs(categoryTabsContainer);

        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const savedContainer = this.containerEl.querySelector('.netclip_saved_container') as HTMLElement;
            this.renderSavedContent(savedContainer, searchTerm);
        })

        const clipButtonContainer = clipperHeader.createEl('div', { cls: 'netclip_button_container' });
        const clipButton = clipButtonContainer.createEl('button', {
            cls: 'netclip_btn',
        });
        setIcon(clipButton, 'plus');

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
            this.app.setting.open();
            this.app.setting.openTabById('net-clip-settings');
        });

        clipButton.addEventListener("click", () => {
            new ClipModal(this.app, this.plugin).open();
        });

        await this.renderSavedContent(SavedContentBox)
    }

    public renderCategoryTabs(tabsContainer: HTMLElement){
        tabsContainer.empty();

        const allTab = tabsContainer.createEl('div', { 
            cls: `netclip_category_tab ${this.currentCategory === '' ? 'active' : ''}`,
            text: 'All',
        });

        allTab.addEventListener('click', () => this.switchCategory('', tabsContainer));

        this.plugin.settings.categories.forEach(category => {
            const tab = tabsContainer.createEl('div', {
                cls: `netclip_category_tab ${this.currentCategory === category ? 'active' : ''}`,
                text: category,   
            });
            tab.addEventListener('click', () => this.switchCategory(category, tabsContainer));
        })
    }

    private async switchCategory(category: string, tabsContainer: HTMLElement) {
        this.currentCategory = category;
        
        const tabs = tabsContainer.querySelectorAll('.netclip_category_tab ');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if ((category === '' && tab.textContent === 'All') || 
                tab.textContent === category) {
                tab.classList.add('active');
            }
        });

        const savedContainer = this.containerEl.querySelector(".netclip_saved_container") as HTMLElement;
        await this.renderSavedContent(savedContainer);
    }


    public async renderSavedContent(container: HTMLElement, filter: string = '') {
        container.empty();

        const files = this.app.vault.getMarkdownFiles();

        const clippedFiles = files.filter(file => {
            const isInMainFolder = file.path.startsWith(this.settings.defaultFolderName);
            if (!this.currentCategory) {
                return isInMainFolder;
            }
            return file.path.startsWith(`${this.settings.defaultFolderName}/${this.currentCategory}`);
        });

        const filteredFiles = filter
            ? clippedFiles.filter(file => file.basename.toLowerCase().includes(filter))
            : clippedFiles;

        if (filteredFiles.length === 0) {
            const emptyContainer = container.createEl('div', { cls: 'empty_box' });
            const emptyIcon = emptyContainer.createEl("span", { cls: 'empty_icon' });
            setIcon(emptyIcon, 'lucide-book-open');
            emptyContainer.createEl("p", { text: "No matching articles found." });
            return;
        }


        for (const file of filteredFiles) {
            const content = await this.app.vault.read(file);
            const clippedEl = container.createEl('div', { cls: 'netClip_card' });

            const thumbnailMatch = content.match(/!\[Thumbnail\]\((.+)\)/);
            const imageUrl = thumbnailMatch ? thumbnailMatch[1] : 'https://cdn.pixabay.com/photo/2023/12/14/06/45/chicken-8448262_1280.jpg'; // Use a default image if no thumbnail is found

            clippedEl.createEl("img", { attr: { src: imageUrl } });

            const clippedTitle = clippedEl.createEl("h6", { text: file.basename });
            clippedTitle.addEventListener('click', () => {
                this.openArticle(file);
            });

            const bottomContent = clippedEl.createEl("div", { cls: "netclip_card_bottom" });
            const urlMatch = content.match(/source: "([^"]+)"/);

            if (urlMatch) {
                const articleUrl = urlMatch[1];
                const domainName = getDomain(articleUrl);
                bottomContent.createEl("a", {
                    cls: "domain",
                    href: articleUrl,
                    text: domainName
                });
            } else {
                bottomContent.createEl("span", {
                    cls: "domain",
                    text: "Unknown source"
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