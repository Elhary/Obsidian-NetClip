import { App, Modal, Setting, TFolder, setIcon } from 'obsidian';
import NetClipPlugin from '../main';
import { t } from '../translations';

export class FolderSelectionModal extends Modal {
    private plugin: NetClipPlugin;
    private folderCallback: (folderPath: string) => void;
    private selectedFolderPath: string = '';
    private searchInput: HTMLInputElement;
    private folderList: HTMLElement;
    private allFolders: TFolder[] = [];

    constructor(app: App, plugin: NetClipPlugin) {
        super(app);
        this.plugin = plugin;
        this.selectedFolderPath = plugin.settings.parentFolderPath;
    }

    onChooseFolder(callback: (folderPath: string) => void) {
        this.folderCallback = callback;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('netclip-folder-selection-modal');

        contentEl.createEl('h2', { text: t('select_parent_folder') });
        contentEl.createEl('p', { text: t('select_parent_folder_desc') });

    
        const searchContainer = contentEl.createDiv('netclip-folder-search');
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: 'Search folders...',
            cls: 'netclip-folder-search-input'
        });

        this.searchInput.addEventListener('input', () => {
            this.filterFolders(this.searchInput.value);
        });

        const rootSetting = new Setting(contentEl);
        
        const rootNameContainer = document.createElement('span');
        rootNameContainer.className = 'netclip-folder-name-container';
        const rootIconContainer = document.createElement('span');
        rootIconContainer.className = 'netclip-folder-icon';
        setIcon(rootIconContainer, 'vault');
        rootNameContainer.appendChild(rootIconContainer);
        const rootTextSpan = document.createElement('span');
        rootTextSpan.textContent = t('vault_root');
        rootNameContainer.appendChild(rootTextSpan);
        
        rootSetting.nameEl.empty();
        rootSetting.nameEl.appendChild(rootNameContainer);
        rootSetting.setDesc(t('store_in_root_desc'));
        
        rootSetting.addButton(button => button
            .setButtonText(t('select'))
            .onClick(() => {
                this.selectedFolderPath = '';
                this.close();
                this.folderCallback('');
            }));

        this.allFolders = this.getAllFolders();
        
        contentEl.createEl('h3', { text: t('available_folders') });
        this.folderList = contentEl.createEl('div', { cls: 'netclip-folder-list' });
        
        this.displayFolders(this.allFolders);

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText(t('cancel'))
                .onClick(() => {
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private getAllFolders(): TFolder[] {
        const folders: TFolder[] = [];
        
        const getFolders = (folder: TFolder) => {
            folders.push(folder);
            
            for (const child of folder.children) {
                if (child instanceof TFolder) {
                    getFolders(child);
                }
            }
        };
        
        for (const child of this.app.vault.getRoot().children) {
            if (child instanceof TFolder) {
                getFolders(child);
            }
        }
        
        return folders.sort((a, b) => a.path.localeCompare(b.path));
    }

    private displayFolders(folders: TFolder[]) {
        this.folderList.empty();
        
        folders.forEach(folder => {
            const folderPath = folder.path;
            const folderSetting = new Setting(this.folderList);
            
            const nameContainer = document.createElement('span');
            nameContainer.className = 'netclip-folder-name-container';
            const iconContainer = document.createElement('span');
            iconContainer.className = 'netclip-folder-icon';
            setIcon(iconContainer, 'folder');
            
            nameContainer.appendChild(iconContainer);
            const textSpan = document.createElement('span');
            textSpan.textContent = folderPath;
            nameContainer.appendChild(textSpan);
            
            folderSetting.nameEl.empty();
            folderSetting.nameEl.appendChild(nameContainer);
            
            folderSetting.addButton(button => button
                .setButtonText(t('select'))
                .onClick(() => {
                    this.selectedFolderPath = folderPath;
                    this.close();
                    this.folderCallback(folderPath);
                }));
        });
    }

    private filterFolders(searchTerm: string) {
        const normalizedSearch = searchTerm.toLowerCase();
        const filteredFolders = this.allFolders.filter(folder => 
            folder.path.toLowerCase().includes(normalizedSearch)
        );
        this.displayFolders(filteredFolders);
    }
}