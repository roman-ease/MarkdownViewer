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
    if (!e.clipboardData || !e.clipboardData.items) return;
    
    for (const item of e.clipboardData.items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await insertPastedImage(file);
        }
        break;
      }
    }
  });

  $('btn-new').addEventListener('click', newFile);
  $('btn-open').addEventListener('click', openFile);
  $('btn-save').addEventListener('click', saveFile);
  $('btn-save-as').addEventListener('click', saveFileAs);
  $('btn-toggle-view').addEventListener('click', toggleViewMode);

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
