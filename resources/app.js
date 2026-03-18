/**
 * Markdown Viewer - メインアプリケーションロジック
 *
 * 軽量 Markdown ビューア兼エディタ
 * Neutralinojs + marked.js で構築
 */

// ============================================================
// グローバル状態
// ============================================================
const state = {
  currentFilePath: null,   // 現在開いているファイルのパス（アクティブタブのショートカット）
  originalContent: '',     
  isModified: false,       
  isViewOnly: false,       
  lastModifiedTime: null,  
  watchInterval: null,     
  recentFiles: [],         
  
  // タブ管理
  tabs: [],                // { id, filePath, content, originalContent, isModified, lastModifiedTime, scrollTop }
  activeTabId: null,
  
  // IPC（シングルインスタンス）管理
  isPrimaryInstance: true,
  ipcPollingInterval: null
};

// ============================================================
// DOM要素の参照
// ============================================================
const $ = (id) => document.getElementById(id);
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

// ============================================================
// 初期化
// ============================================================
Neutralino.init();

/**
 * アプリの初期化処理
 * Neutralinojs の ready イベント後に実行
 */
Neutralino.events.on('ready', async () => {
  // 1. シングルインスタンス化（IPC機能）の初期化
  // 二重起動時はここで引数を送信して終了する
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
});

// ウィンドウクローズ時の処理
Neutralino.events.on('windowClose', async () => {
  saveCurrentTabState(); // 最新の値をtabs配列に反映させる
  const modifiedTabs = state.tabs.filter(t => t.isModified);
  
  if (modifiedTabs.length > 0) {
    const res = await Neutralino.os.showMessageBox('終了の確認', `${modifiedTabs.length}個の未保存のファイルがあります。\n保存せずに終了してよろしいですか？`, 'YES_NO', 'WARNING');
    if (res !== 'YES') {
      return; // キャンセル
    }
  }
  Neutralino.app.exit();
});

// ============================================================
// イベントリスナー
// ============================================================

/**
 * 各種ボタン・入力イベントをセットアップ
 */
function setupEventListeners() {
  // エディタ入力 → デバウンス付きプレビュー更新
  let debounceTimer = null;
  editor.addEventListener('input', () => {
    setModified(true);
    updateLineCount();

    // アクティブタブのコンテンツを同期（即座に反映させることで切替時に消えないようにする）
    saveCurrentTabState();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updatePreview();
    }, 150);
  });

  // Tabキーでインデント挿入
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

  // ペーストイベントのハンドリング（クリップボード画像の内蔵化）
  editor.addEventListener('paste', async (e) => {
    if (!e.clipboardData || !e.clipboardData.items) return;
    
    for (const item of e.clipboardData.items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // デフォルトのテキストペーストを防止
        const file = item.getAsFile();
        if (file) {
          await insertPastedImage(file);
        }
        break;
      }
    }
  });

  // ツールバーボタン
  $('btn-new').addEventListener('click', newFile);
  $('btn-open').addEventListener('click', openFile);
  $('btn-save').addEventListener('click', saveFile);
  $('btn-save-as').addEventListener('click', saveFileAs);
  $('btn-toggle-view').addEventListener('click', toggleViewMode);

  // エクスポートメニュー
  const btnExportMenu = $('btn-export-menu');
  const exportDropdown = $('export-dropdown');
  btnExportMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.style.display = exportDropdown.style.display === 'none' ? 'block' : 'none';
    $('recent-menu').style.display = 'none'; // 他のメニューを閉じる
  });
  $('menu-export-html').addEventListener('click', () => {
    exportDropdown.style.display = 'none';
    exportToHtml();
  });
  $('menu-export-pdf').addEventListener('click', () => {
    exportDropdown.style.display = 'none';
    exportToPdf();
  });

  // 履歴メニュー
  const btnRecent = $('btn-recent');
  const recentMenu = $('recent-menu');
  btnRecent.addEventListener('click', (e) => {
    e.stopPropagation();
    recentMenu.style.display = recentMenu.style.display === 'none' ? 'block' : 'none';
    exportDropdown.style.display = 'none'; // 他のメニューを閉じる
  });
  document.addEventListener('click', () => {
    recentMenu.style.display = 'none';
    exportDropdown.style.display = 'none';
  });
  recentMenu.addEventListener('click', (e) => e.stopPropagation());
  exportDropdown.addEventListener('click', (e) => e.stopPropagation());

  // 通知バー
  $('btn-reload').addEventListener('click', reloadFile);
  $('btn-dismiss-notification').addEventListener('click', dismissNotification);
}

