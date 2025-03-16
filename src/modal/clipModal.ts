import {App, Modal, Setting} from 'obsidian';
import NetClipPlugin from "../main";
import { normalizeUrl } from "../utils";
import { AIPrompt } from '../settings';
import { AIProcessingModal } from './aiProcessingModal';

export class ClipModal extends Modal {
    modalEl: HTMLElement;
    private selectedPrompts: AIPrompt[] = [];
    private selectedVariables: Record<string, Record<string, string>> = {};

    constructor(app: App, private plugin: NetClipPlugin){
        super(app)
    }

    async tryGetClipboardUrl(): Promise<string>{
        try{
            const text = await navigator.clipboard.readText();
            return normalizeUrl(text) || '';
        } catch {
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

        if (this.plugin.settings.enableAI && this.plugin.settings.geminiApiKey) {
            const promptContainer = contentEl.createDiv({cls: 'netclip_prompt_container'});
            promptContainer.createEl('h3', {text: 'AI Processing'});

            this.plugin.settings.prompts.forEach(prompt => {
                const promptDiv = promptContainer.createDiv({cls: 'prompt-section'});
                new Setting(promptDiv)
                    .setName(prompt.name)
                    .addToggle(toggle => toggle
                        .setValue(prompt.enabled)
                        .onChange(value => {
                            if (value) {
                                if (!this.selectedPrompts.includes(prompt)) {
                                    this.selectedPrompts.push(prompt);
                                    this.selectedVariables[prompt.name] = {};
                                    this.renderVariableSelectors(promptDiv, prompt);
                                }
                            } else {
                                const index = this.selectedPrompts.indexOf(prompt);
                                if (index > -1) {
                                    this.selectedPrompts.splice(index, 1);
                                    delete this.selectedVariables[prompt.name];
                                    const varContainer = promptDiv.querySelector(`.prompt-variables-${prompt.name.replace(/\s+/g, '-')}`);
                                    if (varContainer) varContainer.remove();
                                }
                            }
                        }));

                if (prompt.enabled) {
                    this.selectedPrompts.push(prompt);
                    this.selectedVariables[prompt.name] = {};
                    this.renderVariableSelectors(promptDiv, prompt);
                }
            });
        }

        const clipButton = contentEl.createEl('button', {text: 'Clip'});

        clipButton.addEventListener('click', async () => {
            if(urlInput.value){
                const normalizedUrl = normalizeUrl(urlInput.value);
                if (normalizedUrl){
                    if (this.selectedPrompts.length > 0) {
                        this.close();
                        new AIProcessingModal(
                            this.app,
                            this.plugin,
                            normalizedUrl,
                            categorySelect.value,
                            this.selectedPrompts,
                            this.selectedVariables
                        ).open();
                    } else {
                        await this.plugin.clipWebpage(
                            normalizedUrl,
                            categorySelect.value,
                            null,
                            {}
                        );
                        this.close();
                    }
                }
            }
        });
    }

    private renderVariableSelectors(container: HTMLElement, prompt: AIPrompt) {
        const varContainer = container.createDiv({
            cls: `prompt-variables prompt-variables-${prompt.name.replace(/\s+/g, '-')}`
        });
        
        Object.entries(prompt.variables).forEach(([varName, options]) => {
            new Setting(varContainer)
                .setName(`${prompt.name} - ${varName}`)
                .addDropdown(dropdown => {
                    options.forEach(option => dropdown.addOption(option, option));
                    dropdown.onChange(value => {
                        this.selectedVariables[prompt.name][varName] = value;
                    });
                    if (options.length > 0) {
                        this.selectedVariables[prompt.name][varName] = options[0];
                        dropdown.setValue(options[0]);
                    }
                });
        });
    }

    onClose(){
        const {contentEl} = this;
        contentEl.empty();
    }
}