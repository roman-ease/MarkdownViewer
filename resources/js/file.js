/**
 * Markdown Viewer - ファイル操作 (I/O, 履歴, 監視)
 */

/**
 * 新規ファイル作成
 */
async function newFile() {
  await addTab();
}

/**
 * ファイルを開くダイアログを表示してファイルを読み込む
 */
async function openFile() {
  if (state.isModified) {
    const confirmed = await confirmDiscard();
    if (!confirmed) return;
  }

  try {
    const entries = await Neutralino.os.showOpenDialog('Markdown ファイルを開く', {
      filters: [
        { name: 'Markdown ファイル', extensions: ['md', 'markdown', 'txt'] },
        { name: 'すべてのファイル', extensions: ['*'] },
      ],
    });

    if (entries && entries.length > 0) {
      for (const entry of entries) {
        await loadFile(entry);
      }
    }
  } catch (err) {
    showError('ファイルを開けませんでした', err);
  }
}

/**
 * 指定パスのファイルを読み込む
 */
async function loadFile(filePath) {
  try {
    const content = await Neutralino.filesystem.readFile(filePath);
    
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab && !activeTab.filePath && !activeTab.isModified && editor.value === '') {
      activeTab.filePath = filePath;
      activeTab.content = content;
      activeTab.originalContent = content;
      activeTab.isModified = false;
      
      state.currentFilePath = filePath;
      state.originalContent = content;
      editor.value = content;
      setModified(false);

      await updateLastModifiedTime();
      activeTab.lastModifiedTime = state.lastModifiedTime;
      startWatchingFile();
    } else {
      await addTab(filePath, content);
    }

    addRecentFile(filePath);
    dismissNotification();
    editor.focus();
  } catch (err) {
    showError('ファイルの読み込みに失敗しました', err);
  }
}

/**
 * 上書き保存
 */
async function saveFile() {
  if (!state.currentFilePath) {
    return saveFileAs();
  }

  try {
    const content = editor.value;
    await Neutralino.filesystem.writeFile(state.currentFilePath, content);
    
    state.originalContent = content;
    setModified(false);
    
    await updateLastModifiedTime();

    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab) {
      activeTab.originalContent = content;
      activeTab.lastModifiedTime = state.lastModifiedTime;
    }
    
    renderTabs();
  } catch (err) {
    const choice = await Neutralino.os.showMessageBox(
      '保存エラー',
      `ファイルを保存できませんでした。\n\n原因: ${err.message || err}\n\n別の場所に保存しますか？`,
      'YES_NO',
      'WARNING'
    );
    if (choice === 'YES') {
      await saveFileAs();
    }
  }
}

/**
 * 名前を付けて保存
 */
async function saveFileAs() {
  try {
    const filePath = await Neutralino.os.showSaveDialog('名前を付けて保存', {
      filters: [
        { name: 'Markdown ファイル', extensions: ['md'] },
        { name: 'テキストファイル', extensions: ['txt'] },
        { name: 'すべてのファイル', extensions: ['*'] },
      ],
    });

    if (filePath) {
      const finalPath = filePath.includes('.') ? filePath : filePath + '.md';
      const content = editor.value;
      await Neutralino.filesystem.writeFile(finalPath, content);
      
      state.currentFilePath = finalPath;
      state.originalContent = content;
      setModified(false);
      
      await updateLastModifiedTime();
      startWatchingFile();
      
      const activeTab = state.tabs.find(t => t.id === state.activeTabId);
      if (activeTab) {
        activeTab.filePath = finalPath;
        activeTab.originalContent = content;
        activeTab.lastModifiedTime = state.lastModifiedTime;
      }
      
      addRecentFile(finalPath);
      renderTabs();
    }
  } catch (err) {
    showError('ファイルの保存に失敗しました', err);
  }
}

/**
 * 起動時にコマンドライン引数からファイルパスを取得して開く
 */
async function handleStartupArgs() {
  try {
    const args = NL_ARGS || [];
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) continue;
      if (/\.(md|markdown|txt)$/i.test(arg)) {
        await loadFile(arg);
      }
      else if (arg.includes('\\') || arg.includes('/')) {
        try {
          await Neutralino.filesystem.getStats(arg);
          await loadFile(arg);
        } catch { }
      }
    }
  } catch (err) {
    console.error('Startup args handling error:', err);
  }
}

/**
 * ファイルの最終更新日時を記録
 */
async function updateLastModifiedTime() {
  if (!state.currentFilePath) return;
  try {
    const stats = await Neutralino.filesystem.getStats(state.currentFilePath);
    state.lastModifiedTime = stats.modifiedTime;
  } catch {
    state.lastModifiedTime = null;
  }
}

/**
 * ファイル監視を開始
 */
function startWatchingFile() {
  stopWatchingFile();
  if (!state.currentFilePath) return;

  state.watchInterval = setInterval(async () => {
    if (!state.currentFilePath || !state.lastModifiedTime) return;
    try {
      const stats = await Neutralino.filesystem.getStats(state.currentFilePath);
      if (stats.modifiedTime !== state.lastModifiedTime) {
        showNotification('ファイルが外部で変更されました。');
      }
    } catch {
      showNotification('ファイルが見つからなくなりました。');
      stopWatchingFile();
    }
  }, 3000);
}

