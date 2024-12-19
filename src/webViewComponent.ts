import { App, Platform, setIcon } from 'obsidian';
import { WebSearch, WebSearchSettings } from './search/search'; 

export interface WebviewTag extends HTMLElement {
    src: string;
    allowpopups?: boolean;
    reload: () => void;
    getURL?: () => string;
    goBack?: () => void;
    goForward?: () => void;
    canGoBack?: () => boolean;
    canGoForward?: () => boolean;
}


interface WebViewComponentSettings extends WebSearchSettings {
    defaultWidth?: string;
    defaultHeight?: string;
    fitToContainer?: boolean;
}




export class WebViewComponent {
    private frame: HTMLIFrameElement | WebviewTag;
    private url: string;
    private isFrameReady: boolean = false;
    private settings: WebViewComponentSettings;
    private backBtn: HTMLButtonElement;
    private forwardBtn: HTMLButtonElement;
    private refreshBtn: HTMLButtonElement;
    private clipBtn?: HTMLButtonElement;
    private navigationHistory: string[] = [];
    private currentHistoryIndex: number = -1;
    private loadingSpinner: HTMLElement;
    private searchInput: HTMLInputElement;
    private search: WebSearch;

    private onClipCallback?: (url: string) => Promise<void>;

    constructor(
        private app: App,
        url: string,
        settings: WebViewComponentSettings = {},
        onClipCallback?: (url: string) => Promise<void>
    ) {
        this.url = url;
        this.settings = {
            defaultWidth: '100%',
            defaultHeight: '100%',
            searchEngine: 'google',
            fitToContainer: true,
            ...settings
        };
        this.onClipCallback = onClipCallback;
    }


    createContainer(): HTMLElement {

        const containerEl = document.createElement('div');
        containerEl.classList.add('netClip_webview_container');
        const controlsEl = containerEl.createDiv('netClip_web_controls');

        this.setupNavigationBtns(controlsEl);
        this.setupSearchInput(controlsEl);
        this.setupClipBtn(controlsEl);
        this.setupFrameContainer(containerEl);

        this.navigationHistory.push(this.url);
        this.currentHistoryIndex = 0;

        return containerEl;

    }






    private setupSearchInput(container: HTMLElement): void {
        const searchContainer = container.createDiv('netClip_search_container');
        this.searchInput = searchContainer.createEl('input', { type: 'text', placeholder: 'Search...', value: this.url });

        const suggestionContainer = searchContainer.createDiv('netClip_query_box');
        const suggestionsBox = suggestionContainer.createDiv('netClip_suggestions');


        this.search = new WebSearch(
            this.searchInput,
            suggestionContainer,
            suggestionsBox,
            { searchEngine: this.settings.searchEngine }
        );


        this.searchInput.addEventListener('search-query', (event: CustomEvent) => {
            const { url } = event.detail;
            this.navigateTo(url);
        });

    }


    private setupClipBtn(container: HTMLElement): void {
        if (this.onClipCallback) {
            const clipContianer = container.createDiv('netClip_clip_btn_container');
            this.clipBtn = clipContianer.createEl('button', { text: 'Clip' });
            this.clipBtn.onclick = () => {
                this.onClipCallback?.(this.getCurrentUrl());
            };
        }
    }


    private setupNavigationBtns(container: HTMLElement): void {
        const leftContainer = container.createDiv('netClip_nav_left');

        this.backBtn = leftContainer.createEl('button', { cls: 'netClip_back_btn netClip_btn' });
        setIcon(this.backBtn, 'chevron-left');

        this.backBtn.onclick = () => this.goBack();
        this.backBtn.disabled = true;


        this.forwardBtn = leftContainer.createEl('button', { cls: 'netClip_forward_btn netClip_btn' });
        setIcon(this.forwardBtn, 'chevron-right');

        this.forwardBtn.onclick = () => this.goForward();
        this.forwardBtn.disabled = true;


        this.refreshBtn = leftContainer.createEl('button', { cls: 'netClip_refresh_btn netClip_btn' });
        setIcon(this.refreshBtn, 'rotate-ccw');
        this.refreshBtn.onclick = () => this.refresh();

    }


    
    private setupFrameContainer(containerEl: HTMLElement): HTMLElement {
        const frameContainer = containerEl.createDiv('netClip_frame-container');
        this.loadingSpinner = frameContainer.createDiv('loading-spinner');


        this.frame = this.createFrame();
        frameContainer.appendChild(this.frame);
        return frameContainer;
    }


    private createFrame(): HTMLIFrameElement | WebviewTag {
        return Platform.isMobileApp ? this.createIframe() : this.createWebview();
      }


