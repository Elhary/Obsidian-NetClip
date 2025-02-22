
export interface NetClipSettings {
    viewPosition: 'left' | 'right' | 'default';
    defaultFolderName: string;
    defaultWebUrl: string;
    searchEngine: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
    categories: string[];
    enableCorsProxy: boolean;
    adBlock: {
        enabled: boolean;
    }
    privateMode: boolean

}

export const DEFAULT_SETTINGS: NetClipSettings = {
    viewPosition: 'default',
    defaultFolderName: 'Netclips',
    defaultWebUrl: 'https://google.com',
    searchEngine: 'google',
    categories: [],
    enableCorsProxy: false,
    adBlock: {
        enabled: false,
    },
    privateMode: false
};