/**
 * キーボードショートカットのセットアップ
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+N: 新規
    if (e.ctrlKey && !e.shiftKey && e.key === 'n') {
      e.preventDefault();
      newFile();
    }
    // Ctrl+O: 開く
    if (e.ctrlKey && !e.shiftKey && e.key === 'o') {
      e.preventDefault();
      openFile();
    }
    // Ctrl+S: 保存
    if (e.ctrlKey && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
    // Ctrl+Shift+S: 名前を付けて保存
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveFileAs();
    }
  });
}

// ============================================================
// ペインリサイザー
// ============================================================

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

    // 最小20%、最大80%に制限
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

// ============================================================
// ドラッグ&ドロップ
// ============================================================

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
    // 子要素への移動か画面外への移動か判定
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
            // WebView2環境では file.path が取得できない場合があるため、
            // 内容を直接読み取って「無題（D&D）」タブとして扱う
            const content = await file.text();
            await addTab(null, content);
            
            // UI上のタイトルを少し分かりやすく変更
            const activeTab = state.tabs.find(t => t.id === state.activeTabId);
            if (activeTab) {
               fileTitle.textContent = name + ' (D&D)';
               fileTitle.title = 'ドラッグ＆ドロップで読み込まれたため、上書き保存はできません。別名保存を行ってください。';
            }
            
            showNotification('D&Dで読み込みました。直接の上書き保存や相対画像の解決はできません（WebView2の制限）。');
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

// ============================================================
// Markdown プレビュー
// ============================================================

/**
 * エディタの内容を Markdown → HTML に変換してプレビューに反映
 */
async function updatePreview() {
  // Obsidian型のWikilink（![[画像ファイル]]）をMarkdown標準（![画像ファイル](画像ファイル)）に前置換
  const text = editor.value.replace(/!\[\[(.*?)\]\]/g, '![$1]($1)');
  
  try {
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      const html = marked.parse(text);
      preview.innerHTML = html;
      
      // 画像の相対パスをBase64に変換（完了を待つ）
      await processRelativeImages();

      // Mermaidチャートの描画処理
      const mermaidBlocks = preview.querySelectorAll('code.language-mermaid');
      if (mermaidBlocks.length > 0) {
        mermaidBlocks.forEach(codeEl => {
          const preEl = codeEl.parentElement;
          if (preEl && preEl.tagName.toLowerCase() === 'pre') {
            const div = document.createElement('div');
            div.className = 'mermaid';
            div.textContent = codeEl.textContent;
            preEl.replaceWith(div);
          }
        });
        
        try {
          if (typeof mermaid !== 'undefined') {
            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
          }
        } catch (err) {
          console.warn('Mermaid rendering error:', err);
        }
      }
    } else {
      preview.innerHTML = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
  } catch (err) {
    preview.innerHTML = `<p style="color: var(--error);">プレビューの表示に失敗しました: ${escapeHtml(err.message)}</p>`;
    console.error('Markdown render error:', err);
  }
}

/**
 * 画像の相対パスを Neutralinojs 経由で絶対パスの Base64(Data URI) に変換して表示
 */
