/**
 * Markdown Viewer - プレビューレンダリング・画像処理
 */

/**
 * エディタの内容を Markdown → HTML に変換してプレビューに反映
 */
async function updatePreview() {
  // Obsidian型のWikilink（![[画像ファイル]]）をMarkdown標準（![画像ファイル](画像ファイル)）に前置換
  const text = editor.value.replace(/!\[\[(.*?)\]\]/g, '![$1]($1)');
  
  try {
    if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
      // 見出しにIDを付与するためのカスタムレンダラー
      const renderer = new marked.Renderer();
      renderer.heading = (text, level) => {
        // text が文字列でない場合への対策と、内部のHTMLタグ（太字等）の除去
        const plainText = String(text).replace(/<[^>]*>/g, '');
        const id = plainText.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');
        return `<h${level} id="${id}">${text}</h${level}>`;
      };

      const dirtyHtml = marked.parse(text, { renderer });
      // XSS対策: DOMPurifyでサニタイズ (id属性を許可)
      const html = DOMPurify.sanitize(dirtyHtml, { ADD_ATTR: ['id'] });
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
      preview.innerHTML = DOMPurify.sanitize(text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>'));
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
    if (!src || src.startsWith('http') || src.startsWith('data:')) {
      continue;
    }

    let absolutePath = '';
    if (/^[A-Z]:\\/i.test(src) || src.startsWith('/') || src.startsWith('\\\\')) {
      absolutePath = src;
    } else if (src.startsWith('file://')) {
      absolutePath = decodeURIComponent(src.replace(/^file:\/\/\/?/, ''));
      if (currentDir.includes('\\')) {
        absolutePath = absolutePath.replace(/\//g, '\\');
      }
    } else {
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

      const base64Str = arrayBufferToBase64(buffer);
      img.src = `data:${mime};base64,${base64Str}`;
    } catch (err) {
      console.warn(`Failed to load relative image: ${absolutePath}`, err);
    }
  }
}

/**
 * ArrayBufferをBase64文字列に変換
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192; 
  
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * クリップボードの画像をローカルに保存し、エディタにObsidian型リンクを挿入する
 */
async function insertPastedImage(file) {
  if (!state.currentFilePath) {
    showError('保存エラー', '画像を貼り付ける前に、ファイルを一度保存（Ctrl+S）してください。');
    return;
  }

  try {
    const currentDir = state.currentFilePath.substring(0, state.currentFilePath.lastIndexOf('\\') + 1) ||
                       state.currentFilePath.substring(0, state.currentFilePath.lastIndexOf('/') + 1);
    
    const assetsDirName = 'images';
    const assetsDirPath = resolvePath(currentDir, assetsDirName);
    
    try {
      await Neutralino.filesystem.getStats(assetsDirPath);
    } catch {
      await Neutralino.filesystem.createDirectory(assetsDirPath);
    }

    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
    const extension = file.type === 'image/jpeg' ? 'jpg' : (file.name ? file.name.split('.').pop() : 'png');
    const fileName = `image_${timestamp}.${extension}`;
    const absolutePath = resolvePath(assetsDirPath, fileName);

    const arrayBuffer = await file.arrayBuffer();
    await Neutralino.filesystem.writeBinaryFile(absolutePath, arrayBuffer);
    
    const relativePath = `${assetsDirName}/${fileName}`;
    const insertText = `![[${relativePath}]]`;
    
    const startPos = editor.selectionStart;
    const endPos = editor.selectionEnd;
    editor.value = editor.value.substring(0, startPos) + insertText + editor.value.substring(endPos);
    
    const newPos = startPos + insertText.length;
    editor.selectionStart = newPos;
    editor.selectionEnd = newPos;
    
    setModified(true);
    updatePreview();
    updateLineCount();
    
    showNotification(`画像を保存しました: ${relativePath}`);
    setTimeout(dismissNotification, 3000);
    
  } catch (err) {
    showError('画像の保存に失敗しました', err);
  }
}

/**
 * プレビュー内のアンカーリンク（#）をクリックした際のスムーズスクロール
 */
preview.addEventListener('click', (e) => {
  const target = e.target.closest('a');
  if (target) {
    const href = target.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      const id = decodeURIComponent(href.substring(1));
      const element = preview.querySelector(`[id="${id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
});
