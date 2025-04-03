import { App, Modal, Setting } from 'obsidian';
import { getDomain } from '../utils';
import { t } from '../translations';

export interface Shortcut {
    id: string;
    name: string;
    url: string;
}

export class ShortcutModal extends Modal {
    private shortcut: Shortcut | null;
    private nameInput: HTMLInputElement;
    private urlInput: HTMLInputElement;
    private onSubmit: (shortcut: Shortcut | null) => void;

    constructor(app: App, shortcut: Shortcut | null, onSubmit: (shortcut: Shortcut | null) => void) {
        super(app);
        this.shortcut = shortcut;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: this.shortcut ? 'Edit shortcut' : 'Add shortcut' });
        
        // URL input field
        new Setting(contentEl)
            .setName('URL')
            .setDesc('Enter the website URL')
            .addText(text => {
                this.urlInput = text.inputEl;
                text.setValue(this.shortcut?.url || '');
                text.setPlaceholder('https://example.com');
            });
            
        new Setting(contentEl)
            .setName('Title (optional)')
            .setDesc('Enter shorcut title')
            .addText(text => {
                this.nameInput = text.inputEl;
                text.setValue(this.shortcut?.name || '');
                text.setPlaceholder('My shortcut');
            });
            
        const buttonContainer = contentEl.createDiv({ cls: 'netclip-modal-buttons' });
        
        buttonContainer.createEl('button', {
            text: t('cancel') || 'Cancel',
            cls: 'netclip-modal-button-cancel'
        }).addEventListener('click', () => {
            this.close();
        });
        
        buttonContainer.createEl('button', {
            text: this.shortcut ? t('update') || 'Update' : t('add') || 'Add',
            cls: 'netclip-modal-button-submit'
        }).addEventListener('click', () => {
            this.handleSubmit();
        });
    }

    private handleSubmit() {
        const url = this.urlInput.value.trim();
        
        if (!url) {
            this.urlInput.classList.add('is-invalid');
            return;
        }
        
        // Add https:// if protocol is missing
        let finalUrl = url;
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
            finalUrl = 'https://' + finalUrl;
        }
        
        const name = this.nameInput.value.trim();
        
        const shortcut: Shortcut = {
            id: this.shortcut?.id || '',
            name: name,
            url: finalUrl,
        };
        
        this.onSubmit(shortcut);
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}