/**
 * Markdown Viewer - UIヘルパー・ユーティリティ
 */

/**
 * 変更状態を設定し、UIに反映
 * @param {boolean} modified - 変更ありか
 */
function setModified(modified) {
  state.isModified = modified;
  // アクティブタブの状態も同期
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (activeTab) {
    activeTab.isModified = modified;
  }

  if (unsavedDot) {
    unsavedDot.className = modified ? 'unsaved-dot visible' : 'unsaved-dot';
  }
  updateFileTitle();
  renderTabs(); // タブの未保存状態を反映

  // ウィンドウタイトルに未保存マーカーを追加
  const baseName = state.currentFilePath
    ? getFileName(state.currentFilePath)
    : '無題';
  const title = modified ? `● ${baseName} - Markdown Viewer` : `${baseName} - Markdown Viewer`;
  Neutralino.window.setTitle(title).catch(() => {});
}

/**
 * ファイルタイトル表示を更新
 */
function updateFileTitle() {
  if (state.currentFilePath) {
    fileTitle.textContent = getFileName(state.currentFilePath);
    fileTitle.title = state.currentFilePath;
    statusFile.textContent = state.currentFilePath;
  } else {
    fileTitle.textContent = '無題';
    fileTitle.title = '';
    statusFile.textContent = '新規ファイル';
  }
}

/**
 * 行数カウントを更新
 */
function updateLineCount() {
  const lines = editor.value.split('\n').length;
  statusLines.textContent = `${lines} 行`;
}

/**
 * 通知バーを表示
 * @param {string} message - 通知メッセージ
 */
function showNotification(message) {
  $('notification-text').textContent = message;
  notificationBar.style.display = 'flex';
  document.body.classList.add('has-notification');
}

/**
 * 通知バーを非表示
 */
function dismissNotification() {
  notificationBar.style.display = 'none';
  document.body.classList.remove('has-notification');
}

/**
 * 未保存変更の破棄確認ダイアログ
 * @returns {Promise<boolean>} ユーザーが破棄を選択したか
 */
async function confirmDiscard() {
  try {
    const choice = await Neutralino.os.showMessageBox(
      '未保存の変更',
      '変更が保存されていません。変更を破棄してよろしいですか？',
      'YES_NO',
      'WARNING'
    );
    return choice === 'YES';
  } catch {
    return false;
  }
}

/**
 * エラーメッセージを表示（アプリは落とさない）
 * @param {string} title - エラーのタイトル
 * @param {Error|string} err - エラーオブジェクトまたはメッセージ
 */
async function showError(title, err) {
  const message = err?.message || err?.toString() || '不明なエラー';
  console.error(`${title}:`, err);
  try {
    await Neutralino.os.showMessageBox(title, message, 'OK', 'ERROR');
  } catch {
    // メッセージボックスの表示自体が失敗した場合はコンソールのみ
  }
}

/**
 * パスからファイル名を取得
 * @param {string} filePath - ファイルの絶対パス
 * @returns {string} ファイル名
 */
function getFileName(filePath) {
  if (!filePath) return '無題';
  return filePath.replace(/\\/g, '/').split('/').pop() || '無題';
}

/**
 * HTML特殊文字をエスケープ
 * @param {string} text - エスケープ対象テキスト
 * @returns {string} エスケープ後テキスト
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * デザインテーマを設定
 */
function setTheme(name) {
  state.theme = name;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('markdown-theme', name);
  
  // アクティブなメニュー項目の強調表示
  document.querySelectorAll('.theme-item').forEach(el => {
    el.style.fontWeight = el.id === `theme-${name}` ? 'bold' : 'normal';
    el.style.color = el.id === `theme-${name}` ? 'var(--accent)' : 'var(--text-secondary)';
  });
}

/**
 * 同期スクロールの有効/無効を切替
 */
function toggleSyncScroll() {
  state.isSyncScroll = !state.isSyncScroll;
  localStorage.setItem('markdown-sync-scroll', state.isSyncScroll);
  updateSyncScrollUI();
}

/**
 * 同期スクロールUIの更新
 */
function updateSyncScrollUI() {
  const btn = $('btn-sync-scroll');
  const label = $('sync-scroll-label');
  if (!btn || !label) return;
  if (state.isSyncScroll) {
    btn.classList.add('active');
    label.textContent = '同期ON';
  } else {
    btn.classList.remove('active');
    label.textContent = '同期OFF';
  }
}
function resolvePath(baseDir, relativePath) {
  const isWin = baseDir.includes('\\');
  const sep = isWin ? '\\' : '/';
  
  let base = baseDir.replace(/[\\/]/g, '/');
  let rel = relativePath.replace(/[\\/]/g, '/');
  
  if (!base.endsWith('/')) base += '/';
  
  if (rel.startsWith('./')) {
    rel = rel.substring(2);
  }
  
  while (rel.startsWith('../')) {
    rel = rel.substring(3);
    const parts = base.split('/');
    parts.pop(); 
    parts.pop(); 
    base = parts.join('/') + '/';
  }
  
  let resolved = base + rel;
  return isWin ? resolved.replace(/\//g, '\\') : resolved;
}

/**
 * ペイン間のドラッグリサイズ機能
 */
function setupResizer() {
  let isResizing = false;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const containerRect = editorContainer.getBoundingClientRect();
    const offset = e.clientX - containerRect.left;
    const totalWidth = containerRect.width;
    const percentage = (offset / totalWidth) * 100;

    const clamped = Math.max(20, Math.min(80, percentage));

    editorPane.style.flex = 'none';
    editorPane.style.width = clamped + '%';
    previewPane.style.flex = '1';
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      resizer.classList.remove('active');
      document.body.style.cursor = '';
    }
  });
}

/**
 * ファイルのD&D操作をセットアップ
 */
function setupDragAndDrop() {
  const body = document.body;

  body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      body.classList.add('drag-over');
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget === null || e.relatedTarget.nodeName === 'HTML') {
      body.classList.remove('drag-over');
    }
  });

  body.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    body.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      for (const file of files) {
        const name = file.name;
        if (/\.(md|markdown|txt)$/i.test(name)) {
          try {
            const content = await file.text();
            await addTab(null, content);
            const activeTab = state.tabs.find(t => t.id === state.activeTabId);
            if (activeTab) {
               fileTitle.textContent = name + ' (D&D)';
               fileTitle.title = 'ドラッグ＆ドロップで読み込まれたため、上書き保存はできません。別名保存を行ってください。';
            }
            showNotification('D&Dで読み込みました。直接の上書き保存や相対画像の解決はできません。');
            setTimeout(dismissNotification, 5000);
          } catch (err) {
            showError('読み込みエラー', 'ファイルの読み込みに失敗しました: ' + err.message);
          }
        } else {
          showError('未対応のファイル', 'Markdown または テキストファイル をドロップしてください。');
        }
      }
    }
  });
}