/**
 * ファイル監視を停止
 */
function stopWatchingFile() {
  if (state.watchInterval) {
    clearInterval(state.watchInterval);
    state.watchInterval = null;
  }
}

/**
 * ファイルの再読み込み
 */
async function reloadFile() {
  if (!state.currentFilePath) return;
  try {
    const content = await Neutralino.filesystem.readFile(state.currentFilePath);
    editor.value = content;
    state.originalContent = content;
    setModified(false);
    updatePreview();
    updateLineCount();
    await updateLastModifiedTime();
    dismissNotification();
  } catch (err) {
    showError('ファイルの再読み込みに失敗しました', err);
  }
}

/**
 * 履歴を localStorage から読み込む
 */
function loadRecentFiles() {
  try {
    let saved = localStorage.getItem('markdown_recent_files');
    if (!saved) {
      saved = localStorage.getItem('merkdown_recent_files');
      if (saved) {
        localStorage.setItem('markdown_recent_files', saved);
        localStorage.removeItem('merkdown_recent_files');
      }
    }
    
    if (saved) {
      state.recentFiles = JSON.parse(saved);
    }
  } catch (err) {
    state.recentFiles = [];
  }
  renderRecentMenu();
}

/**
 * 履歴にファイルを追加/更新する
 */
function addRecentFile(filePath) {
  if (!filePath) return;
  state.recentFiles = state.recentFiles.filter(p => p !== filePath);
  state.recentFiles.unshift(filePath);
  if (state.recentFiles.length > 10) {
    state.recentFiles.pop();
  }
  localStorage.setItem('markdown_recent_files', JSON.stringify(state.recentFiles));
  renderRecentMenu();
}

/**
 * 履歴ドロップダウンメニューの描画
 */
function renderRecentMenu() {
  const list = $('recent-list');
  if (!list) return;
  list.innerHTML = '';

  if (state.recentFiles.length === 0) {
    const li = document.createElement('li');
    li.className = 'recent-empty';
    li.textContent = '履歴がありません';
    list.appendChild(li);
    return;
  }

  state.recentFiles.forEach(path => {
    const li = document.createElement('li');
    li.textContent = getFileName(path);
    li.title = path;
    li.addEventListener('click', async () => {
      $('recent-menu').style.display = 'none';
      if (state.isModified) {
        const confirmed = await confirmDiscard();
        if (!confirmed) return;
      }
      try {
        await Neutralino.filesystem.getStats(path);
        await loadFile(path);
      } catch {
        showError('ファイルが見つかりません', '移動または削除された可能性があります。');
        state.recentFiles = state.recentFiles.filter(p => p !== path);
        localStorage.setItem('markdown_recent_files', JSON.stringify(state.recentFiles));
        renderRecentMenu();
      }
    });
    list.appendChild(li);
  });
}

/**
 * プレビュー内容を HTML として保存
 */
async function exportToHtml() {
  if (!preview.innerHTML || preview.innerHTML.trim() === '') {
    showError('エクスポートエラー', '出力する内容がありません。');
    return;
  }

  try {
    const defaultName = state.currentFilePath ? getFileName(state.currentFilePath).replace(/\.[^/.]+$/, "") + ".html" : "export.html";
    const filePath = await Neutralino.os.showSaveDialog('HTMLとして保存', {
      defaultPath: defaultName,
      filters: [
        { name: 'HTML ファイル', extensions: ['html', 'htm'] },
        { name: 'すべてのファイル', extensions: ['*'] },
      ],
    });

    if (filePath) {
      const finalPath = filePath.includes('.') ? filePath : filePath + '.html';
      
      let cssContent = '';
      try {
        const res = await fetch('styles.css');
        cssContent = await res.text();
      } catch(e) { }

      let hljsContent = '';
      try {
        const res = await fetch('libs/github-dark.min.css');
        hljsContent = await res.text();
      } catch(e) { }

      const title = state.currentFilePath ? getFileName(state.currentFilePath) : 'Markdown Export';
      
      const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
body { padding: 20px; background: var(--bg-primary); color: var(--text-primary); font-family: 'Segoe UI', 'Meiryo', sans-serif; }
.markdown-body { max-width: 900px; margin: 0 auto; background: var(--bg-secondary); padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
${hljsContent}
${cssContent}
    </style>
</head>
<body>
    <div class="markdown-body">
${preview.innerHTML}
    </div>
</body>
</html>`;

      await Neutralino.filesystem.writeFile(finalPath, htmlContent);
      Neutralino.os.showMessageBox('エクスポート完了', `HTMLファイルを保存しました:\n${finalPath}`, 'OK', 'INFO');
    }
  } catch (err) {
    showError('HTMLのエクスポートに失敗しました', err);
  }
}

/**
 * プレビュー内容を PDF として出力
 */
async function exportToPdf() {
  if (!preview.innerHTML || preview.innerHTML.trim() === '') {
    showError('エクスポートエラー', '出力する内容がありません。');
    return;
  }
  
  await Neutralino.os.showMessageBox(
    'PDF出力', 
    '印刷ダイアログが開きます。\n\nプリンターとして「PDFとして保存」を選択してください。', 
    'OK', 'INFO'
  );
  window.print();
}
