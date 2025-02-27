import { App, ButtonComponent, Notice, PluginSettingTab, Setting, TFolder } from 'obsidian';
import NetClipPlugin from './main';
import { CLIPPER_VIEW } from './view/ClipperView';
import { DeleteCategoryModal } from './modal/deleteCategory';


export default class NetClipSettingTab extends PluginSettingTab {
    plugin: NetClipPlugin;
    viewPosition: string;
    defaultFolderName: string;
    defaultWebUrl: string;
    modalHeight: string;
    modalWidth: string;
    searchEngine: 'google' | 'youtube' | 'bing' | 'perplexity' | 'duckduckgo' | 'genspark' | 'kagi';
    webViewControls: any;
    id: string;
    categories: string[];
    private folderRenameText: HTMLInputElement;
    private confirmButton: ButtonComponent;
    private newFolderName: string = '';

    constructor(app: App, plugin: NetClipPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async onload() {
        await this.syncCategoriesFolders();
    }

    private async syncCategoriesFolders() {
        const mainFolder = this.app.vault.getFolderByPath(this.plugin.settings.defaultFolderName);
        if (!mainFolder) return;
    
        const subfolders = mainFolder.children
            .filter(file => file instanceof TFolder)
            .map(folder => folder.name);
    
        this.plugin.settings.categories = subfolders;
        await this.plugin.saveSettings();
    }

    private async deleteCategory(category: string) {
        const folderPath = `${this.plugin.settings.defaultFolderName}/${category}`;
        const folder = this.app.vault.getFolderByPath(folderPath);

        if (!(folder)) {
            return false
        }

        if (folder.children.length > 0) {
            const confirmed = await new Promise((resolve) => {
                new DeleteCategoryModal(
                    this.app,
                    category,
                    (result) => resolve(result)
                ).open();
            });
            if (!confirmed) return false;
        }

        await this.app.fileManager.trashFile(folder);

        const index = this.plugin.settings.categories.indexOf(category);
        if (index > -1) {
            this.plugin.settings.categories.splice(index, 1);
            await this.plugin.saveSettings();
        }

        new Notice(`Category "${category}" deleted successfully`);
        return true;
    }



    private async createCategoryFolder(categoryName: string): Promise<boolean> {
        const folderPath = `${this.plugin.settings.defaultFolderName}/${categoryName}`;
        const existingFolder = this.app.vault.getFolderByPath(folderPath);

        if (existingFolder) {
            new Notice(`Category "${categoryName}" already exists`);
            return false;
        }

        await this.app.vault.createFolder(folderPath);
        return true;
    }



    private async renameFolderAndUpdatePaths(oldPath: string, newPath: string): Promise<boolean> {
        const oldFolder = this.app.vault.getFolderByPath(oldPath);
        if (!oldFolder) {
            new Notice(`Folder "${oldPath}" not found.`);
            return false;
        }
    
        const newFolder = this.app.vault.getFolderByPath(newPath);
        if (newFolder) {
            new Notice(`Folder "${newPath}" already exists.`);
            return false;
        }
    
        await this.app.fileManager.renameFile(oldFolder, newPath);
    
        for (const category of this.plugin.settings.categories) {
            const oldCategoryPath = `${oldPath}/${category}`;
            const newCategoryPath = `${newPath}/${category}`;
            const categoryFolder = this.app.vault.getFolderByPath(oldCategoryPath);
            if (categoryFolder) {
                await this.app.fileManager.renameFile(categoryFolder, newCategoryPath);
            }
        }
    
        return true;
    }






    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.syncCategoriesFolders();

        new Setting(containerEl).setName('Web view').setHeading()

        new Setting(containerEl)
            .setName('Search engine')
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
            .setName('Default url')
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

            new Setting(containerEl)
              .setName('Enable ad blocking (experimental)')
              .setDesc('Block ads in web view')
              .addToggle(toggle => toggle 
                .setValue(this.plugin.settings.adBlock.enabled)
                .onChange(async (value) => {
                    this.plugin.settings.adBlock.enabled = value;
                    await this.plugin.saveSettings();
                    this.display
                })
              )

              new Setting(containerEl)
               .setName('Private mode')
               .setDesc('Block cookies, localStorage, and other tracking mechanisms (prevents saving browsing data)')
               .addToggle(toggle => toggle
                  .setValue(this.plugin.settings.privateMode)
                  .onChange(async (value) => {
                    this.plugin.settings.privateMode = value;
                    await this.plugin.saveSettings();
                  })
               );

        new Setting(containerEl).setName('Clipper').setHeading()



        new Setting(containerEl)
            .setName('View position')
            .setDesc('Choose where the Web Clipper view should appear')
            .addDropdown(dropdown =>
                dropdown
                    .addOption('left', 'Left sidebar')
                    .addOption('right', 'Right sidebar')
                    .addOption('default', 'Default position')
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
            .setName('Change folder name')
            .setDesc('Change the folder for saving clipped articles')
            .addText(text => {
                this.folderRenameText = text.inputEl;
                return text
                    .setPlaceholder('Enter folder name')
                    .setValue(this.plugin.settings.defaultFolderName)
                    .onChange((value) => {
                        const newName = value.trim();
                        if (newName === '') {
                            this.confirmButton?.setDisabled(true);
                            return;
                        }

                        this.newFolderName = newName;
                        this.confirmButton?.setDisabled(false);
                    });
            })
            .addButton(button => {
                this.confirmButton = button
                    .setButtonText('Confirm')
                    .setDisabled(true)
                    .onClick(async () => {
                        if (this.newFolderName === this.plugin.settings.defaultFolderName) {
                            this.confirmButton.setDisabled(true);
                            return;
                        }

                        const success = await this.renameFolderAndUpdatePaths(
                            this.plugin.settings.defaultFolderName,
                            this.newFolderName
                        );

                        if (success) {
                            this.plugin.settings.defaultFolderName = this.newFolderName;
                            await this.plugin.saveSettings();
                            new Notice(`Folder renamed to "${this.newFolderName}"`);
                            this.confirmButton.setDisabled(true);
                        } else {
                            this.folderRenameText.value = this.plugin.settings.defaultFolderName;
                            this.confirmButton.setDisabled(true);
                        }
                    });
                return button;
            });





        new Setting(containerEl)
            .setName('Categories')
            .setDesc('Create new category folder')
            .addText(text => {
                const textComponent = text.setPlaceholder('New category name');
                const storedTextComponent = textComponent;

                textComponent.inputEl.onkeydown = async (e) => {
                    if (e.key === 'Enter') {
                        const value = textComponent.getValue().trim();
                        if (value && !this.plugin.settings.categories.includes(value)) {
                            if (await this.createCategoryFolder(value)) {
                                this.plugin.settings.categories.push(value);
                                await this.plugin.saveSettings();
                                textComponent.setValue('');
                                this.display();
                            }
                        }
                    }
                };
                return textComponent;
            })
            .addButton(button => {
                return button
                    .setButtonText('Create')
                    .onClick(async () => {

                        const settingItem = button.buttonEl.closest('.setting-item');
                        if (!settingItem) return;

                        const textInput = settingItem.querySelector('input') as HTMLInputElement;
                        if (!textInput) return;

                        const value = textInput.value.trim();

                        if (!value) {
                            new Notice('Please enter a category name');
                            return;
                        }

                        if (this.plugin.settings.categories.includes(value)) {
                            new Notice(`Category "${value}" already exists`);
                            return;
                        }

                        if (await this.createCategoryFolder(value)) {
                            this.plugin.settings.categories.push(value);
                            await this.plugin.saveSettings();
                            textInput.value = '';
                            this.display();
                            new Notice(`Category "${value}" created successfully`);
                        }
                    });
            });

        this.plugin.settings.categories.forEach(category => {
            const setting = new Setting(containerEl)
                .setName(category)
                .addButton(btn => btn
                    .setIcon('trash')
                    .onClick(async () => {
                        if (await this.deleteCategory(category)) {
                            this.display();
                        }
                    }))
                .addText(text => {
                    text.setPlaceholder('Enter icon name')
                        .setValue(this.plugin.settings.categoryIcons[category] || '')
                        .onChange(async (value) => {
                            if (value) {
                                this.plugin.settings.categoryIcons[category] = value;
                            } else {
                                delete this.plugin.settings.categoryIcons[category];
                            }
                            await this.plugin.saveSettings();
                        });
                    return text;
                });
            
            if (this.plugin.settings.categoryIcons[category]) {
                setting.setDesc(`Current icon: ${this.plugin.settings.categoryIcons[category]}`);
            }
        });

    }
}