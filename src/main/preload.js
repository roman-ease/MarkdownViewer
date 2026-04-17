'use strict';

/**
 * Preload Script — contextBridge を通じて Renderer に安全な API を公開
 *
 * contextIsolation: true の下では Renderer から直接 require() が使えないため、
 * ここで必要な機能だけを window.xxx として Renderer の世界に露出する。
 * これにより XSS 攻撃が Node.js API に到達することを防ぐ。
 */

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');
const hljs = require('highlight.js');

// ─── IPC ────────────────────────────────────────────────────────────────────
// ipcRenderer をそのまま渡さず、使用するメソッドだけをラップして公開する。
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send:   (channel, ...args) => ipcRenderer.send(channel, ...args),

  on: (channel, listener) => {
    const wrapped = (event, ...args) => listener(event, ...args);
    ipcRenderer.on(channel, wrapped);
    // 解除関数を返す
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  once: (channel, listener) => {
    ipcRenderer.once(channel, (event, ...args) => listener(event, ...args));
  },

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

// ─── Path ────────────────────────────────────────────────────────────────────
// Renderer で使うパス操作を個別に公開（fs へのフルアクセスは渡さない）
contextBridge.exposeInMainWorld('nodePath', {
  join:       (...args)   => path.join(...args),
  dirname:    (p)         => path.dirname(p),
  basename:   (p, ext)    => path.basename(p, ext),
  extname:    (p)         => path.extname(p),
  relative:   (from, to)  => path.relative(from, to),
  isAbsolute: (p)         => path.isAbsolute(p),
  normalize:  (p)         => path.normalize(p),
  resolve:    (...args)   => path.resolve(...args),
  sep:        path.sep,
});

// ─── OS ─────────────────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('nodeOs', {
  tmpdir: () => os.tmpdir(),
});

// ─── Highlight.js ────────────────────────────────────────────────────────────
// highlight.js はブラウザバンドルがないため preload から公開する。
// contextBridge はシリアライズ可能な値のみ通過できるため、
// 戻り値を { value, language } のプレーンオブジェクトに変換する。
contextBridge.exposeInMainWorld('hljs', {
  highlight: (code, opts) => {
    const r = hljs.highlight(code, opts);
    return { value: r.value, language: r.language || '' };
  },
  highlightAuto: (code) => {
    const r = hljs.highlightAuto(code);
    return { value: r.value, language: r.language || '' };
  },
  getLanguage: (lang) => !!hljs.getLanguage(lang),
});
