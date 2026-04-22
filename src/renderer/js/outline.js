'use strict';
/* global document, window, Settings, Editor */

/**
 * Outline Drawer — 見出しアウトライン・オーバーレイドロワー
 *
 * backdrop は使用しない（pointer-events をブロックしないため）。
 * ドロワー外クリック検知は document click リスナーで行う。
 */
const Outline = (() => {
  let _open   = false;
  let _pinned = false;
  let _observer = null;

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    document.getElementById('outline-close-btn').addEventListener('click', close);
    document.getElementById('outline-pin-btn').addEventListener('click', togglePin);

    // ドロワー外クリックで閉じる（ピン留め中は無効）
    // バブリングフェーズで検知 — toggle() が先に実行された後に評価されるため
    // btn クリック時は btn.contains(e.target) が true になり誤閉じしない
    document.addEventListener('click', (e) => {
      if (!_open || _pinned) return;
      const drawer = document.getElementById('outline-drawer');
      const btn    = document.getElementById('outline-btn');
      if (!drawer.contains(e.target) && !btn.contains(e.target)) close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _open) { e.stopPropagation(); close(); return; }
      const kb = Settings.get('keybindings') || {};
      if (_matchesKey(e, kb['outline'] || 'Ctrl+Shift+O')) {
        e.preventDefault();
        toggle();
      }
    });

    window.addEventListener('preview-rendered', () => { if (_open) _build(); });
    window.addEventListener('tab-activated',    () => { if (_open) _build(); });
  }

  // ─── Public ───────────────────────────────────────────────────────────────

  function toggle() { _open ? close() : open(); }

  function open() {
    _open = true;
    document.getElementById('outline-drawer').classList.add('open');
    document.getElementById('outline-btn').classList.add('active');
    _build();
  }

  function close() {
    _open = false;
    document.getElementById('outline-drawer').classList.remove('open');
    document.getElementById('outline-btn').classList.remove('active');
    _disconnectObserver();
    // ピン留め状態も解除（閉じたらリセット）
    if (_pinned) _applyPin(false);
  }

  function togglePin() { _applyPin(!_pinned); }

  // ─── Pin ──────────────────────────────────────────────────────────────────

  function _applyPin(val) {
    _pinned = val;
    document.getElementById('outline-pin-btn').classList.toggle('active', _pinned);
    document.body.classList.toggle('outline-pinned', _pinned);
    // レイアウト変更後に CodeMirror を再計測
    if (window.Editor) setTimeout(() => Editor.refresh(), 240);
  }

  // ─── Build ────────────────────────────────────────────────────────────────

  function _build() {
    const list           = document.getElementById('outline-list');
    const previewContent = document.getElementById('preview-content');
    const headings       = Array.from(previewContent.querySelectorAll('h1,h2,h3,h4,h5,h6'));

    list.innerHTML = '';

    if (headings.length === 0) {
      list.innerHTML = '<div class="outline-empty">見出しがありません</div>';
      return;
    }

    const minLevel = Math.min(...headings.map(h => parseInt(h.tagName[1])));

    headings.forEach(heading => {
      const level = parseInt(heading.tagName[1]);
      const item  = document.createElement('div');
      item.className       = `outline-item outline-level-${level - minLevel + 1}`;
      item.textContent     = heading.textContent;
      item.dataset.targetId = heading.id;
      item.addEventListener('click', () => _scrollTo(heading));
      list.appendChild(item);
    });

    _setupObserver(headings);
  }

  // ─── Scroll ───────────────────────────────────────────────────────────────

  function _scrollTo(heading) {
    const pane      = document.getElementById('preview-content');
    const paneRect  = pane.getBoundingClientRect();
    const headRect  = heading.getBoundingClientRect();
    const target    = pane.scrollTop + (headRect.top - paneRect.top) - 20;
    pane.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }

  // ─── Active tracking (IntersectionObserver) ───────────────────────────────

  function _setupObserver(headings) {
    _disconnectObserver();
    _observer = new IntersectionObserver(_onIntersect, {
      root:       document.getElementById('preview-content'),
      rootMargin: '-5% 0px -75% 0px',
      threshold:  0,
    });
    headings.forEach(h => _observer.observe(h));
  }

  function _onIntersect(entries) {
    const visible = entries.filter(e => e.isIntersecting);
    if (visible.length === 0) return;
    const top = visible.reduce((a, b) =>
      a.boundingClientRect.top < b.boundingClientRect.top ? a : b
    );
    _setActive(top.target.id);
  }

  function _setActive(id) {
    document.querySelectorAll('#outline-list .outline-item').forEach(item => {
      item.classList.toggle('active', item.dataset.targetId === id);
    });
    const active = document.querySelector('#outline-list .outline-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function _disconnectObserver() {
    if (_observer) { _observer.disconnect(); _observer = null; }
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  function _matchesKey(e, keyStr) {
    const parts = keyStr.split('+');
    const key   = parts[parts.length - 1];
    const ctrl  = parts.includes('Ctrl');
    const shift = parts.includes('Shift');
    const alt   = parts.includes('Alt');
    return e.ctrlKey === ctrl && e.shiftKey === shift && e.altKey === alt
        && e.key.toUpperCase() === key.toUpperCase();
  }

  return { init, toggle, open, close };
})();

window.Outline = Outline;
