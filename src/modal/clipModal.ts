import {App, Modal} from 'obsidian';
import NetClipPlugin from "../main";
import { normalizeUrl } from "../utils";

export class ClipModal extends Modal {
    modalEl: HTMLElement;

    constructor(app: App, private plugin: NetClipPlugin){
        super(app)
    }

    async tryGetClipboardUrl(): Promise<string>{
        try{
            const text = await navigator.clipboard.readText();
            const url = normalizeUrl(text);
            return url || '';
        } catch (error){
            console.warn('failed to read clipboard', error);
            return '';
        }
    }

    async onOpen(){
        this.modalEl.addClass('netclip_clip_modal');

        const {contentEl} = this;
        contentEl.addClass('netclip_clip_modal_content');
        contentEl.createEl('h2', {text: 'Clip webpage'});


        const clipContainer = contentEl.createDiv({cls: 'netclip_clip_container'});
        const urlContainer = clipContainer.createDiv({cls: 'netclip_clip_url_container'});

        urlContainer.createEl('label', {text: 'Url:'});
        const urlInput = urlContainer.createEl('input', {
            type: 'text',
            cls: 'netclip_clip_input',
            placeholder: 'Enter URL to clip...'
        });

        const clipboardUrl = await this.tryGetClipboardUrl();
        if (clipboardUrl){
            urlInput.value = clipboardUrl;
        }

        const categoryContainer = clipContainer.createDiv({cls: 'netclip_clip_category_container'});
        categoryContainer.createEl('label', {text: 'Save to:'});
        const categorySelect = categoryContainer.createEl('select');

        categorySelect.createEl('option', {
            value: '',
            text: 'All'
        });
        
        this.plugin.settings.categories.forEach(category => {
            categorySelect.createEl('option', {
                value: category,
                text: category
            });
        });

        const clipButton = contentEl.createEl('button', {text: 'Clip'});

        clipButton.addEventListener('click', async () => {
            if(urlInput.value){
                const normalizedUrl = normalizeUrl(urlInput.value);
                if (normalizedUrl){
                    await this.plugin.clipWebpage(normalizedUrl, categorySelect.value);
                    this.close(); 
                }
            }
        });

    }

    onClose(){
        const {contentEl} = this;
        contentEl.empty();
    }

}