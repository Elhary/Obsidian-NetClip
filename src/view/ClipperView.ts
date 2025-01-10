import { ItemView, WorkspaceLeaf, TFile, Setting, setIcon } from 'obsidian'
import NetClipPlugin from '../main'
import { NetClipSettingTab } from '../settings'
import { getDomain, normalizeUrl } from '../utils'
import { DeleteConfirmationModal } from '../deleteModal'
import { ClipperContextMenu } from '../contextMenu'
import { VIEW_TYPE_WORKSPACE_WEBVIEW, WorkspaceLeafWebView } from './EditorWebView'

export const CLIPPER_VIEW = 'netClip_clipper_view';

export class clipperHomeView extends ItemView {
    private plugin: NetClipPlugin
    private settings: NetClipSettingTab
    icon = 'newspaper'

    constructor(leaf: WorkspaceLeaf, plugin: NetClipPlugin) {
        super(leaf);
        this.plugin = plugin
        this.settings = plugin.settings;
    }

    getViewType(): string {
        return CLIPPER_VIEW;
    }

    getDisplayText(): string {
        return 'Clipper View'
    }
async onOpen() {
        this.containerEl = this.containerEl.children[1] as HTMLElement;
        this.containerEl.empty();

        const clipperContainer = this.containerEl.createEl('div', { cls: 'net_clipper_container' })
        const clipperHeader = clipperContainer.createEl('div', { cls: 'net_clipper_header' })
        const openWeb = clipperHeader.createEl('span', { cls: 'netopen_Web' });
        const openSettings = clipperHeader.createEl('span', {cls: 'netopen_settings'});
        setIcon(openWeb, 'globe')
        setIcon(openSettings, 'lucide-bolt');
 
         
         const clipInputContainer = clipperContainer.createEl('div', {cls: 'netclip_input_container'});

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
         const clipInput = clipInputContainer.createEl('input', 
        {
             cls: 'net_clip_input', 
             type: 'text',
             placeholder: 'Enter URL to clip...'
        });

        const clipButton = clipInputContainer.createEl('button', {
        cls: 'netclip_btn', 
        text: 'Clip'
        });

        clipButton.addEventListener("click", () => {
            if(clipInput.value){
                const normalizedUrl = normalizeUrl(clipInput.value);

                if(normalizedUrl){
                    this.plugin.clipWebpage(normalizedUrl)
                }
                clipInput.value = ''

            }
        });
        const SavedContentBox = clipperContainer.createEl("div", { cls: "netclip_saved_container"});
        await this.renderSavedContent(SavedContentBox)
    }

    public async renderSavedContent(container: HTMLElement){
        container.empty();
    
        const files = this.app.vault.getMarkdownFiles();
        const clippedFiles = files.filter(file => file.path.startsWith(this.settings.defaultFolderName))
    
        if(clippedFiles.length === 0){
            const emptyContainer = container.createEl('div', { cls: 'empty_box' })
            const emptyIcon = emptyContainer.createEl("span", { cls: 'empty_icon' })
            setIcon(emptyIcon, 'lucide-book-open');
            emptyContainer.createEl("p", { text: "Nothing saved yet." });
            return;        
        }
    
        for (const file of clippedFiles){
            const content = await this.app.vault.read(file);
            const clippedEl = container.createEl('div', {cls: 'netClip_card'});
    
            const thumbnailMatch = content.match(/!\[Thumbnail\]\((.+)\)/);
            const imageUrl = thumbnailMatch ? thumbnailMatch[1] : 'https://cdn.pixabay.com/photo/2023/12/14/06/45/chicken-8448262_1280.jpg'; // Use a default image if no thumbnail is found
    
            clippedEl.createEl("img", { attr: { src: imageUrl }});
    
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
    



    private openArticle(file: TFile){
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