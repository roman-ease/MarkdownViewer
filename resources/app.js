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

  // 2. marked.js の設定 (v1.6.5)
  if (typeof marked !== 'undefined') {
    marked.use({
      breaks: true,
      gfm: true,
      renderer: {
        heading(arg1, arg2) {
          let content, level;
          if (typeof arg1 === 'object' && arg1 !== null) {
            // モダン（v12+）形式: { text, depth, tokens, raw }
            content = arg1.text || '';
            level = arg1.depth || 1;
          } else {
            // 従来形式: (text, level)
            content = String(arg1);
            level = arg2 || 1;
          }

          // IDの生成 (v1.6.6 Unicode/日本語対応)
          // 記号類のみを除去し、日本語や英数字を保持
          const plainText = content.replace(/<[^>]*>/g, '');
          const id = plainText.toLowerCase()
            .trim()
            .replace(/[\s\t\n\r\f\v\u3000]/g, '-') // 空白(全角含む)をハイフンに
            .replace(/[!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~]/g, '') // 指定記号を削除
            .replace(/-+/g, '-'); // 連続ハイフンを1つに
          
          return `<h${level} id="${id}">${content}</h${level}>`;
        }
      }
    });

    // シンタックスハイライトの設定 (marked v12+ では extensions または walkTokens を推奨する場合もあるが、ここでは hljs 直接呼び出しを維持)
    if (typeof hljs !== 'undefined') {
      marked.use({
        walkTokens(token) {
          if (token.type === 'code' && token.lang) {
            try {
              const language = hljs.getLanguage(token.lang) ? token.lang : 'plaintext';
              token.escaped = true;
              token.text = hljs.highlight(token.text, { language }).value;
            } catch (e) {}
          }
        }
      });
    }
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
  // 起動時の初期描画を確実にするため、わずかに遅延させる (v1.6.6)
  setTimeout(() => {
    updatePreview();
  }, 50);

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
