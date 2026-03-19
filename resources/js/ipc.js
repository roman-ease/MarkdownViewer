/**
 * Markdown Viewer - シングルインスタンス化（IPC機能）
 */

/**
 * シングルインスタンス通信
 */
async function initIPC() {
  try {
    state.isPrimaryInstance = true;
    state.lastIpcTimestamp = 0;
    
    let primaryInfo = null;
    try {
      const data = await Neutralino.storage.getData('primary_info');
      primaryInfo = JSON.parse(data);
    } catch(e) {}

    // 既存プロセスの生存確認
    if (primaryInfo && primaryInfo.pid) {
      const pid = primaryInfo.pid;
      try {
        const checkCmd = await Neutralino.os.execCommand(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`);
        if (checkCmd.stdOut.includes(`"${pid}"`) && pid.toString() !== NL_PID.toString()) {
          state.isPrimaryInstance = false;
        }
      } catch(e) {}
    }

    if (state.isPrimaryInstance) {
      // --- プライマリ：メッセージの受信待機 ---
      try {
        await Neutralino.storage.setData('primary_info', JSON.stringify({ pid: NL_PID, timestamp: Date.now() }));
      } catch(e) {
        console.warn('IPC: Failed to set primary info (Storage may be read-only)');
      }
      
      try {
        const lastMsgData = await Neutralino.storage.getData('ipc_message');
        if (lastMsgData) {
          state.lastIpcTimestamp = JSON.parse(lastMsgData).timestamp || 0;
        }
      } catch(e) {}

      const pollStorage = async () => {
        if (state.isIpcClosed) return;
        try {
          const msgData = await Neutralino.storage.getData('ipc_message');
          if (msgData) {
            const msg = JSON.parse(msgData);
            if (msg && msg.timestamp > state.lastIpcTimestamp) {
              state.lastIpcTimestamp = msg.timestamp;
              let count = 0;
              for (const arg of msg.args) {
                try {
                  await loadFile(arg);
                  count++;
                } catch(e) {}
              }
              if (count > 0) {
                await Neutralino.window.show();
                await Neutralino.window.focus();
                await Neutralino.os.showNotification('Markdown Viewer', `${count} 個のファイルを追加しました。`);
              }
            }
          }
        } catch(e) {} finally {
          if (!state.isIpcClosed) setTimeout(pollStorage, 200); 
        }
      };
      setTimeout(pollStorage, 200);

    } else {
      // --- セカンダリ：引数をプライマリに転送して終了 ---
      try {
        let cwd = NL_CWD;
        try {
          cwd = await Neutralino.os.getEnv('PWD') || await Neutralino.os.getEnv('CD') || NL_CWD;
        } catch(e) {}

        const fileArgs = [];
        for (const arg of NL_ARGS) {
          if (!arg || arg.startsWith('--')) continue;
          const lowArg = arg.toLowerCase();
          if (lowArg.endsWith('.exe') || lowArg.includes('markdownviewer') || lowArg.includes('neu')) continue;
          
          let fullPath = arg;
          if (!(/^[a-zA-Z]:\\/.test(fullPath) || fullPath.startsWith('/') || fullPath.startsWith('\\\\'))) {
            fullPath = cwd.replace(/[\\/]+$/, '') + '\\' + fullPath;
          }
          fileArgs.push(fullPath);
        }

        if (fileArgs.length > 0) {
          try {
            await Neutralino.storage.setData('ipc_message', JSON.stringify({
              args: fileArgs,
              timestamp: Date.now(),
              senderPid: NL_PID
            }));
            await new Promise(r => setTimeout(r, 220));
          } catch(e) {
            console.error('IPC: Failed to send message to primary');
          }
        }
      } catch(err) {
        console.error('IPC: Error in secondary instance:', err);
      } finally {
        // 何があってもセカンダリは終了させる
        await Neutralino.app.exit(0);
      }
    }
  } catch(err) {
    state.isPrimaryInstance = true;
  }
}
