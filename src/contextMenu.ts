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
            item.setTitle("Open page in Editor")
                .setIcon("globe")
                .onClick(() => {
                    if (this.url) {
                        const existingLeaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_WEBVIEW)
                            .find((leaf: any) => {
                                const view = leaf.view as WorkspaceLeafWebView;
                                return view.url === this.url;
                            });
    
                        if (existingLeaf) {
                            this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
                        } else {
                            const leaf = this.app.workspace.getLeaf('tab');
                        
                            leaf.setViewState({
                                type: VIEW_TYPE_WORKSPACE_WEBVIEW,
                                state: { url: this.url }
                            }).then(() => {
                                if (leaf.view instanceof WorkspaceLeafWebView) {
                                    leaf.view.setUrl(this.url);
                                    
                                    this.app.workspace.setActiveLeaf(leaf, { focus: true });
                                }
                            });
                        }
                    } else {
                        new Notice('No URL found for this clipping');
                    }
                });
        });


        menu.addItem((item) => {
            item.setTitle("Open page in Modal")
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
                .setTitle("Open in Editor")
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