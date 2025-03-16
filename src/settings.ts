export interface NetClipSettings {
    viewPosition: 'left' | 'right' | 'default';
    defaultFolderName: string;
    parentFolderPath: string;
    defaultWebUrl: string;
    searchEngine: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
    categories: string[];
    categoryIcons: Record<string, string>;
    enableCorsProxy: boolean;
    adBlock: {
        enabled: boolean;
    }
    privateMode: boolean;
    geminiApiKey: string;
    enableAI: boolean;
    prompts: AIPrompt[];
    defaultSaveLocations: {
        defaultLocation: string; 
        domainMappings: Record<string, string>;  
    };
}

export interface AIPrompt {
    name: string;
    prompt: string;
    enabled: boolean;
    variables: Record<string, string[]>;
}

export const DEFAULT_SETTINGS: NetClipSettings = {
    viewPosition: 'default',
    defaultFolderName: 'Netclips',
    parentFolderPath: '',
    defaultWebUrl: 'https://google.com',
    searchEngine: 'google',
    categories: [],
    categoryIcons: {},
    enableCorsProxy: false,
    adBlock: {
        enabled: false,
    },
    privateMode: false,
    geminiApiKey: '',
    enableAI: false,
    prompts: [
        {
            name: "Translate Content",
            prompt: "Translate the following ${article} to ${target_lang}",
            enabled: false,
            variables: {
                "target_lang": ["Japanese", "English", "Spanish", "French", "German", "Chinese"]
            }
        },
        {
            name: "Summarize Content",
            prompt: "Summarize ${article} in ${style} style. Keep the summary ${length}.",
            enabled: false,
            variables: {
                "style": ["concise", "detailed", "bullet points", "academic"],
                "length": ["short (2-3 sentences)", "medium (1 paragraph)", "long (2-3 paragraphs)"]
            }
        },
        {
            name: "Format as Note",
            prompt: "Convert ${article} into a structured note with headings, bullet points, and key takeaways. Use ${format} formatting style.",
            enabled: false,
            variables: {
                "format": ["Academic", "Meeting Notes", "Study Notes"]
            }
        }
    ],
    defaultSaveLocations: {
        defaultLocation: '',
        domainMappings: {}
    }
};