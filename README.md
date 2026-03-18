# Markdown Viewer

[![Neutralinojs](https://img.shields.io/badge/Framework-Neutralinojs-blue.svg)](https://neutralino.js.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.4.0-green.svg)](CHANGELOG.md)

Windows向けの超軽量・高速なMarkdownビューア兼エディタです。
[Neutralinojs](https://neutralino.js.org/)を採用し、システム標準のWebView2を利用することで、アプリ本体を非常にコンパクト（約2MB）に保っています。

![Markdown Viewer](resources/icons/appIcon.png) <!-- アイコンやスクリーンショットがあればここに -->

## ✨ 主な機能

- **🚀 超軽量・高速起動**: OS標準のエンジンを利用するため、Electron製アプリと比較して非常に軽量。
- **📑 マルチタブ管理**: 複数のファイルを同時に開き、タブで切り替えて編集・閲覧可能。
- **🛡️ 堅牢なセキュリティ (v1.4.0)**: `DOMPurify` による HTML サニタイズを実装。悪意ある Markdown からの XSS 攻撃を防止。
- **📊 Mermaid対応**: フローチャートやシーケンス図などを直接描画可能。
- **🖼️ 画像の高度な扱い**:
  - Obsidian型のウィキリンク (`![[image.png]]`) をサポート。
  - クリップボードからの画像貼り付け（自動保存＆リンク挿入）に対応。
  - ローカルの相対パス・絶対パス画像を安全に表示。
- **🔄 シングルインスタンス**: ファイルのダブルクリック時に既存のウィンドウへタブを追加。高速な IPC 通信によりストレスのない操作感を実現。
- **📤 エクスポート**:
  - 単体 HTML ファイルへの書き出し。
  - OS標準の印刷機能を介した高品質な PDF 出力。
- **🖋️ リアルタイムプレビュー**: 入力と同時にプレビューが更新。
- **📜 履歴管理**: 最近使ったファイルを即座に開ける履歴メニュー。

## 🛠️ 技術スタック

- **Core**: [Neutralinojs](https://neutralino.js.org/) (WebView2 based)
- **Parser**: [marked.js](https://marked.js.org/)
- **Sanitizer**: [DOMPurify](https://github.com/cure53/dompurify)
- **Syntax Highlight**: [highlight.js](https://highlightjs.org/)
- **Diagrams**: [mermaid.js](https://mermaid-js.github.io/)
- **Styling**: Vanilla CSS (Modern glassmorphism UI)

## 📥 インストール・実行

### リリース版（バイナリ）

1. [Releases](https://github.com/roman-ease/MarkdownViewer/releases) から最新の `MarkdownViewer_vX.X.X.zip` をダウンロードします。
2. 解凍後、`MarkdownViewer-win_x64.exe` を実行してください。

### 開発用ビルド

1. Node.js がインストールされていることを確認します。
2. リポジトリをクローンします。
3. 依存関係のインストールと実行:

```bash
npx -y @neutralinojs/neu run
```

## 📝 ライセンス

[MIT License](LICENSE)