async function processRelativeImages() {
  if (!state.currentFilePath) return;
  const currentDir = state.currentFilePath.substring(0, state.currentFilePath.lastIndexOf('\\') + 1) ||
                     state.currentFilePath.substring(0, state.currentFilePath.lastIndexOf('/') + 1);

  const images = preview.querySelectorAll('img');
  for (const img of images) {
    const src = img.getAttribute('src');
    // WebリンクやData URIはスキップ
    if (!src || src.startsWith('http') || src.startsWith('data:')) {
      continue;
    }

    let absolutePath = '';
    
    // 絶対パス（C:\... や /...）または file:// 形式の場合
    if (/^[A-Z]:\\/i.test(src) || src.startsWith('/') || src.startsWith('\\\\')) {
      absolutePath = src;
    } else if (src.startsWith('file://')) {
      // file:// 形式をデコードしてパスのみ抽出
      absolutePath = decodeURIComponent(src.replace(/^file:\/\/\/?/, ''));
      // Windowsのパス形式に補正
      if (currentDir.includes('\\')) {
        absolutePath = absolutePath.replace(/\//g, '\\');
      }
    } else {
      // 相対パスの場合
      if (!currentDir) continue;
      absolutePath = resolvePath(currentDir, src);
    }

    try {
      const buffer = await Neutralino.filesystem.readBinaryFile(absolutePath);
      let mime = 'image/png';
      if (src.toLowerCase().endsWith('.jpg') || src.toLowerCase().endsWith('.jpeg')) mime = 'image/jpeg';
      else if (src.toLowerCase().endsWith('.gif')) mime = 'image/gif';
      else if (src.toLowerCase().endsWith('.svg')) mime = 'image/svg+xml';
      else if (src.toLowerCase().endsWith('.webp')) mime = 'image/webp';

      // 効率的な Base64 変換
      const base64Str = arrayBufferToBase64(buffer);
      img.src = `data:${mime};base64,${base64Str}`;
    } catch (err) {
      console.warn(`Failed to load relative image: ${absolutePath}`, err);
    }
  }
}

/**
 * ArrayBufferをBase64文字列に変換（チャンク処理でスタックオーバーフローを防止）
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192; // チャンクごとに処理
  
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

// ============================================================
// ファイル操作
// ============================================================

/**
 * 新規ファイル作成
 * 未保存変更がある場合は確認を出す
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
 * @param {string} filePath - ファイルの絶対パス
 */
async function loadFile(filePath) {
  try {
    const content = await Neutralino.filesystem.readFile(filePath);
    
    // 現在のタブが空かつ未編集の「無題」なら、そのタブを上書きする
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
      // それ以外なら新規タブとして開く
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
 * クリップボードの画像をローカルに保存し、エディタにObsidian型リンクを挿入する
 */
async function insertPastedImage(file) {
  if (!state.currentFilePath) {
    // 未保存のファイルには相対パスで画像を配置できないためエラーとする
    showError('保存エラー', '画像を貼り付ける前に、ファイルを一度保存（Ctrl+S）してください。');
    return;
  }

  try {
    const currentDir = state.currentFilePath.substring(0, state.currentFilePath.lastIndexOf('\\') + 1) ||
                       state.currentFilePath.substring(0, state.currentFilePath.lastIndexOf('/') + 1);
    
    const assetsDirName = 'images';
    const assetsDirPath = resolvePath(currentDir, assetsDirName);
    
    // ディレクトリの存在確認・作成
    try {
      await Neutralino.filesystem.getStats(assetsDirPath);
    } catch {
      await Neutralino.filesystem.createDirectory(assetsDirPath);
    }

    // 一意なファイル名の生成 (image_YYYYMMDD_HHMMSS.拡張子)
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const extension = file.type === 'image/jpeg' ? 'jpg' : (file.name ? file.name.split('.').pop() : 'png');
    const fileName = `image_${timestamp}.${extension}`;
    const absolutePath = resolvePath(assetsDirPath, fileName);

    // 画像データの書き込み
    const arrayBuffer = await file.arrayBuffer();
    await Neutralino.filesystem.writeBinaryFile(absolutePath, arrayBuffer);
    
    // エディタのカーソル位置に Obsidian型 リンクを挿入 (例: ![[images/image_2026.png]])
    const relativePath = `${assetsDirName}/${fileName}`;
    const insertText = `![[${relativePath}]]`;
    
    const startPos = editor.selectionStart;
    const endPos = editor.selectionEnd;
    editor.value = editor.value.substring(0, startPos) + insertText + editor.value.substring(endPos);
    
    // カーソル位置を更新
    const newPos = startPos + insertText.length;
    editor.selectionStart = newPos;
    editor.selectionEnd = newPos;
    
    // プレビューの更新
    setModified(true);
    updatePreview();
    updateLineCount();
    
    // 通知バーを表示して数秒後に消す
    showNotification(`画像を保存しました: ${relativePath}`);
    setTimeout(dismissNotification, 3000);
    
  } catch (err) {
    showError('画像の保存に失敗しました', err);
  }
}

/**
 * 上書き保存
 * パスが未設定なら「名前を付けて保存」にフォールバック
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

    // アクティブタブの状態も同期
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    if (activeTab) {
      activeTab.originalContent = content;
      activeTab.lastModifiedTime = state.lastModifiedTime;
    }
    
    renderTabs();
  } catch (err) {
    // 権限不足等で保存できない場合 → 別名保存を案内
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
      // 拡張子がなければ .md を付ける
      const finalPath = filePath.includes('.') ? filePath : filePath + '.md';
      const content = editor.value;
      await Neutralino.filesystem.writeFile(finalPath, content);
      
      state.currentFilePath = finalPath;
      state.originalContent = content;
      setModified(false);
      
      await updateLastModifiedTime();
      startWatchingFile();
      
      // アクティブタブの状態も同期
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

// ============================================================
// 起動引数処理
// ============================================================

/**
 * 起動時にコマンドライン引数からファイルパスを取得して開く
 */
async function handleStartupArgs() {
  try {
    const args = NL_ARGS || [];
    // 先頭は実行ファイルパスなので、2番目以降の引数を探す
    // --neu-dev-extension などの内部引数はスキップ
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--')) continue;
      // .md / .markdown / .txt ファイルの場合は開く
      if (/\.(md|markdown|txt)$/i.test(arg)) {
        await loadFile(arg);
      }
      // 拡張子がなくても、ファイルパスっぽければ開いてみる
      else if (arg.includes('\\') || arg.includes('/')) {
        try {
          // ファイルが存在するか確認
          await Neutralino.filesystem.getStats(arg);
          await loadFile(arg);
        } catch {
          // ファイルが存在しない場合はスキップ
        }
      }
    }
  } catch (err) {
    console.error('Startup args handling error:', err);
  }
}

// ============================================================
// ファイル外部変更検知
// ============================================================

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
 * ファイル監視を開始（3秒間隔ポーリング）
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
      // ファイルがなくなった等 → 警告
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

// ============================================================
// 履歴管理 (最近使ったファイル)
// ============================================================

/**
 * 履歴を localStorage から読み込む
 */
function loadRecentFiles() {
  try {
    const saved = localStorage.getItem('markdown_recent_files');
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
 * @param {string} filePath 
 */
function addRecentFile(filePath) {
  if (!filePath) return;
  // 重複を削除
  state.recentFiles = state.recentFiles.filter(p => p !== filePath);
  // 先頭に追加
  state.recentFiles.unshift(filePath);
  // 最大10件に制限
  if (state.recentFiles.length > 10) {
    state.recentFiles.pop();
  }
  // 保存とUI更新
  localStorage.setItem('markdown_recent_files', JSON.stringify(state.recentFiles));
  renderRecentMenu();
}

/**
 * 履歴ドロップダウンメニューの描画
 */
function renderRecentMenu() {
  const list = $('recent-list');
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
      // pathが存在するかチェックしながら読み込む
      try {
        await Neutralino.filesystem.getStats(path);
        await loadFile(path);
      } catch {
        showError('ファイルが見つかりません', '移動または削除された可能性があります。');
        // エラーになれば履歴から削除
        state.recentFiles = state.recentFiles.filter(p => p !== path);
        localStorage.setItem('merkdown_recent_files', JSON.stringify(state.recentFiles));
        renderRecentMenu();
      }
    });
    list.appendChild(li);
  });
}

