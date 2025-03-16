import { App, Modal, Setting } from 'obsidian';

export class WarningModal extends Modal {
    private onConfirm: (result: boolean) => void;
    private message: string;
    private title: string;

    constructor(app: App, title: string, message: string, onConfirm: (result: boolean) => void) {
        super(app);
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
    }

    onOpen() {
        this.titleEl.setText(this.title);
        this.contentEl.createDiv().setText(this.message);
        
        new Setting(this.contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.onConfirm(false);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Delete')
                .setWarning()
                .onClick(() => {
                    this.onConfirm(true);
                    this.close();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
} 