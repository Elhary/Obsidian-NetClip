import { App, Platform, setIcon, setTooltip } from 'obsidian';
import { WebSearch, WebSearchSettings } from './search/search'; 
import { ClipModal } from './modal/clipModal';
import { AdBlocker } from './adBlock';
import type * as Electron from 'electron';

let remote: any;

if (!Platform.isMobileApp) {
    remote = require('@electron/remote');
}

export interface WebviewTag extends HTMLElement {
    src: string;
    allowpopups?: boolean;
    partition?: string
    reload: () => void;
    getURL?: () => string;
    goBack?: () => void;
    goForward?: () => void;
    canGoBack?: () => boolean;
    canGoForward?: () => boolean;
    executeJavaScript: (code: string) => Promise<void>;
    remove: () => void;
    detach: () => void;
}

interface WebViewComponentSettings extends WebSearchSettings {
    defaultWidth?: string;
    defaultHeight?: string;
    fitToContainer?: boolean;
}

export class WebViewComponent {
    private static globalAdBlocker: AdBlocker | null = null;
    private frame: HTMLIFrameElement | WebviewTag;
    private url: string;
    private isFrameReady: boolean = false;
    private settings: WebViewComponentSettings;
    private backBtn: HTMLButtonElement;
    private forwardBtn: HTMLButtonElement;
    private refreshBtn: HTMLButtonElement;
    private clipBtn?: HTMLButtonElement;
    private modalClipBtn?: HTMLButtonElement; 
    private navigationHistory: string[] = [];
    private currentHistoryIndex: number = -1;
    private loadingSpinner: HTMLElement;
    private searchInput: HTMLInputElement;
    private search: WebSearch;
    private onClipCallback?: (url: string) => Promise<void>;
    private titleChangeCallback?: (title: string) => void;
    private windowOpenCallback?: (url: string) => void;
    private adBlocker: AdBlocker;
    private eventListeners: { element: HTMLElement; type: string; listener: EventListener }[] = [];
    private frameDoc: Document | null = null;

