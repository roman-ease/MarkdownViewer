'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');
const hljs = require('highlight.js');

// ─── ipcRenderer ─────────────────────────────────────────────────────────────

const INVOKE_CHANNELS = new Set([
  'show-open-dialog', 'show-save-dialog', 'show-message-box',
  'read-file', 'write-file', 'stat-file', 'ensure-dir', 'path-info',
  'read-image-base64', 'save-image',
  'open-external',
  'get-recent-files', 'add-recent-file',
  'print-to-pdf',
  'load-settings', 'save-settings',
  'load-session', 'save-session',
  'get-templates', 'save-templates',
  'watch-file', 'unwatch-file',
  'set-always-on-top', 'set-zoom-factor',
  'get-app-version',
]);

const SEND_CHANNELS = new Set([
  'confirm-close', 'rebuild-menu',
  'set-title', 'set-menu-item-checked',
]);

const ON_CHANNELS = new Set([
  'open-files', 'app-before-close', 'file-changed', 'file-deleted',
  'menu-new-file', 'menu-open-file', 'menu-save', 'menu-save-as', 'menu-reload-file',
  'menu-close-tab',
  'menu-export-html', 'menu-export-pdf',
  'menu-find', 'menu-replace',
  'menu-insert-table', 'menu-insert-toc', 'menu-insert-mermaid',
  'menu-settings', 'menu-about', 'menu-shortcut-help',
  'format-bold', 'format-italic', 'format-link',
  'focus-mode',
  'set-theme', 'set-view-mode',
  'tab-next', 'tab-prev',
  'toggle-focus-mode', 'toggle-sync-scroll',
]);

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel)) throw new Error(`Blocked invoke channel: ${channel}`);
    return ipcRenderer.invoke(channel, ...args);
  },
  send: (channel, ...args) => {
    if (!SEND_CHANNELS.has(channel)) throw new Error(`Blocked send channel: ${channel}`);
    ipcRenderer.send(channel, ...args);
  },
  on: (channel, listener) => {
    if (!ON_CHANNELS.has(channel)) throw new Error(`Blocked on channel: ${channel}`);
    ipcRenderer.on(channel, listener);
  },
  once: (channel, listener) => {
    if (!ON_CHANNELS.has(channel)) throw new Error(`Blocked once channel: ${channel}`);
    ipcRenderer.once(channel, listener);
  },
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },
});

// ─── Node APIs ───────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('nodePath', {
  join: (...args) => path.join(...args),
  dirname: (p) => path.dirname(p),
  basename: (p, ext) => path.basename(p, ext),
  extname: (p) => path.extname(p),
  isAbsolute: (p) => path.isAbsolute(p),
  resolve: (...args) => path.resolve(...args),
  sep: path.sep,
});

contextBridge.exposeInMainWorld('nodeOs', {
  homedir: () => os.homedir(),
  platform: () => os.platform(),
  tmpdir: () => os.tmpdir(),
});

// ─── highlight.js ────────────────────────────────────────────────────────────
// Exposed via preload because hljs has no standalone browser bundle

contextBridge.exposeInMainWorld('hljs', {
  getLanguage: (lang) => !!hljs.getLanguage(lang),
  highlight: (code, opts) => ({ value: hljs.highlight(code, opts).value }),
  highlightAuto: (code) => ({ value: hljs.highlightAuto(code).value }),
});
