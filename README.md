# Markdown Viewer

[![Neutralinojs](https://img.shields.io/badge/Framework-Neutralinojs-blue.svg)](https://neutralino.js.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.5.5-green.svg)](CHANGELOG.md)

Windows向けの軽量・高速なMarkdownビューア兼エディタです。
[Neutralinojs](https://neutralino.js.org/)を採用し、システム標準のWebView2を利用することで、配布サイズを非常にコンパクト（約2.3MB）に抑えています。

## ✨ 主な機能

- **🚀 軽量・高速起動**: OS標準のエンジンを利用するため、Electron製アプリと比較してリソース消費が少なく高速です。
- **📑 マルチタブ管理**: 複数のファイルを同時に開き、タブで切り替えて編集・閲覧が可能です。
- **📊 Excel/TSV 連携 (v1.5.0)**: Excel やスプレッドシートのセルを貼り付けるだけで、Markdown テーブルへ自動変換します。
- **🔄 同期スクロール (v1.5.0)**: エディタとプレビューのスクロール位置をリアルタイムに同期。ツールバーで ON/OFF 切り替えが可能です。
- **🎨 マルチテーマ (v1.5.0)**: ダーク / ライト / セピアの3つのカラーテーマを選択可能。設定は永続化されます。
- **🛡️ セキュリティへの配慮**: `DOMPurify` による HTML サニタイズを実装し、XSS 攻撃リスクを低減しています。
- **📊 Mermaid / 数式対応**: フローチャートやシーケンス図（Mermaid）、シンタックスハイライトをサポート。
- **🖼️ 画像の高度な扱い**: Obsidian型のウィキリンク、クリップボードからの画像貼り付け、ローカル相対パス表示に対応。

## 📥 導入・実行方法

### リリース版（バイナリ）
1. [Releases](https://github.com/roman-ease/MarkdownViewer/releases) から最新の `MarkdownViewer_vX.X.X.zip` をダウンロード。
2. 解凍後、フォルダ内の `MarkdownViewer.exe` を実行してください。
   ※ 初回起動時に警告が出る場合は「詳細情報」→「実行」を選択してください。

### .md ファイルをダブルクリックで開く設定
1. 任意の `.md` ファイルを右クリック > 「プログラムから開く」 > 「別のプログラムを選択」。
2. 「PCで別のアプリを探す」から本ソフトの `MarkdownViewer.exe` を指定。
3. 「常にこのアプリを使って .md ファイルを開く」にチェックを入れて完了です。

## 🛠️ 技術スタック
- **Core**: [Neutralinojs](https://neutralino.js.org/) (WebView2 based)
- **Parser**: [marked.js](https://marked.js.org/), [DOMPurify](https://github.com/cure53/dompurify)
- **Libraries**: [highlight.js](https://highlightjs.org/), [mermaid.js](https://mermaid-js.github.io/)
- **Styling**: Vanilla CSS (Modern UI)

## 📜 更新履歴（ダイジェスト）
- **v1.5.2** : ツールメニューおよびテーマ反映の安定性を向上。
- **v1.5.0** : 大型アップデート。Excel 貼り付け変換、同期スクロール、カラーテーマを正式実装。
- **v1.4.0** : UI刷新。タブシステムを導入し、複数ファイルの並行作業に対応。
- **v1.3.0** : エクスポート機能（HTML/PDF）および履歴機能を追加。
- **v1.2.0** : 目次(TOC)生成および Mermaid 描画に対応。
- **v1.1.0** : 複数インスタンス起動に対応。
- **v1.0.0** : 初版リリース。

## 📝 ライセンス
[MIT License](LICENSE)
