import { App, Modal, Setting } from 'obsidian';
import { AIPrompt } from '../settings';

export class PromptModal extends Modal {
    private prompt: AIPrompt;
    private tempPrompt: AIPrompt;
    private onSave: (prompt: AIPrompt) => void;
    private pendingVariableChanges: Map<string, { newName: string, values: string[] }> = new Map();

    constructor(app: App, prompt: AIPrompt, onSave: (prompt: AIPrompt) => void) {
        super(app);
        this.prompt = prompt;
        this.tempPrompt = JSON.parse(JSON.stringify(prompt)); 
        this.onSave = onSave;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('netclip_prompt_modal');


        contentEl.createEl('h2', { text: 'Edit Prompt' });

        new Setting(contentEl)
            .setName('Name')
            .addText(text => text
                .setValue(this.tempPrompt.name)
                .onChange(value => this.tempPrompt.name = value));

        new Setting(contentEl)
            .setName('Prompt')
            .setDesc('Use ${variableName} for variables. ${content} is a special built-in variable that contains the extracted content.')
            .addTextArea(text => text
                .setValue(this.tempPrompt.prompt)
                .onChange(value => this.tempPrompt.prompt = value));

        const variablesContainer = contentEl.createDiv();
        variablesContainer.createEl('h3', { text: 'Variables' });

        Object.entries(this.tempPrompt.variables || {}).forEach(([key, values]) => {
            this.createVariableSection(variablesContainer, key, values);
        });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Add Variable')
                .onClick(() => {
                    const newKey = 'newVariable' + Object.keys(this.tempPrompt.variables || {}).length;
                    this.tempPrompt.variables = {
                        ...this.tempPrompt.variables,
                        [newKey]: []
                    };
                    this.createVariableSection(variablesContainer, newKey, []);
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(() => {
                    for (const [oldKey, change] of this.pendingVariableChanges) {
                        const newVars = { ...this.tempPrompt.variables };
                        if (oldKey !== change.newName) {
                            delete newVars[oldKey];
                        }
                        newVars[change.newName] = change.values;
                        this.tempPrompt.variables = newVars;
                    }
                    this.onSave(this.tempPrompt);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.tempPrompt = JSON.parse(JSON.stringify(this.prompt)); 
                    this.close();
                }));
    }

    private createVariableSection(container: HTMLElement, key: string, values: string[]) {
        const varContainer = container.createDiv({ cls: 'prompt-variable-container' });

        new Setting(varContainer)
            .setName('Variable Name')
            .setDesc('Enter a name for your variable. Use ${variableName} in your prompt to reference it.')
            .addText(text => {
                text.setValue(key)
                    .setPlaceholder("Enter variable name");
                
                text.inputEl.addEventListener('input', (e) => {
                    const newName = (e.target as HTMLInputElement).value;
                    if (newName !== key) {
                        this.pendingVariableChanges.set(key, {
                            newName,
                            values: this.tempPrompt.variables[key]
                        });
                    } else {
                        this.pendingVariableChanges.delete(key);
                    }
                });
                return text;
            });

        new Setting(varContainer)
            .setName('Variable Values')
            .setDesc('Add possible values for this variable, one per line')
            .addTextArea(text => {
                text.setPlaceholder("Enter possible values, one per line")
                    .setValue(values.join('\n'))
                    .onChange(value => {
                        const newValues = value.split('\n').filter(v => v.trim());
                        const existingChange = this.pendingVariableChanges.get(key);
                        if (existingChange) {
                            existingChange.values = newValues;
                        } else {
                            this.pendingVariableChanges.set(key, {
                                newName: key,
                                values: newValues
                            });
                        }
                    });
                return text;
            });

        new Setting(varContainer)
            .addButton(btn => btn
                .setIcon('trash')
                .setClass('netclip_trash')
                .setTooltip('Delete variable')
                .onClick(() => {
                    const modal = new Modal(this.app);
                    modal.titleEl.setText('Delete Variable');
                    modal.contentEl.createDiv().setText(`Are you sure you want to delete the variable "${key}"?`);
                    
                    new Setting(modal.contentEl)
                        .addButton(btn => btn
                            .setButtonText('Cancel')
                            .onClick(() => {
                                modal.close();
                            }))
                        .addButton(btn => btn
                            .setButtonText('Delete')
                            .setWarning()
                            .onClick(() => {
                                const newVars = { ...this.tempPrompt.variables };
                                delete newVars[key];
                                this.tempPrompt.variables = newVars;
                                varContainer.remove();
                                modal.close();
                            }));
                    
                    modal.open();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 
