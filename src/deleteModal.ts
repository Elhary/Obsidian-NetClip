import { Modal, TFile } from 'obsidian';

export class DeleteConfirmationModal extends Modal {
    private file: TFile;
    private onConfirmDelete: () => Promise<void>;

    constructor(app: any, file: TFile, onConfirmDelete: () => Promise<void>) {
        super(app);
        this.file = file;
        this.onConfirmDelete = onConfirmDelete;
    }

    onOpen() {
        this.titleEl.setText('Confirm Delete');
        this.contentEl.createEl('p', { text: `Are you sure you want to delete the article "${this.file.basename}"?` });
        
        const buttonContainer = this.contentEl.createEl('div', { cls: 'netclip_button-container' });
        
        const confirmButton = buttonContainer.createEl('button', { 
            cls: 'mod-warning',
            text: 'Delete' 
        });
        
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        
        confirmButton.addEventListener('click', async () => {
            await this.onConfirmDelete();
            this.close();
        });
        
        cancelButton.addEventListener('click', () => {
            this.close();
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}