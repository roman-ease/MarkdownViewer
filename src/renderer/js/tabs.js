'use strict';
/* global ipcRenderer, document, Editor, Preview, Settings, Notifications */

/**
 * Tab Manager — タブの状態管理・UI 管理
 */
const Tabs = (() => {
  let _tabs = [];
  let _groups = []; // { id, name, color, collapsed }
  let _activeTabId = null;
  let _tabCounter = 0;
  let _groupCounter = 0;
  const _scrollPositions = new Map(); // tabId -> { editor, preview }

  // 書斎パレット（アンティークな色調のまま色相はハッキリ分ける / 蛍光・高彩度は不可）
  const GROUP_COLORS = [
    '#d1a13f', // Brass Gold
    '#c0673c', // Terracotta
    '#a44a52', // Burgundy
    '#6f9048', // Moss
    '#45809e', // Slate Blue
    '#7d5f9c', // Plum
  ];

  const tabList = () => document.getElementById('tab-list');
  const previewContent = () => document.getElementById('preview-content');

  // ─── タブ作成 ────────────────────────────────────────────────────────────
  function createTab(options = {}) {
    const id = `tab-${++_tabCounter}`;
    const tab = {
      id,
      title: options.title || '新規ファイル',
      filePath: options.filePath || null,
      content: options.content || '',
      savedContent: options.content || '',
      isDirty: false,
      encoding: options.encoding || Settings.get('encoding') || 'utf8',
      lineEnding: options.lineEnding || Settings.get('lineEnding') || 'lf',
      groupId: null,
    };
    _tabs.push(tab);
    _renderTabEl(tab);
    return tab;
  }

  // ─── 空タブ再利用 ────────────────────────────────────────────────────────
  function findReuseableTab() {
    return _tabs.find(t => !t.filePath && t.content === '' && !t.isDirty);
  }

  // ─── 既開きタブ検索 ──────────────────────────────────────────────────────
  function findTabByPath(filePath) {
    return _tabs.find(t => t.filePath && t.filePath === filePath);
  }

  // ─── タブアクティブ化 ────────────────────────────────────────────────────
  function activateTab(tabId) {
    // 現在アクティブタブのスクロール位置を保存
    if (_activeTabId) {
      _scrollPositions.set(_activeTabId, {
        editor: Editor.getScrollTop(_activeTabId),
        preview: previewContent() ? previewContent().scrollTop : 0,
      });
    }

    _activeTabId = tabId;
    const tab = getTab(tabId);
    if (!tab) return;

    // 折りたたまれたグループのタブを選んだら展開する
    const g = _groups.find(x => x.id === tab.groupId);
    if (g && g.collapsed) {
      g.collapsed = false;
      _rebuildTabDOM();
    }

    // タブ UI 更新
    document.querySelectorAll('.tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tabId === tabId);
    });

    // スクロール位置復元
    const scroll = _scrollPositions.get(tabId) || { editor: 0, preview: 0 };

    // エディタ切替
    Editor.activate(tabId, tab.content, scroll.editor);

    // プレビュー更新
    Preview.render(tab.content, tab.filePath).then(() => {
      if (previewContent()) previewContent().scrollTop = scroll.preview;
    });

    // タイトルバー更新
    _updateTitle(tab);

    // ステータスバー更新
    window.dispatchEvent(new CustomEvent('tab-activated', { detail: tab }));
  }

  // ─── タブ状態更新 ────────────────────────────────────────────────────────
  function updateTabState(tabId, updates) {
    const tab = getTab(tabId);
    if (!tab) return;
    Object.assign(tab, updates);
    _updateTabEl(tab);
    _updateTitle(tab);
    window.dispatchEvent(new CustomEvent('tab-state-changed', { detail: tab }));
  }

  // ─── タブを閉じる ────────────────────────────────────────────────────────
  async function closeTab(tabId, skipConfirm = false) {
    const tab = getTab(tabId);
    if (!tab) return;

    if (!skipConfirm && tab.isDirty) {
      const result = await ipcRenderer.invoke('show-message-box', {
        type: 'question',
        title: '未保存の変更',
        message: `"${tab.title}" の変更を保存しますか?`,
        buttons: ['保存', '保存しない', 'キャンセル'],
        defaultId: 0,
        cancelId: 2,
      });
      if (result.response === 2) return false; // キャンセル
      if (result.response === 0) {
        const saved = await window.App.saveTab(tabId);
        if (!saved) return false;
      }
    }

    // ファイル監視解除
    if (tab.filePath) {
      ipcRenderer.invoke('unwatch-file', tab.filePath);
    }

    // エディタ破棄
    Editor.destroyInstance(tabId);

    // 配列から削除
    const idx = _tabs.findIndex(t => t.id === tabId);
    _tabs.splice(idx, 1);
    _scrollPositions.delete(tabId);

    // DOM 再構築（空グループの掃除も兼ねる）
    _normalizeGroups();
    _rebuildTabDOM();

    // 次のタブをアクティブ化
    if (_activeTabId === tabId) {
      _activeTabId = null;
      if (_tabs.length > 0) {
        const nextIdx = Math.min(idx, _tabs.length - 1);
        activateTab(_tabs[nextIdx].id);
      } else {
        // タブが0になったら新規タブを作る
        const newTab = createTab();
        activateTab(newTab.id);
      }
    }

    return true;
  }

  // 未保存チェック付き全タブ閉じ
  async function closeAllTabs() {
    const dirtyTabs = _tabs.filter(t => t.isDirty);
    if (dirtyTabs.length > 0) {
      const names = dirtyTabs.map(t => t.title).join(', ');
      const result = await ipcRenderer.invoke('show-message-box', {
        type: 'question',
        title: '未保存の変更',
        message: `以下のファイルに未保存の変更があります:\n${names}\n\n保存しますか?`,
        buttons: ['すべて保存', '保存しない', 'キャンセル'],
        defaultId: 0,
        cancelId: 2,
      });
      if (result.response === 2) return false;
      if (result.response === 0) {
        for (const tab of dirtyTabs) {
          await window.App.saveTab(tab.id);
        }
      }
    }
    return true;
  }

  // ─── タブ一括クローズ ────────────────────────────────────────────────────
  async function _closeTabsBatch(tabIds) {
    const toClose = tabIds.map(id => getTab(id)).filter(Boolean);
    const dirty = toClose.filter(t => t.isDirty);
    if (dirty.length > 0) {
      const names = dirty.map(t => t.title).join('\n');
      const result = await ipcRenderer.invoke('show-message-box', {
        type: 'question',
        title: '未保存の変更',
        message: `以下のファイルに未保存の変更があります:\n${names}\n\n保存しますか?`,
        buttons: ['すべて保存', '保存しない', 'キャンセル'],
        defaultId: 0,
        cancelId: 2,
      });
      if (result.response === 2) return false;
      if (result.response === 0) {
        for (const tab of dirty) await window.App.saveTab(tab.id);
      }
    }
    for (const id of [...tabIds]) await closeTab(id, true);
    return true;
  }

  async function _closeTabsToRight(tabId) {
    const idx = _tabs.findIndex(t => t.id === tabId);
    await _closeTabsBatch(_tabs.slice(idx + 1).map(t => t.id));
  }

  async function _closeTabsToLeft(tabId) {
    const idx = _tabs.findIndex(t => t.id === tabId);
    await _closeTabsBatch(_tabs.slice(0, idx).map(t => t.id));
  }

  async function _closeOtherTabs(tabId) {
    await _closeTabsBatch(_tabs.filter(t => t.id !== tabId).map(t => t.id));
  }

  async function _closeAllTabsMenu() {
    await _closeTabsBatch(_tabs.map(t => t.id));
  }

  // ─── タブグループ ────────────────────────────────────────────────────────
  // 同一グループのタブが連続するように並べ直し、空グループを捨てる
  function _normalizeGroups() {
    const out = [];
    const done = new Set();
    for (const t of _tabs) {
      if (!t.groupId) { out.push(t); continue; }
      if (done.has(t.groupId)) continue;
      done.add(t.groupId);
      out.push(..._tabs.filter(x => x.groupId === t.groupId));
    }
    _tabs = out;
    _groups = _groups.filter(g => _tabs.some(t => t.groupId === g.id));
  }

  function _setTabGroup(tabId, groupId) {
    const tab = getTab(tabId);
    if (!tab) return;
    tab.groupId = groupId;
    _normalizeGroups();
    _rebuildTabDOM();
  }

  function _createGroup(tabId) {
    const g = {
      id: `group-${++_groupCounter}`,
      name: `グループ ${_groupCounter}`,
      color: GROUP_COLORS[(_groupCounter - 1) % GROUP_COLORS.length],
      collapsed: false,
    };
    _groups.push(g);
    _setTabGroup(tabId, g.id);
  }

  function _toggleCollapse(groupId) {
    const g = _groups.find(x => x.id === groupId);
    if (!g) return;
    if (!g.collapsed) {
      // アクティブタブが中にいる場合は外のタブへ逃がす（外が無ければ畳まない）
      const active = getActiveTab();
      if (active && active.groupId === groupId) {
        const outside = _tabs.find(t => t.groupId !== groupId);
        if (!outside) return;
        activateTab(outside.id);
      }
    }
    g.collapsed = !g.collapsed;
    _rebuildTabDOM();
  }

  // ─── コンテキストメニュー ────────────────────────────────────────────────
  function _showMenu(x, y, build) {
    const prev = document.getElementById('tab-context-menu');
    if (prev) prev.remove();

    const menu = document.createElement('div');
    menu.id = 'tab-context-menu';
    menu.className = 'dropdown-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:9999;`;

    const item = (label, action, disabled = false) => {
      const el = document.createElement('div');
      el.className = 'dropdown-item' + (disabled ? ' disabled' : '');
      el.textContent = label;
      if (!disabled) el.addEventListener('click', () => { menu.remove(); action(); });
      return el;
    };
    const sep = () => { const el = document.createElement('div'); el.className = 'dropdown-separator'; return el; };

    menu.append(...build(item, sep));
    document.body.appendChild(menu);

    // 画面端補正
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)  menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close, true); } };
    setTimeout(() => document.addEventListener('click', close, true), 0);
  }

  // ─── タブ右クリックメニュー ──────────────────────────────────────────────
  function _showTabContextMenu(tabId, x, y) {
    const tab = getTab(tabId);
    const idx = _tabs.findIndex(t => t.id === tabId);
    const hasRight = idx < _tabs.length - 1;
    const hasLeft  = idx > 0;
    const hasOther = _tabs.length > 1;

    _showMenu(x, y, (item, sep) => [
      item('このタブを閉じる',           () => closeTab(tabId)),
      sep(),
      item('右のタブをすべて閉じる',     () => _closeTabsToRight(tabId), !hasRight),
      item('左のタブをすべて閉じる',     () => _closeTabsToLeft(tabId),  !hasLeft),
      sep(),
      item('他のタブをすべて閉じる',     () => _closeOtherTabs(tabId),   !hasOther),
      item('すべてのタブを閉じる',       () => _closeAllTabsMenu()),
      sep(),
      item('新しいグループに追加',       () => _createGroup(tabId)),
      ..._groups.filter(g => g.id !== (tab && tab.groupId))
        .map(g => item(`「${g.name}」に追加`, () => _setTabGroup(tabId, g.id))),
      item('グループから外す',           () => _setTabGroup(tabId, null), !(tab && tab.groupId)),
    ]);
  }

  // ─── グループ右クリックメニュー ──────────────────────────────────────────
  function _showGroupContextMenu(groupId, x, y) {
    const g = _groups.find(x2 => x2.id === groupId);
    if (!g) return;
    _showMenu(x, y, (item, sep) => [
      item(g.collapsed ? 'グループを展開' : 'グループを折りたたむ', () => _toggleCollapse(groupId)),
      item('名前を変更',       () => _startRename(groupId)),
      item('色を変える',       () => {
        g.color = GROUP_COLORS[(GROUP_COLORS.indexOf(g.color) + 1) % GROUP_COLORS.length];
        _rebuildTabDOM();
      }),
      sep(),
      item('グループを解除',   () => {
        _tabs.filter(t => t.groupId === groupId).forEach(t => { t.groupId = null; });
        _normalizeGroups();
        _rebuildTabDOM();
      }),
      item('グループのタブをすべて閉じる', () => _closeTabsBatch(_tabs.filter(t => t.groupId === groupId).map(t => t.id))),
    ]);
  }

  function _startRename(groupId) {
    const nameEl = tabList().querySelector(`[data-group-id="${groupId}"] .tab-group-name`);
    const g = _groups.find(x => x.id === groupId);
    if (!nameEl || !g) return;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    document.getSelection().selectAllChildren(nameEl);
    const commit = () => {
      nameEl.contentEditable = 'false';
      g.name = nameEl.textContent.trim() || g.name;
      _rebuildTabDOM();
    };
    nameEl.addEventListener('blur', commit, { once: true });
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = g.name; nameEl.blur(); }
    });
  }

  // ─── タブ並び替え ────────────────────────────────────────────────────────
  function _initDragSort() {
    tabList().addEventListener('dragstart', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      e.dataTransfer.setData('text/plain', tab.dataset.tabId);
      tab.classList.add('dragging');
    });
    tabList().addEventListener('dragend', (e) => {
      const tab = e.target.closest('.tab');
      if (tab) tab.classList.remove('dragging');
      tabList().querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
    });
    tabList().addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.target.closest('.tab');
      if (!target) return;
      tabList().querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
      target.classList.add('drag-over');
    });
    tabList().addEventListener('drop', (e) => {
      e.preventDefault();
      const fromId = e.dataTransfer.getData('text/plain');
      const toEl = e.target.closest('.tab');
      if (!toEl || toEl.dataset.tabId === fromId) return;
      const toId = toEl.dataset.tabId;
      const fromIdx = _tabs.findIndex(t => t.id === fromId);
      const toIdx = _tabs.findIndex(t => t.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = _tabs.splice(fromIdx, 1);
      _tabs.splice(toIdx, 0, moved);
      // グループの内側に落ちたら加入、それ以外は離脱
      const before = _tabs[toIdx - 1], after = _tabs[toIdx + 1];
      const inside = before && after && before.groupId && before.groupId === after.groupId;
      moved.groupId = inside ? before.groupId : null;
      _normalizeGroups();
      _rebuildTabDOM();
    });
  }

  // ─── DOM 操作 ────────────────────────────────────────────────────────────
  function _renderGroupEl(g) {
    const el = document.createElement('div');
    el.className = 'tab-group-chip' + (g.collapsed ? ' collapsed' : '');
    el.dataset.groupId = g.id;
    el.style.setProperty('--group-color', g.color);
    el.innerHTML = `<span class="tab-group-name">${_esc(g.name)}</span>`;
    el.title = g.collapsed ? 'クリックで展開' : 'クリックで折りたたむ';
    el.addEventListener('click', (e) => {
      if (e.target.isContentEditable) return;
      _toggleCollapse(g.id);
    });
    el.addEventListener('dblclick', (e) => { e.stopPropagation(); _startRename(g.id); });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      _showGroupContextMenu(g.id, e.clientX, e.clientY);
    });
    tabList().appendChild(el);
  }

  function _renderTabEl(tab) {
    const group = _groups.find(g => g.id === tab.groupId);
    const el = document.createElement('div');
    el.className = 'tab' + (group ? ' tab-grouped' : '');
    if (group) {
      el.style.setProperty('--group-color', group.color);
      if (group.collapsed) el.style.display = 'none';
    }
    el.dataset.tabId = tab.id;
    el.draggable = true;
    el.innerHTML = `
      <span class="tab-title ${tab.isDirty ? 'tab-dirty' : ''}" title="${_escAttr(tab.filePath || tab.title)}">${_esc(tab.title)}</span>
      <button class="tab-close" title="閉じる">✕</button>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) return;
      activateTab(tab.id);
    });
    el.querySelector('.tab-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      activateTab(tab.id);
      _showTabContextMenu(tab.id, e.clientX, e.clientY);
    });
    tabList().appendChild(el);
  }

  function _updateTabEl(tab) {
    const el = tabList().querySelector(`[data-tab-id="${tab.id}"]`);
    if (!el) return;
    const titleEl = el.querySelector('.tab-title');
    titleEl.textContent = tab.title;
    titleEl.title = tab.filePath || tab.title;
    titleEl.className = `tab-title${tab.isDirty ? ' tab-dirty' : ''}`;
  }

  function _rebuildTabDOM() {
    tabList().innerHTML = '';
    let prevGroupId = null;
    _tabs.forEach(t => {
      if (t.groupId && t.groupId !== prevGroupId) {
        const g = _groups.find(x => x.id === t.groupId);
        if (g) _renderGroupEl(g);
      }
      prevGroupId = t.groupId;
      _renderTabEl(t);
    });
    // アクティブ再適用
    if (_activeTabId) {
      const el = tabList().querySelector(`[data-tab-id="${_activeTabId}"]`);
      if (el) el.classList.add('active');
    }
  }

  function _updateTitle(tab) {
    const dirty = tab.isDirty ? '● ' : '';
    const title = tab.filePath ? `${dirty}${tab.title} — Quill` : `${dirty}新規ファイル — Quill`;
    ipcRenderer.send('set-title', title);
  }

  function _esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function _escAttr(str) {
    return String(str).replace(/"/g, '&quot;');
  }

  // ─── ナビゲーション ──────────────────────────────────────────────────────
  function nextTab() {
    if (_tabs.length === 0) return;
    const idx = _tabs.findIndex(t => t.id === _activeTabId);
    const next = (idx + 1) % _tabs.length;
    activateTab(_tabs[next].id);
  }

  function prevTab() {
    if (_tabs.length === 0) return;
    const idx = _tabs.findIndex(t => t.id === _activeTabId);
    const prev = (idx - 1 + _tabs.length) % _tabs.length;
    activateTab(_tabs[prev].id);
  }

  // ─── Getters ─────────────────────────────────────────────────────────────
  function getTab(tabId) {
    return _tabs.find(t => t.id === tabId) || null;
  }

  function getActiveTab() {
    return _activeTabId ? getTab(_activeTabId) : null;
  }

  function getAllTabs() {
    return [..._tabs];
  }

  function getActiveTabId() {
    return _activeTabId;
  }

  // ─── Session Serialization ───────────────────────────────────────────────
  function toSessionData() {
    return {
      tabs: _tabs.map(t => ({
        id: t.id,
        title: t.title,
        filePath: t.filePath,
        content: t.content,
        savedContent: t.savedContent,
        isDirty: t.isDirty,
        encoding: t.encoding,
        lineEnding: t.lineEnding,
        groupId: t.groupId || null,
        scroll: _scrollPositions.get(t.id) || { editor: 0, preview: 0 },
      })),
      groups: _groups.map(g => ({ ...g })),
      activeTabId: _activeTabId,
      counter: _tabCounter,
      groupCounter: _groupCounter,
    };
  }

  function fromSessionData(data) {
    if (!data || !data.tabs || data.tabs.length === 0) return false;
    _tabCounter = data.counter || 0;
    _groupCounter = data.groupCounter || 0;
    // 旧パレットのグループは新パレットへ読み替え
    _groups = (data.groups || []).map((g, i) => ({
      ...g,
      color: GROUP_COLORS.includes(g.color) ? g.color : GROUP_COLORS[i % GROUP_COLORS.length],
    }));

    data.tabs.forEach(savedTab => {
      const tab = {
        id: savedTab.id,
        title: savedTab.title,
        filePath: savedTab.filePath,
        content: savedTab.content || '',
        savedContent: savedTab.savedContent || '',
        isDirty: savedTab.isDirty || false,
        encoding: savedTab.encoding || 'utf8',
        lineEnding: savedTab.lineEnding || 'lf',
        groupId: savedTab.groupId || null,
      };
      _tabs.push(tab);
      if (savedTab.scroll) _scrollPositions.set(tab.id, savedTab.scroll);
    });
    _normalizeGroups();
    _rebuildTabDOM();

    const targetId = data.activeTabId || (_tabs[0] && _tabs[0].id);
    if (targetId) activateTab(targetId);
    return true;
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    _initDragSort();

    document.getElementById('new-tab-btn').addEventListener('click', () => {
      window.App.newFile();
    });
  }

  return {
    init,
    createTab,
    findReuseableTab,
    findTabByPath,
    activateTab,
    updateTabState,
    closeTab,
    closeAllTabs,
    nextTab,
    prevTab,
    getTab,
    getActiveTab,
    getAllTabs,
    getActiveTabId,
    toSessionData,
    fromSessionData,
  };
})();
