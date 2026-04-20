'use strict';

/**
 * Preload Script — 現在は未使用 (参照メモとして保持)
 *
 * 本アプリは nodeIntegration: true / contextIsolation: false で動作しており、
 * レンダラーは index.html のインラインスクリプトで Node API を直接取得している。
 * そのため contextBridge による公開は不要で、このファイルは main.js の
 * webPreferences から参照されていない。
 *
 * contextIsolation: true に移行する場合は、レンダラー内の全 require() 呼び出しを
 * IPC 経由に置き換えたうえで、このファイルを preload として登録すること。
 */
