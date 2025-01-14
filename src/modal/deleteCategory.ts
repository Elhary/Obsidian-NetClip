import { App, Modal} from 'obsidian';

export class DeleteCategoryModal extends Modal{
    private result: boolean = false;

    constructor(
        app: App,
        private categoryName: string,
        private onSubmit: (result: boolean) => void
    ){
        super(app);
    }


    onOpen() {

        const {contentEl} = this;

        contentEl.createEl('h2', {text: 'Delete category'});
        contentEl.createEl('p', { 
            text: `The folder "${this.categoryName}" is not empty. Are you sure you want to delete it and all its contents?` 
        });

        const buttonContainer = contentEl.createEl('div', {
            cls: 'netclip_button-container'
        });



        const confirmButton = buttonContainer.createEl('button', {
            text: 'Delete',
            cls: 'netclip_warning'
        });

        const cancelButton = buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'netclip_cancel'
        });

        cancelButton.onclick = () => {
            this.result = false;
            this.close();
        };

        confirmButton.onclick = () => {
            this.result = true;
            this.close();
        }
        
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onSubmit(this.result);
    }

}