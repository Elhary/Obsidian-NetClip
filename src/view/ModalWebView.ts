import { App, Modal, Notice } from 'obsidian';
import { WebViewComponent } from '../webViewComponent';
import WebClipperPlugin from '../main';


export class WebViewModal extends Modal {
    private webViewComponent: WebViewComponent;
    private plugin: WebClipperPlugin;


    constructor(
        app: App, 
        url: string, 
        plugin: WebClipperPlugin
    ) {
        super(app);
        this.plugin = plugin;
    
        this.modalEl.addClass('netclip_modal');


        this.webViewComponent = new WebViewComponent(
            this.app, 
            url, 
            {
                searchEngine: plugin?.settings?.searchEngine || 'default'
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
    }

    
    onOpen() {
        const { contentEl } = this;
        const webViewContainer = this.webViewComponent.createContainer();
        contentEl.appendChild(webViewContainer);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}