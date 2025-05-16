import { App } from 'obsidian';

export async function findFirstImageInNote(app: App, content: string) {
    try {
        const markdownMatch = content.match(/!\[(.*?)\]\((\S+?(?:\.(?:jpg|jpeg|png|gif|webp)|format=(?:jpg|jpeg|png|gif|webp))[^\s)]*)\s*(?:\s+["'][^"']*["'])?\s*\)/i);
        if (markdownMatch && markdownMatch[2]) {
            return markdownMatch[2];
        }

        const internalMatch = content.match(/!?\[\[(.*?\.(?:jpg|jpeg|png|gif|webp))(?:\|.*?)?\]\]/i);
        if (internalMatch && internalMatch[1]) {
            const file = app.metadataCache.getFirstLinkpathDest(internalMatch[1], '');
            if (file) {
                return app.vault.getResourcePath(file);
            }
        }

        return null;
    } catch (error) {
        console.error('Error finding image in note:', error);
        return null;
    }
} 