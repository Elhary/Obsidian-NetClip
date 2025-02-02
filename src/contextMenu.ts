import { Menu, Notice, TFile } from 'obsidian';
import { WebViewModal } from './view/ModalWebView';
import NetClipPlugin from './main';
import { WorkspaceLeafWebView, VIEW_TYPE_WORKSPACE_WEBVIEW } from './view/EditorWebView';

export class ClipperContextMenu {
    private app: any;
    private file: TFile;
    private url?: string;
    private onDelete: (file: TFile) => void;
    private onOpenArticle: (file: TFile) => void;
    plugin: NetClipPlugin;

    constructor(
        app: any, 
        file: TFile, 
        onDelete: (file: TFile) => void, 
        onOpenArticle: (file: TFile) => void, 
        url?: string,
    ) {
        this.app = app;
        this.file = file;
        this.url = url;
        this.onDelete = onDelete;
        this.onOpenArticle = onOpenArticle;
        this.plugin = this.app.plugins.getPlugin('net-clip');
    }

    show(anchorElement: HTMLElement) {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("Open page in editor")  
                .setIcon("globe")
                .onClick(async () => {
                    if (this.url) {
                        const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_WEBVIEW);
                        
                        for (const leaf of existingLeaves) {
                            await leaf.view.onLoadEvent;
                            if (leaf.view instanceof WorkspaceLeafWebView && leaf.view.url === this.url) {
                                this.app.workspace.setActiveLeaf(leaf, { focus: true });
                                return;
                            }
                        }

                        const leaf = this.app.workspace.getLeaf('tab');
                        await leaf.setViewState({
                            type: VIEW_TYPE_WORKSPACE_WEBVIEW,
                            state: { url: this.url }
                        });

                        await leaf.view.onLoadEvent;
                        if (leaf.view instanceof WorkspaceLeafWebView) {
                            leaf.view.setUrl(this.url);
                            this.app.workspace.setActiveLeaf(leaf, { focus: true });
                        }
                    } else {
                        new Notice('No URL found for this clipping');
                    }
                });
        });


        menu.addItem((item) => {
            item.setTitle("Open page in modal")
                .setIcon("maximize")
                .onClick(() => {
                    if (this.url) {
                        const modal = new WebViewModal(
                            this.app, 
                            this.url, 
                            this.plugin
                        );
                        modal.open();
                    } else {
                        new Notice('No URL found for this clipping');
                    }
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("Open in editor")
                .setIcon("file-text")
                .onClick(() => {
                    this.onOpenArticle(this.file);
                });
        });

        menu.addItem((item) => {
            item
                .setTitle("Delete")
                .setIcon("trash")
                .onClick(() => {
                    this.onDelete(this.file);
                });
        });

        const rect = anchorElement.getBoundingClientRect();
        menu.showAtPosition({ x: rect.left, y: rect.bottom });
    }
}