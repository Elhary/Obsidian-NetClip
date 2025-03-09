
export interface NetClipSettings {
    viewPosition: 'left' | 'right' | 'default';
    defaultFolderName: string;
    defaultWebUrl: string;
    parentFolderPath: string;
    searchEngine: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
    categories: string[];
    categoryIcons: Record<string, string>;
    enableCorsProxy: boolean;
    adBlock: {
        enabled: boolean;
    }
    privateMode: boolean

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
    privateMode: false

};