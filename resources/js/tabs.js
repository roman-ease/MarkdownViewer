/**
 * Markdown Viewer - タブ管理ロジック
 */

/**
 * 新しいタブを追加する
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
 */
function switchTab(tabId) {
  if (state.activeTabId === tabId && state.tabs.length > 0) return;

  saveCurrentTabState();

  const tab = state.tabs.find(t => t.id === tabId);
  if (!tab) return;

  state.activeTabId = tabId;
  
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

  // バージョンタブを追加（固定）
  const versionTab = document.createElement('div');
  versionTab.className = 'tab version-tab';
  versionTab.innerHTML = `<span class="tab-title">バージョン</span>`;
  versionTab.addEventListener('click', () => {
    showVersionInfo();
  });
  tabBar.appendChild(versionTab);
}

/**
 * バージョン情報を表示する（専用タブの動作）
 */
async function showVersionInfo() {
  let version = '1.6.4';
  try {
    const config = await Neutralino.app.getConfig();
    version = config.version;
  } catch (err) {
    console.warn('Failed to get version from config:', err);
  }

  Neutralino.os.showMessageBox(
    'バージョン情報',
    `Markdown Viewer v${version}\n\nFramework: Neutralinojs v6.5.0\nParser: marked.js\n\n© 2026 roman-ease`,
    'OK',
    'INFO'
  );
}
