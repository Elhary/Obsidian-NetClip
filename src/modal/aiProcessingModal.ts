import { App, Modal, Notice, setIcon } from 'obsidian';
import { AIPrompt } from '../settings';
import NetClipPlugin from '../main';

export class AIProcessingModal extends Modal {
    private aiStepElements: HTMLElement[] = [];
    private aiStatusText: HTMLElement;
    private currentStep = 0;
    private aiSteps = [
        'Extracting content from webpage...',
        'Analyzing content structure...',
        'Processing with AI model...'
    ];
    private promptProgressContainer: HTMLElement;
    private promptProgressElements: Map<string, HTMLElement> = new Map();

    constructor(
        app: App, 
        private plugin: NetClipPlugin,
        private url: string,
        private category: string,
        private selectedPrompts: AIPrompt[],
        private selectedVariables: Record<string, Record<string, string>>
    ) {
        super(app);
        this.selectedPrompts.forEach(prompt => {
            this.aiSteps.push(`Applying prompt: ${prompt.name}...`);
        });
        this.aiSteps.push('Formatting final document...');
    }

    async onOpen() {
        this.modalEl.addClass('netclip_ai_processing_modal');
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('netclip_ai_processing_content');

        contentEl.createEl('h2', {text: 'AI Processing'});
        
        const infoMessage = contentEl.createDiv({cls: 'netclip_info_message'});
        const infoIcon = infoMessage.createDiv({cls: 'netclip_info_icon'});
        setIcon(infoIcon, 'info');
        const infoText = infoMessage.createDiv({cls: 'netclip_info_text'});
        infoText.setText('You can close this modal. You\'ll be notified when it\'s done.');
        
        const aiProcessingContainer = contentEl.createDiv({cls: 'netclip_ai_processing_container'});
        const aiAnimationContainer = aiProcessingContainer.createDiv({cls: 'netclip_ai_animation'});
        this.aiStatusText = aiProcessingContainer.createDiv({cls: 'netclip_ai_status'});
        this.aiStatusText.setText('Initializing AI processing...');
        
        const typingContainer = aiAnimationContainer.createDiv({cls: 'netclip_typing_animation'});
        for (let i = 0; i < 3; i++) {
            typingContainer.createDiv({cls: 'netclip_typing_dot'});
        }
        
        const aiStepsContainer = aiProcessingContainer.createDiv({cls: 'netclip_ai_steps'});
        
        this.aiStepElements = [];
        this.aiSteps.forEach(step => {
            const stepEl = aiStepsContainer.createDiv({cls: 'netclip_ai_step'});
            stepEl.setText(step);
            this.aiStepElements.push(stepEl);
        });
        
        this.promptProgressContainer = aiProcessingContainer.createDiv({cls: 'netclip_prompt_progress'});
        this.promptProgressContainer.style.display = 'none';
        
        document.addEventListener('netclip-ai-progress', this.handleAIProgress.bind(this));

        this.processWithAnimation();
    }
    
    private handleAIProgress(event: CustomEvent) {
        const { total, current, promptName } = event.detail;
        this.aiStatusText.setText(`Processing prompt ${current}/${total}: ${promptName}`);
        this.promptProgressContainer.style.display = 'block';
        
        if (!this.promptProgressElements.has(promptName)) {
            const promptEl = this.promptProgressContainer.createDiv({cls: 'netclip_prompt_item'});
            const promptName_el = promptEl.createDiv({cls: 'netclip_prompt_name'});
            promptName_el.setText(promptName);
            const promptStatus = promptEl.createDiv({cls: 'netclip_prompt_status'});
            promptStatus.setText('Processing...');
            promptStatus.addClass('processing');
            this.promptProgressElements.set(promptName, promptStatus);
        }
        
        this.selectedPrompts.forEach((prompt, index) => {
            if (index < current - 1) {
                const status = this.promptProgressElements.get(prompt.name);
                if (status) {
                    status.setText('Completed');
                    status.removeClass('processing');
                    status.addClass('completed');
                }
            }
        });
    }

    private updateStep() {
        this.aiStepElements.forEach(el => el.removeClass('active', 'completed'));
        
        for (let i = 0; i < this.currentStep; i++) {
            this.aiStepElements[i].addClass('completed');
        }
        
        if (this.currentStep < this.aiStepElements.length) {
            this.aiStepElements[this.currentStep].addClass('active');
            this.aiStatusText.setText(this.aiSteps[this.currentStep]);
        }
    }

    async processWithAnimation() {
        try {
            this.updateStep();
            const stepDelay = 1000;
            
            await new Promise(resolve => setTimeout(resolve, stepDelay));
            this.currentStep++;
            this.updateStep();
            
            await new Promise(resolve => setTimeout(resolve, stepDelay));
            this.currentStep++;
            this.updateStep();
            
            await new Promise(resolve => setTimeout(resolve, stepDelay));
            this.currentStep++;
            this.updateStep();
            
            await this.plugin.clipWebpage(
                this.url,
                this.category,
                this.selectedPrompts,
                this.selectedVariables
            );
            
            this.currentStep = this.aiSteps.length - 1;
            this.updateStep();
            
            await new Promise(resolve => setTimeout(resolve, stepDelay));
            
            document.removeEventListener('netclip-ai-progress', this.handleAIProgress.bind(this));
            new Notice('AI processing completed successfully!', 5000);
            this.close();
        } catch (error) {
            this.aiStatusText.setText(`Error: ${error.message}`);
            this.aiStatusText.addClass('error');
            
            const errorCloseBtn = this.contentEl.createEl('button', {
                text: 'Close',
                cls: 'netclip_error_close'
            });
            errorCloseBtn.addEventListener('click', () => {
                document.removeEventListener('netclip-ai-progress', this.handleAIProgress.bind(this));
                this.close();
            });
            
            new Notice(`AI processing failed: ${error.message}`, 5000);
        }
    }

    onClose() {
        document.removeEventListener('netclip-ai-progress', this.handleAIProgress.bind(this));
        this.contentEl.empty();
    }
} 