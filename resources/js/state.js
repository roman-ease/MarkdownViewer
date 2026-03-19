/**
 * Markdown Viewer - グローバル状態管理
 */

const state = {
  currentFilePath: null,   // 現在開いているファイルのパス（アクティブタブのショートカット）
  originalContent: '',     
  isModified: false,       
  isViewOnly: false,       
  lastModifiedTime: null,  
  watchInterval: null,     
  recentFiles: [],         
  isSyncScroll: true,   // 同期スクロール有効
  theme: 'dark',        // 'dark' | 'light' | 'sepia'
  scrollSource: null,   // 'editor' | 'preview' (無限ループ防止用)
  
  // タブ管理
  tabs: [],                // { id, filePath, content, originalContent, isModified, lastModifiedTime, scrollTop }
  activeTabId: null,
  
  // IPC（シングルインスタンス）管理
  isPrimaryInstance: true,
  ipcPollingInterval: null,
  isIpcClosed: false
};

/**
 * DOM要素の参照ヘルパー
 */
const $ = (id) => document.getElementById(id);

// 主要なDOM要素
const editor = $('editor');
const preview = $('preview');
const fileTitle = $('file-title');
const unsavedDot = $('unsaved-dot');
const editorPane = $('editor-pane');
const previewPane = $('preview-pane');
const editorContainer = $('editor-container');
const resizer = $('resizer');
const notificationBar = $('notification-bar');
const statusFile = $('status-file');
const statusLines = $('status-lines');
