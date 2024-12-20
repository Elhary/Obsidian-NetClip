import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import NetClipPlugin from './main';
import { CLIPPER_VIEW } from './view/ClipperView';

export interface NetClipSettings {
    viewPosition: 'left' | 'right' | 'default';
    defaultFolderName: string;
    defaultWebUrl: string;
    searchEngine: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
}

export const DEFAULT_SETTINGS: NetClipSettings = {
    viewPosition: 'default',
    defaultFolderName: 'Saved Articles',
    defaultWebUrl: 'https://google.com',
    searchEngine: 'google'
};

export class NetClipSettingTab extends PluginSettingTab {
    plugin: NetClipPlugin;
    viewPosition: string;
    defaultFolderName: string;
    defaultWebUrl: string;
    modalHeight: string;
    modalWidth: string;
    searchEngine: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
    webViewControls: any;
    id: string;

    constructor(app: App, plugin: NetClipPlugin) {
        super(app, plugin);
        this.plugin = plugin;
        this.id = 'net-clip-settings';
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        
        const header = containerEl.createEl('h2', { text: 'NetClip Settings' });

        new Setting(containerEl)
            .setName('View Position')
            .setDesc('Choose where the Web Clipper view should appear')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('left', 'Left Sidebar')
                    .addOption('right', 'Right Sidebar')
                    .addOption('default', 'Default Position')
                    .setValue(this.plugin.settings.viewPosition)
                    .onChange(async (value: 'left' | 'right' | 'default') => {
                        this.plugin.settings.viewPosition = value;
                        await this.plugin.saveSettings();

                        const leaves = this.app.workspace.getLeavesOfType(CLIPPER_VIEW);
                        if (leaves.length > 0) {
                            const activeLeaf = leaves[0];
                            activeLeaf.detach();
                            this.plugin.activateView();
                        }
                    })
            );

        new Setting(containerEl)
            .setName('Default Folder Name')
            .setDesc('Set the default folder where clipped articles are saved')
            .addText(text =>
                text
                    .setPlaceholder('Enter folder name')
                    .setValue(this.plugin.settings.defaultFolderName)
                    .onChange(async (value) => {
                        if (value.trim() === '') {
                            new Notice('Folder name cannot be empty.');
                            return;
                        }
                        this.plugin.settings.defaultFolderName = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Search Engine')
            .setDesc('Choose the default search engine for search queries')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('google', 'Google')
                    .addOption('youtube', 'YouTube')
                    .addOption('bing', 'Bing')
                    .addOption('perplexity', 'Perplexity')
                    .addOption('duckduckgo', 'Duckduckgo')
                    .addOption('genspark', 'Genspark')
                    .addOption('kagi', 'Kagi')
                    .setValue(this.plugin.settings.searchEngine)
                    .onChange(async (value: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi') => {
                        this.plugin.settings.searchEngine = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Default Web Modal URL')
            .setDesc('Set the default URL opened when using the web modal/editor')
            .addText(text =>
                text
                    .setPlaceholder('Enter default URL')
                    .setValue(this.plugin.settings.defaultWebUrl)
                    .onChange(async (value) => {
                        try {
                            new URL(value);
                            this.plugin.settings.defaultWebUrl = value;
                            await this.plugin.saveSettings();
                        } catch {
                            new Notice('Invalid URL. Please enter a valid URL.');
                        }
                    })
            );
    }
}