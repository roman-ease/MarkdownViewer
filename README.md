# Markdown Viewer

[![Neutralinojs](https://img.shields.io/badge/Framework-Neutralinojs-blue.svg)](https://neutralino.js.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.5.2-green.svg)](CHANGELOG.md)

Windows向けの軽量・高速なMarkdownビューア兼エディタです。
[Neutralinojs](https://neutralino.js.org/)を採用し、システム標準のWebView2を利用することで、配布サイズを非常にコンパクト（約2.3MB）に抑えています。

## ✨ 主な機能

- **🚀 軽量・高速起動**: OS標準のレンダリングエンジンを利用するため、Electron製アプリ等と比較してリソース消費が少なく高速に動作します。
- **📑 マルチタブ管理**: 複数のファイルを同時に開き、タブで切り替えて編集・閲覧が可能です。
- **📊 Excel/TSV 連携 (v1.5.0)**: Excel やスプレッドシートのセルを貼り付けるだけで、Markdown テーブル形式へ自動変換します。
- **🔄 同期スクロール (v1.5.0)**: エディタとプレビューのスクロール位置をリアルタイムに同期。ツールバーで ON/OFF 切り替えが可能です。
- **🎨 マルチテーマ (v1.5.0)**: ダーク / ライト / セピアの3つのカラーテーマを選択可能。設定は永続化されます。
- **🛡️ セキュリティへの配慮**: `DOMPurify` による HTML サニタイズを実装し、Markdown 描画時の XSS 攻撃リスクを低減しています。
- **📊 Mermaid / 数式対応**: フローチャートやシーケンス図（Mermaid）、数式（KaTeX等への拡張性保持）をサポート。
- **🖼️ 画像の高度な扱い**:
  - Obsidian型のウィキリンク (`![[image.png]]`) をサポート。
  - クリップボードからの画像貼り付け（自動保存＆リンク挿入）。
  - ローカルの相対パス画像を安全に表示。
- **📤 エクスポート**: 単体 HTML ファイル出力、および OS 標準の印刷機能を介した PDF 出力に対応。
- **📜 履歴管理**: 最近使ったファイルを即座に開ける履歴メニュー。

## 🛠️ 技術スタック

- **Core**: [Neutralinojs](https://neutralino.js.org/) (WebView2 based)
- **Parser**: [marked.js](https://marked.js.org/)
- **Sanitizer**: [DOMPurify](https://github.com/cure53/dompurify)
- **Syntax Highlight**: [highlight.js](https://highlightjs.org/)
- **Diagrams**: [mermaid.js](https://mermaid-js.github.io/)
- **Styling**: Vanilla CSS (Modern UI)

## 📥 インストール・実行

### リリース版（バイナリ）

1. [Releases](https://github.com/roman-ease/MarkdownViewer/releases) から最新の `MarkdownViewer_vX.X.X.zip` をダウンロードします。
2. 解凍後、`MarkdownViewer.exe` を実行してください。

### 開発用ビルド

1. Node.js がインストールされていることを確認。
2. リポジトリをクローン。
3. 依存関係のインストールと実行:

```bash
npx -y @neutralinojs/neu run
```

## 📝 ライセンス

[MIT License](LICENSE)
