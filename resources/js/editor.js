/**
 * Markdown Viewer - エディアイベント・ショートカット・表示モード
 */

/**
 * 各種ボタン・入力イベントをセットアップ
 */
function setupEventListeners() {
  let debounceTimer = null;
  editor.addEventListener('input', () => {
    setModified(true);
    updateLineCount();
    saveCurrentTabState();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePreview();
    }, 150);
  });

  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      editor.dispatchEvent(new Event('input'));
    }
  });

  editor.addEventListener('paste', async (e) => {
    if (!e.clipboardData) return;

    // Excel/TSVテーブル判定
    const text = e.clipboardData.getData('text/plain');
    if (text && text.includes('\t') && text.trim().includes('\n')) {
      e.preventDefault();
      const rows = text.trim().split(/\r?\n/).map(row => row.split('\t'));
      let markdownTable = '\n';
      rows.forEach((cols, i) => {
        markdownTable += '| ' + cols.join(' | ') + ' |\n';
        if (i === 0) {
          markdownTable += '| ' + cols.map(() => '---').join(' | ') + ' |\n';
        }
      });
      insertAtCursor(markdownTable);
      return;
    }

    // 画像貼り付け判定
    const items = e.clipboardData.items;
    if (items) {
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await insertPastedImage(file);
          }
          return;
        }
      }
    }
  });

  // 同期スクロールイベント
  editor.addEventListener('scroll', () => {
    if (!state.isSyncScroll || state.scrollSource === 'preview') return;
    state.scrollSource = 'editor';
    const previewEl = $('preview');
    const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    previewEl.scrollTop = scrollPercentage * (previewEl.scrollHeight - previewEl.clientHeight);
    setTimeout(() => { state.scrollSource = null; }, 50);
  });

  preview.addEventListener('scroll', () => {
    if (!state.isSyncScroll || state.scrollSource === 'editor') return;
    state.scrollSource = 'preview';
    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    editor.scrollTop = scrollPercentage * (editor.scrollHeight - editor.clientHeight);
    setTimeout(() => { state.scrollSource = null; }, 50);
  });

  $('btn-new').addEventListener('click', newFile);
  $('btn-open').addEventListener('click', openFile);
  $('btn-save').addEventListener('click', saveFile);
  $('btn-save-as').addEventListener('click', saveFileAs);
  $('btn-toggle-view').addEventListener('click', toggleViewMode);
  $('btn-table').addEventListener('click', () => insertTable(3, 2)); // デフォルト 3行2列

  const btnExportMenu = $('btn-export-menu');
  const exportDropdown = $('export-dropdown');
  btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.style.display = exportDropdown.style.display === 'none' ? 'block' : 'none';
    $('recent-menu').style.display = 'none';
  });
  $('menu-export-html').addEventListener('click', () => {
    exportDropdown.style.display = 'none';
    exportToHtml();
  });
  $('menu-export-pdf').addEventListener('click', () => {
    exportDropdown.style.display = 'none';
    exportToPdf();
  });

  const btnRecent = $('btn-recent');
  const recentMenu = $('recent-menu');
  btnRecent.addEventListener('click', (e) => {
    e.stopPropagation();
    recentMenu.style.display = recentMenu.style.display === 'none' ? 'block' : 'none';
    exportDropdown.style.display = 'none';
  });
  document.addEventListener('click', () => {
    recentMenu.style.display = 'none';
    exportDropdown.style.display = 'none';
  });
  recentMenu.addEventListener('click', (e) => e.stopPropagation());
  exportDropdown.addEventListener('click', (e) => e.stopPropagation());

  $('btn-reload').addEventListener('click', reloadFile);
  $('btn-dismiss-notification').addEventListener('click', dismissNotification);
}

/**
 * キーボードショートカットのセットアップ
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
      e.preventDefault();
      newFile();
    }
    if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
      e.preventDefault();
      openFile();
    }
    if (e.ctrlKey && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveFileAs();
    }
  });
}

/**
 * 分割モード / ビューのみモード を切替
 */
function toggleViewMode() {
  state.isViewOnly = !state.isViewOnly;
  const btn = $('btn-toggle-view');
  const iconSplit = $('icon-split');
  const iconView = $('icon-view');
  const label = $('toggle-label');

  if (state.isViewOnly) {
    document.body.classList.add('view-only');
    btn.classList.add('active');
    iconSplit.style.display = 'none';
    iconView.style.display = 'block';
    label.textContent = '分割表示';
  } else {
    document.body.classList.remove('view-only');
    btn.classList.remove('active');
    iconSplit.style.display = 'block';
    iconView.style.display = 'none';
    label.textContent = 'ビューのみ';
    editor.focus();
  }
}

/**
 * カーソル位置にテキストを挿入
 */
function insertAtCursor(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const val = editor.value;
  editor.value = val.substring(0, start) + text + val.substring(end);
  editor.selectionStart = editor.selectionEnd = start + text.length;
  editor.dispatchEvent(new Event('input'));
}

/**
 * テーブル雛形を挿入
 */
function insertTable(rows, cols) {
  let table = '\n';
  // ヘッダー
  table += '| ' + Array(cols).fill('Header').join(' | ') + ' |\n';
  // セパレーター
  table += '| ' + Array(cols).fill('---').join(' | ') + ' |\n';
  // データ行
  for (let i = 0; i < rows; i++) {
    table += '| ' + Array(cols).fill(' ').join(' | ') + ' |\n';
  }
  insertAtCursor(table);
  editor.focus();
}
