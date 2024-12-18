import { App, Modal, Notice } from 'obsidian';
import { WebViewComponent } from '../webViewComponent';
import WebClipperPlugin from '../main';

interface ModalWebViewSettings {
    defaultWidth: string;
    defaultHeight: string;
}

const DEFAULT_SETTINGS: ModalWebViewSettings = {
    defaultWidth: '100%',
    defaultHeight: '100%',
};
export class WebViewModal extends Modal {
    private webViewComponent: WebViewComponent;
    private plugin: WebClipperPlugin;
    private settings: ModalWebViewSettings;

    constructor(
        app: App, 
        url: string, 
        settings: ModalWebViewSettings = DEFAULT_SETTINGS, 
        plugin: WebClipperPlugin
    ) {
        super(app);
        this.plugin = plugin;
        
        this.settings = {
            defaultWidth: plugin?.settings?.modalWidth || settings.defaultWidth || '80vw',
            defaultHeight: plugin?.settings?.modalHeight || settings.defaultHeight || '80vh'
        };
        


        this.webViewComponent = new WebViewComponent(
            this.app, 
            url, 
            {
                defaultWidth: this.settings.defaultWidth,
                defaultHeight: this.settings.defaultHeight,
                searchEngine: plugin?.settings?.searchEngine || 'default'
            },

            async (clipUrl) => {
                if (this.plugin && typeof this.plugin.clipWebpage === 'function') {
                    await this.plugin.clipWebpage(clipUrl);
                } else {
                    new Notice('Clip webpage function not available');
                }
            }
        );
    }

    onOpen() {
        const { contentEl } = this;
        
        this.modalEl.style.width = this.settings.defaultWidth;
        this.modalEl.style.height = this.settings.defaultHeight;

        const webViewContainer = this.webViewComponent.createContainer();
        contentEl.appendChild(webViewContainer);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}