    constructor(
        private app: App,
        url: string,
        settings: WebViewComponentSettings = {},
        onClipCallback?: (url: string) => Promise<void>,
        private plugin?: any
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

        if(!WebViewComponent.globalAdBlocker){
            WebViewComponent.globalAdBlocker = new AdBlocker(plugin?.settings?.adBlock);
        }

        this.adBlocker = WebViewComponent.globalAdBlocker;
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

    private setupFrameContainer(containerEl: HTMLElement): HTMLElement {
        const frameContainer = containerEl.createDiv('netClip_frame-container');
        this.loadingSpinner = frameContainer.createDiv('loading-spinner');
        this.frameDoc = frameContainer.ownerDocument;
        this.frame = this.createFrame();
        frameContainer.appendChild(this.frame);
        return frameContainer;
    }

    private createFrame(): HTMLIFrameElement | WebviewTag {
        return Platform.isMobileApp ? this.createIframe() : this.createWebview();
    }

    private createWebview(): WebviewTag {
        const webview = this.frameDoc?.createElement('webview') as WebviewTag || document.createElement('webview') as WebviewTag;
        webview.classList.add('webview');

        webview.setAttribute('allowpopups', '');
        webview.setAttribute('webpreferences', 'contextIsolation=yes, nodeIntegration=no');
        webview.setAttribute('plugins', 'true');
        

        if (!this.plugin?.settings?.privateMode) {
            webview.partition = 'persist:netclip-shared';
        } else {
            const sessionId = `private-${Date.now()}`;
            webview.partition = `persist:${sessionId}`;
        }
        
        if (this.plugin?.settings?.privateMode) {
            webview.setAttribute('disablewebsecurity', 'true');
            webview.setAttribute('disableblinkfeatures', 'AutomationControlled');
            webview.setAttribute('disablefeatures', 'Translate,NetworkService');
            webview.setAttribute('cookiestore', 'private');
            webview.setAttribute('disablethirdpartycookies', 'true');
        }

        webview.src = this.url;

        // Handle window destruction and recreation
        webview.addEventListener('destroyed', () => {
            const parent = webview.parentElement;
            if (parent && parent.ownerDocument !== this.frameDoc) {
                this.cleanupWebview(webview);
                
          
                this.frameDoc = parent.ownerDocument;
                
                const newWebview = this.createWebview();
                parent.appendChild(newWebview);
                this.frame = newWebview;
                this.setupWebviewEvents(newWebview);
            }
        });

        this.setupWebviewEvents(webview);
        return webview;
    }

    private cleanupWebview(webview: WebviewTag): void {
        if (webview) {
            try {
                webview.remove();
            } catch (e) {
                // console.warn('Error cleaning up webview:', e); 
            }
        }
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
        const clipContianer = container.createDiv('netClip_clip_btn_container');

        if (this.onClipCallback) {
            this.clipBtn = clipContianer.createEl('button', {
                 text: 'Quick clip',
                 cls: 'netClip_quick_clip_btn netClip_btn'
            });

            setIcon(this.clipBtn, 'folder-down')
            setTooltip(this.clipBtn, 'Quick save');

            this.clipBtn.onclick = () => {
                this.onClipCallback?.(this.getCurrentUrl());
            };
        }

        if (this.plugin) {
            this.modalClipBtn = clipContianer.createEl('button', { 
                cls: 'netClip_modal_clip_btn netClip_btn'
            });

            setIcon(this.modalClipBtn, 'folder-symlink'); 
            setTooltip(this.modalClipBtn, 'Save to...');

            this.modalClipBtn.onclick = () => {
                if (this.plugin) {
                    const modal = new ClipModal(this.app, this.plugin);
                    modal.tryGetClipboardUrl = async () => this.getCurrentUrl();
                    modal.open();
                }
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

    private createIframe(): HTMLIFrameElement {
        const iframe = document.createElement('iframe');
        iframe.setAttribute('allowpopups', '');
        iframe.setAttribute('credentialless', 'true');
        iframe.setAttribute('crossorigin', 'anonymous');
        iframe.setAttribute('src', this.url);

        let sandbox = 'allow-forms allow-modals allow-popups allow-presentation allow-scripts allow-top-navigation-by-user-activation';
        if(!this.plugin?.settings?.privateMode){
            sandbox += ' allow-same-origin';
        }
        iframe.setAttribute('sandbox', sandbox);

        iframe.setAttribute('allow', 'encrypted-media;fullscreen;oversized-images;picture-in-picture;sync-xhr;geolocation');
        iframe.addEventListener('load', () => {
            this.onFrameLoad();
            if (this.plugin?.settings?.adBlock?.enabled) {
                setTimeout(() => {
                    if (iframe.contentDocument) {
                        this.adBlocker.applyFilters(iframe as unknown as Electron.WebviewTag);
                    }
                }, 500);
            }
            const title = iframe.contentDocument?.title;
            if(title && this.titleChangeCallback){
                this.titleChangeCallback(title);
            }
        });
        return iframe;
    }

    private setupWebviewEvents(webview: WebviewTag): void {
        webview.addEventListener('dom-ready', () => {
            this.isFrameReady = true;
            this.updateUrlDisplay();
            this.loadingSpinner.classList.remove('loading-spinner-visible');

            const webContents = remote.webContents.fromId((webview as any).getWebContentsId());
            
    
            webContents.setWindowOpenHandler(({url}: {url: string}) => {
                if (this.windowOpenCallback) {
                    this.windowOpenCallback(url);
                    return {action: 'deny'};
                }
                
                if (this.plugin?.settings?.privateMode) {
                    this.createNewPrivateWindow(url);
                    return {action: 'deny'};
                }
                
       
                return {
                    action: 'allow',
                    overrideBrowserWindowOptions: {
                        width: 800,
                        height: 600,
                        webPreferences: {
                            nodeIntegration: false,
                            contextIsolation: true,
                            webSecurity: true,
                            partition: webview.partition,
                            javascript: true,
                            plugins: true,
                            webgl: true
                        }
                    }
                };
            });

            if (this.plugin?.settings?.adBlock?.enabled) {
                this.setupAdBlocking(webview);
            }

            if (this.plugin?.settings?.privateMode) {
                this.setupPrivateMode(webview);
            }
        });


        webview.addEventListener('did-start-loading', () => {
            this.loadingSpinner.classList.add('loading-spinner-visible');
        });

        webview.addEventListener('did-stop-loading', () => {
            this.loadingSpinner.classList.remove('loading-spinner-visible');
        });

        webview.addEventListener('did-navigate', () => {
            this.updateUrlDisplay();
            this.updateNavigationButtons();
        });

        webview.addEventListener('did-navigate-in-page', () => {
            this.updateUrlDisplay();
            this.updateNavigationButtons();
        });

        webview.addEventListener('page-title-updated', (event: any) => {
            if(this.titleChangeCallback){
                this.titleChangeCallback(event.title);
            }
        });

        webview.addEventListener('did-fail-load', (event: any) => {
            this.loadingSpinner.classList.remove('loading-spinner-visible');
        });
    }

    private createNewPrivateWindow(url: string): void {
        const container = document.createElement('div');
        container.classList.add('netClip_webview_container');
        
        const controlsEl = container.createDiv('netClip_web_controls');
        this.setupNavigationBtns(controlsEl);
        this.setupSearchInput(controlsEl);
        this.setupClipBtn(controlsEl);
        
        const frameContainer = container.createDiv('netClip_frame-container');
        const newWebview = this.createWebview();
        newWebview.src = url;
        frameContainer.appendChild(newWebview);
        
        document.body.appendChild(container);
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.width = '80%';
        container.style.height = '80%';
        container.style.zIndex = '1000';
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

    onTitleChange(callback: (title: string) => void){
        this.titleChangeCallback = callback
    }

    onWindowOpen(callback: (url: string) => void){
        this.windowOpenCallback = callback;
    }

    private setupAdBlocking(webview: WebviewTag): void {
        this.adBlocker.initializeFilters().then(() => {
            this.adBlocker.applyFilters(webview as unknown as Electron.WebviewTag);
            
            webview.addEventListener('dom-ready', () => {
                webview.executeJavaScript(this.adBlocker.getDOMFilterScript())
                    .catch(error => {
                        // console.error('Adblock script error:', error); 
                    });
            });
        });
    }

    private setupPrivateMode(webview: WebviewTag): void {
        webview.executeJavaScript(`
            window.sessionStorage.clear();
            window.localStorage.clear();
            
            // Override storage APIs
            Object.defineProperties(window, {
                'localStorage': {
                    value: undefined
                },
                'sessionStorage': {
                    value: undefined
                }
            });
            
            // Clear cookies
            document.cookie.split(';').forEach(cookie => {
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
                document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
            });
        `).catch(console.error);

        const webContents = remote.webContents.fromId((webview as any).getWebContentsId());
        webContents.session.webRequest.onBeforeSendHeaders((details: any, callback: any) => {
            const requestHeaders = {
                ...details.requestHeaders,
                'DNT': '1',
                'Sec-GPC': '1'
            };
            callback({ requestHeaders });
        });
    }

    private addEventListenerWithCleanup(element: HTMLElement, type: string, listener: EventListener) {
        element.addEventListener(type, listener);
        this.eventListeners.push({ element, type, listener });
    }

    unload() {
        this.eventListeners.forEach(({ element, type, listener }) => {
            element.removeEventListener(type, listener);
        });
        this.eventListeners = [];
        
        if (this.frame) {
            this.frame.remove();
        }
        
        if (this.search) {
            this.search.unload();
        }
    }
}