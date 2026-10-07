# Yomi

ChatGPT プラン（[Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source)）で Web ページを翻訳する Chrome 拡張。

## 機能

- **ページ全体の翻訳**: 原文を訳文に置き換える。ビューポート付近から優先して翻訳し、スクロールや DOM の変化に追従する。リンク・太字などのインライン要素は保ち、`code` / `pre` / `.notranslate` は訳さない。
- **原文表示**: 訳文にホバーすると原文をツールチップで表示する。ページ全体の原文 / 訳文も切り替えられる。
- **選択テキストの翻訳**: 選択すると出るボタン、右クリックメニュー、ショートカットで翻訳し、結果をストリーミング表示する。
- ショートカット: `Alt+T` 翻訳 / 停止（選択中は選択範囲を翻訳）、`Alt+O` 原文 / 訳文の切り替え

## 開発

Node.js と pnpm のバージョンは `mise.toml` で固定している。

```sh
mise install
pnpm install
pnpm dev        # 拡張を読み込んだ Chrome が起動する
pnpm build      # .output/chrome-mv3 に出力
pnpm typecheck
pnpm lint       # oxlint（type-aware）
pnpm format     # oxfmt。CI 向けの検査は pnpm format:check
```

### E2E テスト

OpenAI API を service worker 内でモックし、ビルド済み拡張を Chromium で動かして翻訳パイプラインを検証する。Chrome 137 以降の正式版は `--load-extension` を無視するので、Chrome for Testing を使う。

```sh
pnpm build
CHROMIUM_PATH="<Chrome for Testing の実行ファイル>" pnpm test:e2e [スクリーンショットの出力先]
```
