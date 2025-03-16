import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIPrompt } from "../settings";
import { Notice } from "obsidian";
import { NetClipSettings } from "../settings";

const SYSTEM_INSTRUCTION = `YAML Property Rules:
1. Properties must be at the top of the note
2. Each property value should be concise (max 150 characters)
3. Title should be clear and descriptive (max 100 characters)
4. Description should be a brief summary (max 150 characters)
5. Keep all property values in a single line
6. Use quotes for values containing special characters`;

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private settings: NetClipSettings;

    constructor(apiKey: string, settings: NetClipSettings) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        this.settings = settings;
    }

    private replaceVariables(prompt: string, variables: Record<string, string>): string {
        return prompt.replace(/\${(\w+)}/g, (match, variable) => {
            return variables[variable] || match;
        });
    }

    private extractFrontmatterAndContent(markdown: string): { frontmatter: string, frontmatterObj: Record<string, any>, content: string } {
        const match = markdown.match(/^(---\n)([\s\S]*?)\n---\n\n([\s\S]*)$/);
        if (match) {
            const [_, delimiter, frontmatterContent, content] = match;

            const frontmatterObj: Record<string, any> = {};
            frontmatterContent.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length) {
                    frontmatterObj[key.trim()] = valueParts.join(':').trim().replace(/^"(.*)"$/, '$1');
                }
            });

            return {
                frontmatter: delimiter + frontmatterContent + '\n---\n\n',
                frontmatterObj,
                content
            };
        }

        return {
            frontmatter: '',
            frontmatterObj: {},
            content: markdown.trim()
        };
    }

    private enforcePropertyRules(frontmatterObj: Record<string, any>): Record<string, any> {
        const enforced = { ...frontmatterObj };

        if (enforced.title && enforced.title.length > 100) {
            enforced.title = enforced.title.substring(0, 97) + '...';
        }

        if (enforced.desc && enforced.desc.length > 150) {
            enforced.desc = enforced.desc.substring(0, 147) + '...';
        }

        Object.entries(enforced).forEach(([key, value]) => {
            if (typeof value === 'string') {
                let processedValue = value.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

                if (processedValue.length > 150 && key !== 'title') {
                    processedValue = processedValue.substring(0, 147) + '...';
                }

                if (/[:{}[\],&*#?|\-<>=!%@`]/.test(processedValue)) {
                    processedValue = `"${processedValue.replace(/"/g, '\\"')}"`;
                }

                enforced[key] = processedValue;
            }
        });

        return enforced;
    }

    private generateFrontmatter(obj: Record<string, any>): string {
        const enforcedObj = this.enforcePropertyRules(obj);
        return '---\n' +
            Object.entries(enforcedObj)
                .map(([key, value]) => {
                    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
                        return `${key}: ${value}`;
                    }
                    return `${key}: "${value}"`;
                })
                .join('\n') +
            '\n---\n\n';
    }

    async processContent(
        markdown: string, 
        prompts: AIPrompt | AIPrompt[] | null, 
        variables: Record<string, Record<string, string>> | Record<string, string>
    ): Promise<string> {
        if (!this.model) {
            throw new Error("Gemini model not initialized");
        }

        if (!prompts) {
            return markdown;
        }

        const promptArray = Array.isArray(prompts) ? prompts : [prompts];
        const variablesMap = Array.isArray(prompts) ? variables as Record<string, Record<string, string>> : { single: variables as Record<string, string> };

        let { frontmatterObj, content } = this.extractFrontmatterAndContent(markdown);

        const thumbnailMatch = content.match(/^!\[Thumbnail\]\((.*?)\?crossorigin=anonymous\)\n\n/);
        const thumbnailPart = thumbnailMatch ? thumbnailMatch[0] : '';
        let currentContent = thumbnailMatch 
            ? content.replace(thumbnailMatch[0], '') 
            : content;
        
        let currentFrontmatter = frontmatterObj;
        
        const progressEvent = new CustomEvent('netclip-ai-progress', { 
            detail: { total: promptArray.length, current: 0, promptName: '' }
        });
        
        for (let i = 0; i < promptArray.length; i++) {
            const prompt = promptArray[i];
            if (!prompt) continue;
            
            progressEvent.detail.current = i + 1;
            progressEvent.detail.promptName = prompt.name;
            document.dispatchEvent(progressEvent);
            
            const promptVars = Array.isArray(prompts) ? variablesMap[prompt.name] || {} : variablesMap.single;
            
            const processedPrompt = this.replaceVariables(prompt.prompt, {
                ...promptVars,
                article: currentContent
            });
            
            const singlePrompt = `System Instruction for YAML Properties:
${SYSTEM_INSTRUCTION}

Current Frontmatter:
${JSON.stringify(currentFrontmatter, null, 2)}

Content to Process:
${currentContent}

Your task:
${processedPrompt}

Return the result in this exact format:
---
[Your modified frontmatter here, following the system instructions]
---

[Your processed content here]

Remember: 
- Keep all required frontmatter properties
- Follow the system instructions for property formatting
- Include your processed content after the frontmatter
- DO NOT modify or include the thumbnail image - it will be handled separately`;

            const result = await this.model.generateContent(singlePrompt);
            const stepProcessedContent = result.response.text();
            
            const processedParts = this.extractFrontmatterAndContent(stepProcessedContent);
            
            if (processedParts.frontmatter) {
                currentFrontmatter = processedParts.frontmatterObj;
                currentContent = processedParts.content.trim();
            } else {
                currentContent = stepProcessedContent.trim();
            }
        }
        
        const newFrontmatter = this.generateFrontmatter(currentFrontmatter);
        const finalContent = newFrontmatter + thumbnailPart + currentContent + '\n';
        
        return finalContent;
    }
}
