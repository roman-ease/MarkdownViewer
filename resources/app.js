/**
 * Markdown Viewer - メインエントリポイント
 * 
 * アプリケーションの初期化とイベント登録を担当
 */

Neutralino.init();

/**
 * アプリの初期化処理
 * Neutralinojs の ready イベント後に実行
 */
Neutralino.events.on('ready', async () => {
  // 1. シングルインスタンス化（IPC機能）の初期化
  await initIPC();
  if (!state.isPrimaryInstance) return;

  // 2. marked.js の設定
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function(code, lang) {
        if (typeof hljs !== 'undefined') {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
        return code;
      }
    });
  }

  // 3. UI/イベントの初期化
  loadRecentFiles();
  setupEventListeners();
  setupResizer();
  setupKeyboardShortcuts();
  setupDragAndDrop();

  // 4. 初期タブと起動引数の処理
  addTab();
  await handleStartupArgs();
  updatePreview();

  // 5. ウィンドウを表示
  await Neutralino.window.show();
});

// ウィンドウクローズ時の処理
Neutralino.events.on('windowClose', async () => {
  saveCurrentTabState(); 
  const modifiedTabs = state.tabs.filter(t => t.isModified);
  
  if (modifiedTabs.length > 0) {
    const res = await Neutralino.os.showMessageBox('終了の確認', `${modifiedTabs.length}個の未保存のファイルがあります。\n保存せずに終了してよろしいですか？`, 'YES_NO', 'WARNING');
    if (res !== 'YES') {
      return; 
    }
  }

  // IPCの後片付け
  if (state.isPrimaryInstance) {
    state.isIpcClosed = true;
    try {
      await Neutralino.storage.setData('primary_info', null);
    } catch(e) {}
  }

  Neutralino.app.exit();
});
