# Quill

Windows 向けの軽量 Markdown エディタ＆ビューア。  
Electron 製でインストーラー形式で配布。分割ビューでリアルタイムプレビューを確認しながら執筆できます。

---

## 特徴

- **リアルタイムプレビュー** — 分割ビューで入力と同時にレンダリング結果を確認
- **複数タブ** — 複数ファイルをタブで管理、セッション復元対応
- **シンタックスハイライト** — highlight.js によるコードブロックの色付け
- **Mermaid 図** — フローチャート・シーケンス図・ER 図などをコードから生成
- **KaTeX 数式** — `$...$` / `$$...$$` 記法で LaTeX 数式をレンダリング（設定で有効化）
- **5 種類のテーマ** — Dark / Light / Sepia / Vaporwave / ネオン
- **検索・置換** — 正規表現対応、無効パターンの即時フィードバック
- **テーブル挿入** — 行・列数を指定してダイアログから挿入
- **目次生成** — 見出しから TOC を自動生成
- **エクスポート** — HTML・PDF への出力
- **ファイル監視** — 外部で編集されたファイルを自動検知して再読み込み
- **フォーカスモード** — ツールバーを隠してライティングに集中
- **ズーム** — ウィンドウ全体の表示倍率を調整

---

## スクリーンショット

> *(Sepia テーマ — 分割ビュー)*

---

## インストール

[Releases](../../releases) ページから最新の `Quill Setup x.x.x.exe` をダウンロードして実行してください。

- インストール先ディレクトリを選択できます
- `.md` / `.markdown` ファイルが自動的に関連付けられます

---

## 開発環境での実行

```bash
# 依存関係のインストール
npm install

# 通常起動
npm start

# 開発モード（DevTools 自動起動）
npm run dev
```

**動作要件:** Node.js 18 以上 / Windows 10 以上

---

## ビルド

```bash
npm run build
```

`dist/Quill Setup x.x.x.exe` にインストーラーが生成されます。

---

## キーボードショートカット

| 操作 | ショートカット |
|------|--------------|
| 新規ファイル | `Ctrl+N` |
| ファイルを開く | `Ctrl+O` |
| 上書き保存 | `Ctrl+S` |
| 名前を付けて保存 | `Ctrl+Shift+S` |
| タブを閉じる | `Ctrl+W` |
| 新規タブ | `Ctrl+T` |
| 次のタブ | `Ctrl+Tab` |
| 前のタブ | `Ctrl+Shift+Tab` |
| 検索 | `Ctrl+F` |
| 検索と置換 | `Ctrl+H` |
| 太字 | `Ctrl+B` |
| 斜体 | `Ctrl+I` |
| リンク挿入 | `Ctrl+K` |
| テーブル挿入 | `Ctrl+Shift+T` |
| 目次を生成 | `Ctrl+Shift+C` |
| フォーカスモード | `Ctrl+Shift+F` |
| ズームイン / アウト | `Ctrl++` / `Ctrl+-` |
| ズームリセット | `Ctrl+0` |
| ショートカット一覧 | `F1` |

---

## 技術スタック

| ライブラリ | 役割 |
|-----------|------|
| [Electron 28](https://www.electronjs.org/) | デスクトップアプリ基盤 |
| [CodeMirror 5](https://codemirror.net/5/) | エディタ |
| [marked v12](https://marked.js.org/) | Markdown パーサー |
| [highlight.js v11](https://highlightjs.org/) | シンタックスハイライト |
| [DOMPurify v3](https://github.com/cure53/DOMPurify) | XSS サニタイズ |
| [Mermaid v11](https://mermaid.js.org/) | ダイアグラム描画 |
| [KaTeX](https://katex.org/) | 数式レンダリング |

---

## ライセンス

MIT
