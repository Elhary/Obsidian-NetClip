import { ItemView, WorkspaceLeaf,  Notice } from 'obsidian';
import WebClipperPlugin from '../main';
import { WebViewComponent } from '../webViewComponent';

export const VIEW_TYPE_WORKSPACE_WEBVIEW = 'netClip_workspace_webview';

export class WorkspaceLeafWebView extends ItemView {
    private webViewComponent: WebViewComponent;
    private plugin: WebClipperPlugin;
    private initialUrl: string = '';
    icon = 'globe';
    url: string | undefined;

    constructor(leaf: WorkspaceLeaf, plugin: WebClipperPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    setUrl(url: string) {
        this.initialUrl = url;
        this.reloadWebView();
    }

    getViewType(): string {
        return VIEW_TYPE_WORKSPACE_WEBVIEW;
    }

    getDisplayText(): string {
        return 'Web View';
    }

    private reloadWebView() {
        this.containerEl.empty();
        this.createWebViewComponent();
    }

    
    private createWebViewComponent() {
        this.webViewComponent = new WebViewComponent(
            this.app, 
            this.initialUrl, 
            {
                searchEngine: this.plugin.settings.searchEngine
            },
            async (clipUrl) => {
                if (this.plugin && typeof this.plugin.clipWebpage === 'function') {
                    await this.plugin.clipWebpage(clipUrl);
                } else {
                    new Notice('Clip webpage function not available');
                }
            }
        );
  
        const containerEl = this.webViewComponent.createContainer();
        this.containerEl.appendChild(containerEl);
    }

    async onOpen(): Promise<void> {
        this.containerEl = this.containerEl.children[1] as HTMLElement;
        this.containerEl.empty();
    
        const stateUrl = this.leaf.getViewState().state?.url;
        this.initialUrl = (typeof stateUrl === 'string' && stateUrl) || this.plugin.settings.defaultWebUrl || 'https://google.com';
    
        this.createWebViewComponent();
    }
    

    async onClose(): Promise<void> {
        this.containerEl.empty();
    }
}