    private createIframe(): HTMLIFrameElement {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('allowpopups', '');
        iframe.setAttribute('credentialless', 'true');
        iframe.setAttribute('crossorigin', 'anonymous');
        iframe.setAttribute('src', this.url);
        iframe.setAttribute('sandbox', 'allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-top-navigation-by-user-activation');
        iframe.setAttribute('allow', 'encrypted-media;fullscreen;oversized-images;picture-in-picture;sync-xhr;geolocation');
        iframe.addEventListener('load', () => {
          this.onFrameLoad();
        });
        return iframe;
      }
    
      // Create webview for desktop
      private createWebview(): WebviewTag {
        const webview = document.createElement('webview') as WebviewTag;
        webview.classList.add('webview');
        webview.allowpopups = true;
        webview.src = this.url;
    
        webview.addEventListener('dom-ready', () => {
          this.isFrameReady = true;
          this.updateUrlDisplay();
          this.loadingSpinner.classList.add('loading-spinner-visible'); 
        });
    
        webview.addEventListener('did-start-loading', () => {
            this.loadingSpinner.classList.add('loading-spinner-visible'); 
        });
    
        webview.addEventListener('did-stop-loading', () => {
            this.loadingSpinner.classList.add('loading-spinner-visible'); 
        });
    
        webview.addEventListener('did-navigate', () => {
          this.updateUrlDisplay();
          this.updateNavigationButtons();
        });
    
        webview.addEventListener('did-navigate-in-page', () => {
          this.updateUrlDisplay();
          this.updateNavigationButtons();
        });
    
        return webview;
      }




    private onFrameLoad(): void {
        this.isFrameReady = true;
        this.updateUrlDisplay();
    
        const currentUrl = this.getCurrentUrl();
        if (currentUrl !== this.navigationHistory[this.currentHistoryIndex]) {
          this.navigationHistory = this.navigationHistory.slice(0, this.currentHistoryIndex + 1);
          this.navigationHistory.push(currentUrl);
          this.currentHistoryIndex++;
          this.updateNavigationButtons();
        }
      }





    private navigateTo(url: string): void {
        this.url = url;
        this.navigationHistory.push(this.url);
        this.currentHistoryIndex = this.navigationHistory.length - 1;
        this.frame.src = this.url;
        this.updateUrlDisplay();
    }





    private getCurrentUrl(): string {
        if (this.frame instanceof HTMLIFrameElement) {
            return this.frame.contentWindow?.location.href || this.url;
        } else if (this.frame && typeof this.frame.getURL === 'function') {
            return this.frame.getURL() || this.url;
        }
        return this.url;
    }




    private updateUrlDisplay(): void {
        const currentUrl = this.getCurrentUrl();
        this.url = currentUrl;

        if (this.searchInput) {
            this.searchInput.value = currentUrl;
        }
    }




    private updateNavigationButtons(): void {
        if (this.frame instanceof HTMLIFrameElement) {
            this.backBtn.disabled = this.currentHistoryIndex <= 0;
            this.forwardBtn.disabled = this.currentHistoryIndex >= this.navigationHistory.length - 1;
        } else {
            const webview = this.frame as WebviewTag;
            this.backBtn.disabled = !(webview.canGoBack?.());
            this.forwardBtn.disabled = !(webview.canGoForward?.());
        }
    }





    private goBack(): void {
        if (this.isFrameReady) {
            this.loadingSpinner.classList.add('loading-spinner-visible');

            if (this.frame instanceof HTMLIFrameElement) {
                if (this.currentHistoryIndex > 0) {
                    this.currentHistoryIndex--;
                    this.frame.src = this.navigationHistory[this.currentHistoryIndex];
                }
            } else {
                const webview = this.frame as WebviewTag;
                if (webview.canGoBack?.()) {
                    webview.goBack?.();
                }
            }
        }
    }




    private goForward(): void {
        if (this.isFrameReady) {
            this.loadingSpinner.classList.add('loading-spinner-visible'); 

            if (this.frame instanceof HTMLIFrameElement) {
                if (this.currentHistoryIndex < this.navigationHistory.length - 1) {
                    this.currentHistoryIndex++;
                    this.frame.src = this.navigationHistory[this.currentHistoryIndex];
                }
            } else {
                const webview = this.frame as WebviewTag;
                if (webview.canGoForward?.()) {
                    webview.goForward?.();
                }
            }
        }
    }



    private refresh(): void {
        if (this.isFrameReady) {
            this.loadingSpinner.classList.add('loading-spinner-visible'); 
            if (this.frame instanceof HTMLIFrameElement) {
                this.frame.contentWindow?.location.reload();
            } else {
                this.frame.reload();
            }
        }
    }



}