// ============================================================
// HTML エクスポート
// ============================================================

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
      
      // styles.css の内容をインライン化するために読み込む
      const cssPath = Neutralino.app.isDevMode 
        ? Neutralino.os.getEnv('NL_CWD') + '\\resources\\styles.css'
        : NL_PATH + '\\resources\\styles.css'; // ビルド後ではNL_PATH利用（一例）
        
      // ここでは簡便のため、fetch で読み込むアプローチをとる (webview2のローカルURL経由)
      let cssContent = '';
      try {
        const res = await fetch('styles.css');
        cssContent = await res.text();
      } catch(e) { console.warn("CSS load failed for export"); }

      // highlight.js のCSSも読み込む
      let hljsContent = '';
      try {
        const res = await fetch('libs/github-dark.min.css');
        hljsContent = await res.text();
      } catch(e) { console.warn("HLJS CSS load failed"); }

      const title = state.currentFilePath ? getFileName(state.currentFilePath) : 'Markdown Export';
      
      const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
/* Reset for Export */
body { padding: 20px; background: var(--bg-primary); color: var(--text-primary); font-family: 'Segoe UI', 'Meiryo', sans-serif; }
.markdown-body { max-width: 900px; margin: 0 auto; background: var(--bg-secondary); padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
/* Highlight.js CSS */
${hljsContent}
/* Application Styles */
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
 * プレビュー内容を PDF として出力 (印刷ダイアログ経由)
 */
async function exportToPdf() {
  if (!preview.innerHTML || preview.innerHTML.trim() === '') {
    showError('エクスポートエラー', '出力する内容がありません。');
    return;
  }
  
  await Neutralino.os.showMessageBox(
    'PDF出力', 
    '印刷ダイアログが開きます。\n\nプリンター（送信先）として「PDFとして保存（Save as PDF）」または「Microsoft Print to PDF」を選択して保存してください。', 
    'OK', 'INFO'
  );
  
  // WebViewのネイティブ印刷機能呼び出し
  window.print();
}

// ============================================================
// 表示モード
// ============================================================

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

// ============================================================
// UI更新ヘルパー
// ============================================================

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

// ============================================================
// ダイアログ・エラー表示
// ============================================================

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

// ============================================================
// ユーティリティ
// ============================================================

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
 * 簡易パス解決（相対パスを絶対パスへ）
 */
function resolvePath(baseDir, relativePath) {
  // OSごとの区切り文字を考慮しつつ簡易解決
  const isWin = baseDir.includes('\\');
  const sep = isWin ? '\\' : '/';
  
  // スラッシュを正規化
  let base = baseDir.replace(/[\\/]/g, '/');
  let rel = relativePath.replace(/[\\/]/g, '/');
  
  if (!base.endsWith('/')) base += '/';
  
  if (rel.startsWith('./')) {
    rel = rel.substring(2);
  }
  
  while (rel.startsWith('../')) {
    rel = rel.substring(3);
    // 最後のディレクトリを削る
    const parts = base.split('/');
    parts.pop(); // 空文字
    parts.pop(); // 最後のディレクトリ
    base = parts.join('/') + '/';
  }
  
  let resolved = base + rel;
  return isWin ? resolved.replace(/\//g, '\\') : resolved;
}

// ============================================================
// タブ管理ロジック
// ============================================================

/**
 * 新しいタブを追加する
 * @param {string|null} filePath - ファイルパス（nullなら新規）
 * @param {string} content - コンテンツ
 */
async function addTab(filePath = null, content = '') {
  const id = Date.now().toString();
  const tab = {
    id,
    filePath,
    content,
    originalContent: content,
    isModified: false,
    lastModifiedTime: null,
    scrollTop: 0
  };

  state.tabs.push(tab);
  
  if (filePath) {
    try {
      const stats = await Neutralino.filesystem.getStats(filePath);
      tab.lastModifiedTime = stats.modifiedTime;
    } catch (err) {
      console.warn('Failed to get stats for new tab:', err);
    }
  }

  renderTabs();
  switchTab(id);
}

/**
 * タブを切り替える
 * @param {string} tabId 
 */
function switchTab(tabId) {
  if (state.activeTabId === tabId && state.tabs.length > 0) return;

  // 現在のタブの状態を保存
  saveCurrentTabState();

  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  state.activeTabId = tabId;
  
  // UI/State同期
  editor.value = tab.content;
  state.currentFilePath = tab.filePath;
  state.originalContent = tab.originalContent;
  state.isModified = tab.isModified;
  state.lastModifiedTime = tab.lastModifiedTime;

  updateFileTitle();
  updatePreview();
  updateLineCount();
  
  editor.scrollTop = tab.scrollTop;
  unsavedDot.className = tab.isModified ? 'unsaved-dot visible' : 'unsaved-dot';

  // 監視の切り替え
  stopWatchingFile();
  if (tab.filePath) {
    startWatchingFile();
  } else {
    dismissNotification();
  }

  renderTabs();
  editor.focus();
}

/**
 * 現在表示中のエディタ内容を activeTab オブジェクトに同期する
 */
function saveCurrentTabState() {
  const activeTab = state.tabs.find(t => t.id === state.activeTabId);
  if (activeTab) {
    activeTab.content = editor.value;
    activeTab.isModified = state.isModified;
    activeTab.scrollTop = editor.scrollTop;
  }
}

/**
 * タブを閉じる
 * @param {string} tabId 
 */
async function closeTab(tabId) {
  const tabIndex = state.tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  const tab = state.tabs[tabIndex];
  
  if (tab.isModified) {
    const fileName = getFileName(tab.filePath);
    const choice = await Neutralino.os.showMessageBox(
      '未保存の変更',
      `「${fileName}」には未保存の変更があります。破棄して閉じますか？`,
      'YES_NO',
      'WARNING'
    );
    if (choice !== 'YES') return;
  }

  state.tabs.splice(tabIndex, 1);

  if (state.tabs.length === 0) {
    addTab();
  } else if (state.activeTabId === tabId) {
    const nextTab = state.tabs[Math.min(tabIndex, state.tabs.length - 1)];
    state.activeTabId = null;
    switchTab(nextTab.id);
  } else {
    renderTabs();
  }
}

/**
 * タブ要素の生成・描画
 */
function renderTabs() {
  const tabBar = $('tab-bar');
  if (!tabBar) return;

  tabBar.innerHTML = '';
  
  state.tabs.forEach(tab => {
    const tabEl = document.createElement('div');
    tabEl.className = `tab ${tab.id === state.activeTabId ? 'active' : ''} ${tab.isModified ? 'modified' : ''}`;
    
    const fileName = getFileName(tab.filePath);
    tabEl.innerHTML = `
      <span class="tab-title" title="${tab.filePath || '新規ファイル'}">${fileName}</span>
      <span class="tab-close" title="閉じる">✕</span>
    `;
    
    tabEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        e.stopPropagation();
        closeTab(tab.id);
      } else {
        switchTab(tab.id);
      }
    });
    
    tabBar.appendChild(tabEl);
  });
}

