# Markdown Viewer

[![Neutralinojs](https://img.shields.io/badge/Framework-Neutralinojs-blue.svg)](https://neutralino.js.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.3.0-green.svg)](CHANGELOG.md)

Windows向けの超軽量・高速なMarkdownビューア兼エディタです。
[Neutralinojs](https://neutralino.js.org/)を採用し、システム標準のWebView2を利用することで、アプリ本体を非常にコンパクト（約2MB）に保っています。

![Markdown Viewer](resources/icons/appIcon.png) <!-- アイコンやスクリーンショットがあればここに -->

## ✨ 主な機能

- **🚀 超軽量・高速起動**: OS標準のエンジンを利用するため、Electron製アプリと比較して非常に軽量です。
- **📑 マルチタブ管理**: 複数のファイルを同時に開き、タブで切り替えて編集できます。
- **📊 Mermaid対応**: フローチャートやシーケンス図などをMarkdown内で直接描画できます。
- **🖼️ 画像の高度な扱い**:
  - Obsidian型のウィキリンク (`![[image.png]]`) をサポート。
  - クリップボードからの画像貼り付け（自動保存＆リンク挿入）に対応。
  - ローカルの相対パス・絶対パス画像を表示可能。
- **🔄 シングルインスタンス (v1.2.0)**: ファイルのダブルクリック時に既存のウィンドウへタブを追加します。ストレージベースの安定したIPCを搭載。
- **📤 エクスポート**:
  - 単体HTMLファイルへの書き出し。
  - OS標準の印刷機能を介した高品質なPDF出力。
- **🖋️ リアルタイムプレビュー**: 入力と同時にプレビューが更新されます。
- **📜 履歴管理**: 最近使ったファイルを「履歴」メニューから即座に開けます。

## 🛠️ 技術スタック

- **Core**: [Neutralinojs](https://neutralino.js.org/) (WebView2 based)
- **Parser**: [marked.js](https://marked.js.org/)
- **Syntax Highlight**: [highlight.js](https://highlightjs.org/)
- **Diagrams**: [mermaid.js](https://mermaid-js.github.io/)
- **Styling**: Vanilla CSS (Modern layout)

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
