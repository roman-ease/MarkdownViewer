/**
 * Markdown Viewer - メインエントリポイント
 * 
 * アプリケーションの初期化とイベント登録を担当
 */

Neutralino.init();

// 起動時の診断ログ (v1.5.4)
if (typeof NL_CWD !== 'undefined') {
  console.log(`[v1.5.4] CWD: ${NL_CWD}`);
  console.log(`[v1.5.4] ARGS: ${JSON.stringify(NL_ARGS)}`);
}

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
  try {
    // 監視を即座に停止してプロセスへの干渉を防ぐ (v1.5.4)
    if (typeof stopWatchingFile === 'function') {
      try { stopWatchingFile(); } catch(e) {}
    }

    // 視覚的な応答性を重視し、まずウィンドウを消す（プロセス終了は裏で行う）
    await Neutralino.window.hide();

    saveCurrentTabState(); 
    const modifiedTabs = state.tabs.filter(t => t.isModified);
    
    if (modifiedTabs.length > 0) {
      // 既にウィンドウが隠れているため、表示が必要な場合は再度出す
      await Neutralino.window.show(); 
      const res = await Neutralino.os.showMessageBox('終了の確認', `${modifiedTabs.length}個の未保存のファイルがあります。\n保存せずに終了してよろしいですか？`, 'YES_NO', 'WARNING');
      if (res !== 'YES') {
        // キャンセルの場合は監視を再開
        if (typeof startWatchingFile === 'function' && state.currentFilePath) {
          try { startWatchingFile(); } catch(e) {}
        }
        return; 
      }
      await Neutralino.window.hide();
    }

    // IPCの後片付け
    if (state.isPrimaryInstance) {
      state.isIpcClosed = true;
      try {
        await Neutralino.storage.setData('primary_info', null);
      } catch(e) {}
    }
  } catch(err) {
    console.warn('[v1.5.4] Error during windowClose:', err);
  } finally {
    // 何が起きても最後は必ず終了
    Neutralino.app.exit();
  }
});