// ============================================================
// シングルインスタンス化（IPC機能）
// ============================================================

/**
 * シングルインスタンス化の初期化
 * 既に起動中のプロセスがあれば、引数を渡して自身を終了する
 */
async function initIPC() {
  try {
    const temp = await Neutralino.os.getEnv('TEMP');
    if (!temp) return;
    
    const ipcDir = temp + '\\markdown_viewer_ipc';
    
    // ディレクトリ作成
    try { 
      await Neutralino.filesystem.createDirectory(ipcDir); 
    } catch(e) {}
    
    const pidFile = ipcDir + '\\primary.pid';
    state.isPrimaryInstance = true;
    
    try {
      const primaryPid = await Neutralino.filesystem.readFile(pidFile);
      if (primaryPid && /^\d+$/.test(primaryPid.trim())) {
        const pid = primaryPid.trim();
        // tasklist で PID が生存しているか確認
        const checkCmd = await Neutralino.os.execCommand(`tasklist /FI "PID eq ${pid}" /NH`);
        if (checkCmd.stdOut.includes(pid)) {
          state.isPrimaryInstance = false;
        }
      }
    } catch(e) {}
    
    if (state.isPrimaryInstance) {
      // プライマリ：PID登録と監視開始
      await Neutralino.filesystem.writeFile(pidFile, NL_PID.toString());
      
      // 古いメッセージ破棄
      try {
        const entries = await Neutralino.filesystem.readDirectory(ipcDir);
        for (const entry of entries) {
          if (entry.entry.startsWith('msg_')) {
            await Neutralino.filesystem.removeFile(ipcDir + '\\' + entry.entry);
          }
        }
      } catch(e) {}

      // ポーリング用関数の定義（重複動作を防ぐため、setTimeout を再帰的に呼び出す）
      let isIpcPolling = false;
      const pollIpc = async () => {
        if (state.isIpcClosed || isIpcPolling) return;
        isIpcPolling = true;

        try {
          // ipcDir (ローカル変数) を使用
          const folderEntries = await Neutralino.filesystem.readDirectory(ipcDir);
          for (const entry of folderEntries) {
            // メッセージファイルのみを対象にする
            if (entry.type === 'FILE' && entry.entry.startsWith('msg_')) {
              const msgPath = ipcDir + '\\' + entry.entry;
              
              try {
                const content = await Neutralino.filesystem.readFile(msgPath);
                // 読み込めたら、再処理されないように直ちに削除
                await Neutralino.filesystem.removeFile(msgPath);
                
                const data = JSON.parse(content);
                if (data && data.args) {
                  for (let i = 1; i < data.args.length; i++) {
                    const arg = data.args[i];
                    if (arg && !arg.startsWith('--')) {
                      await loadFile(arg);
                    }
                  }
                  // ウィンドウを前面に出す
                  await Neutralino.window.show();
                  await Neutralino.window.focus();
                }
              } catch (e) {
                // readFile や removeFile が失敗した場合は無視
              }
            }
          }
        } catch (err) {
          // ディレクトリ読み込みエラー等
        } finally {
          isIpcPolling = false;
          if (!state.isIpcClosed) {
            setTimeout(pollIpc, 800);
          }
        }
      };

      // 最初のポーリングを開始
      setTimeout(pollIpc, 200);
      
    } else {
      // セカンダリ：引数送信して終了
      const msgFile = ipcDir + '\\msg_' + Date.now() + '_' + NL_PID + '.json';
      await Neutralino.filesystem.writeFile(msgFile, JSON.stringify({ args: NL_ARGS }));
      await Neutralino.app.exit();
    }
  } catch(err) {
    console.error('IPC init error:', err);
  }
}
