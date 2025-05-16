import * as exp from "constants";

interface Translations {
    "en": { [key: string]: string };
    "ja": { [key: string]: string };
}

type LanguageKey = keyof Translations;


export function t(key: string): string {

    const storeLang = window.localStorage.getItem('language');
    const lang = (storeLang || 'en') as LanguageKey;
    const translation = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    return translation[key]
}

export const TRANSLATIONS: Translations = {
    en: {
        'clipper_view': 'Clipper View',

        'search_saved_articles': 'Search saved articles...',

        'sort_a_z': 'A-Z',
        'sort_z_a': 'Z-A',
        'sort_newest_first': 'Newest First',
        'sort_oldest_first': 'Oldest First',

        'all': 'All',
        'unknown_source': 'Unknown source',

        'no_matching_articles': 'No matching articles found.',

        'clip_webpage': 'Clip webpage',
        'url': 'Url:',
        'enter_url': 'Enter URL to clip...',
        'save_to': 'Save to:',
        'clip': 'Clip',

        'confirm_delete': 'Confirm delete',
        'confirm_delete_message': 'Are you sure you want to delete the article "{0}"?',
        'delete': 'Delete',
        'cancel': 'Cancel',

        'select_parent_folder': 'Select Parent Folder',
        'select_parent_folder_desc': 'Choose a parent folder for NetClip content. Leave empty to use vault root.',
        'vault_root': 'Vault Root',
        'store_in_root_desc': 'Store NetClip content directly in the vault root',
        'available_folders': 'Available Folders',
        'select': 'Select',

        'web_view': 'Web view',
        'search_engine': 'Search engine',
        'search_engine_desc': 'Choose the default search engine for search queries',
        'default_url': 'Default url',
        'default_url_desc': 'Set the default URL opened when using the web modal/editor',
        'enter_default_url': 'Enter default URL',
        'invalid_url': 'Invalid URL. Please enter a valid URL.',
        'enable_ad_blocking': 'Enable ad blocking (experimental)',
        'enable_ad_blocking_desc': 'Block ads in web view',
        'private_mode': 'Private mode',
        'private_mode_desc': 'Block cookies, localStorage, and other tracking mechanisms (prevents saving browsing data)',
        'clipper': 'Clipper',
        'ai_prompts_tab': 'AI prompts',
        'view_position': 'View position',
        'view_position_desc': 'Choose where the Web Clipper view should appear',
        'left_sidebar': 'Left sidebar',
        'right_sidebar': 'Right sidebar',
        'default_position': 'Default position',
        'change_folder_name': 'Change folder name',
        'change_folder_name_desc': 'Change the folder for saving clipped articles',
        'enter_folder_name': 'Enter folder name',
        'confirm': 'Confirm',
        'folder_renamed': 'Folder renamed to "{0}"',
        'categories': 'Categories',
        'categories_desc': 'Create new category folder',
        'new_category_name': 'New category name',
        'create': 'Create',
        'please_enter_category_name': 'Please enter a category name',
        'category_exists': 'Category "{0}" already exists',
        'category_created': 'Category "{0}" created successfully',
        'category_deleted': 'Category "{0}" deleted successfully',
        'enter_icon_name': 'Enter icon name',
        'folder_not_found': 'Folder "{0}" not found.',
        'folder_exists': 'Folder "{0}" already exists.',
        'web_view_tab': 'Web view',
        'clipper_tab': 'Clipper',
        'parent_folder': 'Parent folder',
        'parent_folder_desc': 'Choose a parent folder for NetClip content (leave empty to use vault root)',
        'parent_folder_path': 'Parent folder path',
        'browse': 'Browse',

        'sort_by': 'Sort by',
        'domain_filter': 'Filter by domain',
        'all_domains': 'All domains',

        'open_web': 'Open web view',
        'open_settings': 'Open settings',
        'add_clip': 'Add new clip',

        'current_icon': 'Current icon: {0}',

        'enable_ai': 'Enable AI Processing',
        'enable_ai_desc': 'Enable AI-powered content processing using Gemini API',
        'gemini_api_key': 'Gemini API Key',
        'gemini_api_key_desc': 'Enter your Gemini API key',
        'enter_api_key': 'Enter API key',
        'ai_prompts': 'AI Prompts',
        'ai_prompts_desc': 'Create and manage AI processing prompts',
        'add_new_prompt': 'Add New Prompt',
        'edit_prompt': 'Edit',
        'delete_prompt': 'Delete',
        'export_prompts': 'Export All Prompts',
        'import_prompts': 'Import Prompts',
        'export_prompts_desc': 'Export all AI prompts as a JSON file',
        'import_prompts_desc': 'Import AI prompts from a JSON file',
        'import_success': 'Successfully imported prompts',
        'import_error': 'Error importing prompts: Invalid file format',
        'export_prompt': 'Export',
        'export_single_prompt_desc': 'Export this prompt as a JSON file',
        'show_in_clipper': 'Show in clipper',
        'show_in_clipper_desc': 'Show this prompt in the clip modal when clipping content',
        'hide_in_clipper': 'Hide in clipper',
        'hide_in_clipper_desc': 'Hide this prompt from the clip modal',

        'support_tab': 'Support',
        'github_repo': 'GitHub Repository',
        'github_repo_desc': 'Visit the GitHub repository for documentation, issues, and updates',
        'open_github': 'Open GitHub',
        'support_development': 'Support Development',
        'support_development_desc': 'If this plugin is useful to you, consider supporting its development or giving it a star on GitHub!',
        'buy_coffee': 'Buy Me a Coffee',
        'buy_coffee_desc': 'Support me on Buy Me a Coffee',
        'support_kofi': 'Support on Ko-fi',
        'support_kofi_desc': 'Support me on Ko-fi',

        'home_tab': 'Home tab',
        'show_clock': 'Show clock', 
        'show_recent_files': 'Show recent files',
        'show_saved_articles': 'Show saved articles',
        'replace_new_tabs': 'Replace new tabs',
        'replace_new_tabs_desc': 'When enabled, new empty tabs will be replaced with the NetClip home tab',
        'show_clock_desc': 'Show a clock on the home tab',
        'show_recent_files_desc': 'Display the recent files section on the home tab',
        'show_saved_articles_desc': 'Display the saved articles section on the home tab',
    },
    'ja': {
        'clipper_view': 'クリッパービュー',

        'search_saved_articles': '保存された記事を検索...',

        'sort_a_z': 'A-Z',
        'sort_z_a': 'Z-A',
        'sort_newest_first': '新しい順',
        'sort_oldest_first': '古い順',

        'all': 'すべて',
        'unknown_source': '不明なソース',

        'no_matching_articles': '一致する記事が見つかりません。',

        'clip_webpage': 'ウェブページをクリップ',
        'url': 'URL:',
        'enter_url': 'クリップするURLを入力...',
        'save_to': '保存先:',
        'clip': 'クリップ',

        'confirm_delete': '削除の確認',
        'confirm_delete_message': '記事「{0}」を削除してもよろしいですか？',
        'delete': '削除',
        'cancel': 'キャンセル',

        'clipping': 'クリップ中...',
        'clipping_success': '{0} のクリップに成功しました',
        'clipping_failed': 'クリップに失敗しました: {0}',
        'created_folders': '{0} にフォルダを作成しました',
        'no_url_found': 'このクリップにURLが見つかりません',
        'clip_webpage_function_not_available': 'クリップ機能が利用できません',

        'select_parent_folder': '親フォルダを選択',
        'select_parent_folder_desc': 'NetClipコンテンツの親フォルダを選択してください。空白の場合はvaultルートを使用します。',
        'vault_root': 'Vaultルート',
        'store_in_root_desc': 'NetClipコンテンツをVaultルートに直接保存',
        'available_folders': '利用可能なフォルダ',
        'select': '選択',

        'web_view': 'ウェブビュー',
        'search_engine': '検索エンジン',
        'search_engine_desc': '検索クエリのデフォルト検索エンジンを選択',
        'default_url': 'デフォルトURL',
        'default_url_desc': 'ウェブモーダル/エディタで開くデフォルトURLを設定',
        'enter_default_url': 'デフォルトURLを入力',
        'invalid_url': '無効なURLです。有効なURLを入力してください。',
        'enable_ad_blocking': '広告ブロック機能を有効にする（実験的）',
        'enable_ad_blocking_desc': 'ウェブビューで広告をブロック',
        'private_mode': 'プライベートモード',
        'private_mode_desc': 'Cookie、localStorage、その他の追跡メカニズムをブロック（閲覧データの保存を防止）',
        'clipper': 'クリッパー',
        'ai_prompts_tab': 'AI プロンプト',
        'view_position': 'ビュー位置',
        'view_position_desc': 'Webクリッパービューを表示する場所を選択',
        'left_sidebar': '左サイドバー',
        'right_sidebar': '右サイドバー',
        'default_position': 'デフォルト位置',
        'change_folder_name': 'フォルダ名を変更',
        'change_folder_name_desc': 'クリップした記事を保存するフォルダを変更',
        'enter_folder_name': 'フォルダ名を入力',
        'confirm': '確認',
        'folder_renamed': 'フォルダ名を「{0}」に変更しました',
        'categories': 'カテゴリ',
        'categories_desc': '新しいカテゴリフォルダを作成',
        'new_category_name': '新しいカテゴリ名',
        'create': '作成',
        'please_enter_category_name': 'カテゴリ名を入力してください',
        'category_exists': 'カテゴリ「{0}」はすでに存在します',
        'category_created': 'カテゴリ「{0}」が正常に作成されました',
        'category_deleted': 'カテゴリ「{0}」が正常に削除されました',
        'enter_icon_name': 'アイコン名を入力',
        'folder_not_found': 'フォルダ「{0}」が見つかりません。',
        'folder_exists': 'フォルダ「{0}」はすでに存在します',
        'web_view_tab': 'ウェブビュー',
        'clipper_tab': 'クリッパー',
        'parent_folder': '親フォルダ',
        'parent_folder_desc': 'NetClipコンテンツの親フォルダを選択（空白の場合はvaultルートを使用）',
        'parent_folder_path': '親フォルダのパス',
        'browse': '参照',

        'sort_by': '並び替え',
        'domain_filter': 'ドメインでフィルター',
        'all_domains': 'すべてのドメイン',

        'open_web': 'ウェブビューを開く',
        'open_settings': '設定を開く',
        'add_clip': '新規クリップを追加',

        'current_icon': '現在のアイコン: {0}',

        'enable_ai': 'AI処理を有効にする',
        'enable_ai_desc': 'Gemini APIを使用したAI処理を有効にする',
        'gemini_api_key': 'Gemini APIキー',
        'gemini_api_key_desc': 'Gemini APIキーを入力してください',
        'enter_api_key': 'APIキーを入力',
        'ai_prompts': 'AIプロンプト',
        'ai_prompts_desc': 'AI処理プロンプトの作成と管理',
        'add_new_prompt': '新規プロンプトを追加',
        'edit_prompt': '編集',
        'delete_prompt': '削除',
        'export_prompts': 'すべてのプロンプトをエクスポート',
        'import_prompts': 'プロンプトをインポート',
        'export_prompts_desc': 'すべてのAIプロンプトをJSONファイルとしてエクスポート',
        'import_prompts_desc': 'JSONファイルからAIプロンプトをインポート',
        'import_success': 'プロンプトのインポートに成功しました',
        'import_error': 'プロンプトのインポートエラー：無効なファイル形式です',
        'export_prompt': 'エクスポート',
        'export_single_prompt_desc': 'このプロンプトをJSONファイルとしてエクスポート',
        'show_in_clipper': 'クリッパーに表示',
        'show_in_clipper_desc': 'コンテンツをクリップする際にこのプロンプトをクリップモーダルに表示',
        'hide_in_clipper': 'クリッパーに非表示',
        'hide_in_clipper_desc': 'このプロンプトをクリップモーダルから非表示にする',

        'support_tab': 'サポート',
        'github_repo': 'GitHubリポジトリ',
        'github_repo_desc': 'ドキュメント、問題報告、アップデートについてはGitHubリポジトリをご覧ください',
        'open_github': 'GitHubを開く',
        'support_development': '開発をサポート',
        'support_development_desc': 'このプラグインが便利だと感じたら、開発をサポートしていただくか、GitHubでスターを付けていただけると嬉しいです！',
        'buy_coffee': 'コーヒーを買う',
        'buy_coffee_desc': 'Buy Me a Coffeeでサポート',
        'support_kofi': 'Ko-fiでサポート',
        'support_kofi_desc': 'Ko-fiでサポート',

        'home_tab': 'ホームタブ',
        'show_clock': '時計を表示',
        'show_recent_files': '最近のファイルを表示',
        'show_saved_articles': '保存された記事を表示',
        'replace_new_tabs': '新規タブを置き換える',
        'replace_new_tabs_desc': '有効にすると、新しい空のタブがNetClipホームタブに置き換えられます',
        'show_clock_desc': 'ホームタブに時計を表示します',
        'show_recent_files_desc': 'ホームタブに最近のファイルセクションを表示します',
        'show_saved_articles_desc': 'ホームタブに保存された記事セクションを表示します',
    }

}

export function formatString(str: string, ...args: any[]): string {
    return str.replace(/{(\d+)}/g, (match, index) => {
        return typeof args[index] !== 'undefined' ? args[index] : match;
    });
}