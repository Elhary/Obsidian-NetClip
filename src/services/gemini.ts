import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIPrompt } from "../settings";
import { NetClipSettings } from "../settings";

const SYSTEM_INSTRUCTION = `YAML Property Rules:
1. Properties must be at the top of the note
2. Each property value should be concise (max 150 characters)
3. Title should be clear and descriptive (max 100 characters)
4. Description should be a brief summary (max 150 characters)
5. Keep all property values in a single line
6. Use quotes for values containing special characters
7. IMPORTANT: Never remove or modify the ![Thumbnail]() image tag if it exists`;

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private settings: NetClipSettings;

    constructor(apiKey: string, settings: NetClipSettings) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: settings.geminiModel || "gemini-2.5-pro" });
        this.settings = settings;
    }

    private replaceVariables(prompt: string, variables: Record<string, string>, promptDefinition?: AIPrompt): string {
        return prompt.replace(/\${(\w+)}/g, (match, variable) => {
            if (variables[variable]) {
                return variables[variable];
            }
            
            if (promptDefinition?.variables?.[variable]?.[0]) {
                return promptDefinition.variables[variable][0];
            }
            
            return match;
        });
    }

    private extractFrontmatterAndContent(markdown: string): { frontmatter: string | null; frontmatterObj: Record<string, any>; content: string } {
        const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
        const match = markdown.match(frontmatterRegex);
        
        if (!match) {
            return {
                frontmatter: null,
                frontmatterObj: {},
                content: markdown
            };
        }

        const frontmatter = match[0];
        const content = markdown.slice(frontmatter.length);
        const frontmatterContent = match[1];
        
        const frontmatterObj: Record<string, any> = {};
        const lines = frontmatterContent.split('\n');
        
        for (const line of lines) {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
                const key = line.slice(0, colonIndex).trim();
                let value = line.slice(colonIndex + 1).trim();
                
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                
                frontmatterObj[key] = value;
            }
        }

        return {
            frontmatter,
            frontmatterObj,
            content
        };
    }

    private generateFrontmatter(frontmatterObj: Record<string, any>): string {
        const lines = ['---'];
        
        for (const [key, value] of Object.entries(frontmatterObj)) {
            const needsQuotes = typeof value === 'string' && (
                value.includes(':') || 
                value.includes('"') || 
                value.includes("'") || 
                value.includes('\n') ||
                value.includes('#') ||
                /^[0-9]/.test(value)
            );
            
            const formattedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
            lines.push(`${key}: ${formattedValue}`);
        }
        
        lines.push('---\n');
        return lines.join('\n');
    }

    async processContent(
        markdown: string, 
        prompts: AIPrompt | AIPrompt[] | null, 
        variables: Record<string, Record<string, string>> | Record<string, string>,
        keepOriginalContent: boolean = true
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

        const thumbnailMatch = content.match(/^!\[Thumbnail\]\([^)]*\)\n*/);
        const thumbnailPart = thumbnailMatch ? thumbnailMatch[0] : '';
        
        let currentContent = content.replace(/^!\[Thumbnail\]\([^)]*\)\n*/, '');
        let originalContent = currentContent;
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
            }, prompt);
            
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

IMPORTANT: 
- Keep all required frontmatter properties
- Follow the system instructions for property formatting
- Include your processed content after the frontmatter
- DO NOT remove or modify the ![Thumbnail]() image tag if it exists
- Keep the thumbnail image tag exactly as is, at its original position`;

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
        let finalContent = '';

        if (keepOriginalContent) {
            finalContent = newFrontmatter + thumbnailPart + originalContent + '\n\n## AI Generated Content\n\n' + currentContent + '\n';
        } else {
            finalContent = newFrontmatter + thumbnailPart + currentContent + '\n';
        }
        
        return finalContent;
    }
}
