import { ItemView, WorkspaceLeaf,  Notice, ViewStateResult } from 'obsidian';
import WebClipperPlugin from '../main';
import { WebViewComponent } from '../webViewComponent';
import { t } from '../translations';
import { CLIPPER_VIEW } from './ClipperView';

export const VIEW_TYPE_WORKSPACE_WEBVIEW = 'netClip_workspace_webview';

export class WorkspaceLeafWebView extends ItemView {
    private webViewComponent: WebViewComponent;
    private plugin: WebClipperPlugin;
    private initialUrl = '';
    icon = 'globe';
    url: string | undefined;
    currentTitle = 'Web View'
    public onLoadEvent: Promise<void>;
    private resolveLoadEvent: () => void;

    constructor(leaf: WorkspaceLeaf, plugin: WebClipperPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.onLoadEvent = new Promise((resolve) => {
            this.resolveLoadEvent = resolve;
        });
    }

    setUrl(url: string) {
        this.initialUrl = url;
        this.reloadWebView();
    }

    getViewType(): string {
        return VIEW_TYPE_WORKSPACE_WEBVIEW;
    }

    getDisplayText(): string {
        return this.currentTitle;
    }

    private reloadWebView() {
        this.containerEl.empty();
        this.createWebViewComponent();
    }

    private handleDisabledWebview(): void {
        new Notice(t('webview_disabled_notice'));
        try {
            this.leaf.setViewState({ type: CLIPPER_VIEW });
        } catch (e) {
            try { this.leaf.detach(); } catch (err) {}
        }
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        if (state?.url) {
            this.initialUrl = state.url;
            this.reloadWebView();
        }
        super.setState(state, result);
    }
    
    private createWebViewComponent() {
        if (!this.plugin.settings.enableWebview) {
            this.handleDisabledWebview();
            return;
        }

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
            },
            this.plugin
        );

        this.webViewComponent.onWindowOpen((url: string) => {
            const leaf = this.app.workspace.getLeaf(true);
            leaf.setViewState({
                type: VIEW_TYPE_WORKSPACE_WEBVIEW,
                state: {url: url}
            })
            this.app.workspace.revealLeaf(leaf);
        })
  
        const containerEl = this.webViewComponent.createContainer();

        this.webViewComponent.onTitleChange((title: string) => {
            this.currentTitle = title;
            this.leaf.setViewState({
                type: VIEW_TYPE_WORKSPACE_WEBVIEW,
                state: { title: title }
            });
        });
        
        this.containerEl.appendChild(containerEl);
    }

    async onOpen(): Promise<void> {
        this.containerEl = this.containerEl.children[1] as HTMLElement;
        this.containerEl.empty();
    
        const state = this.leaf.getViewState();
        if(state.state?.url && typeof state.state.url === 'string'){
            this.initialUrl = state.state.url;
        }else{
            this.initialUrl = this.plugin.settings.defaultWebUrl || 'https://google.com';
        }
    
        this.createWebViewComponent();
        this.resolveLoadEvent();
    }
    

    async onClose(): Promise<void> {
        this.containerEl.empty();
    }
}