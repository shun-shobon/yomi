# AGENTS.md

WXT + Solid + TypeScript の Chrome 拡張。機能・コマンド・ディレクトリ構成は README を参照する。

## 言語

- UI 文言、コードコメント、README、コミットメッセージは日本語で書く。英語の UI 文言を残さない。
- 翻訳プロンプト（`src/domain/prompts.ts`）はモデル向けなので英語のままでよい。

## 設計

- `src/` のレイヤーと依存方向は README の「ディレクトリ構成」に従う。新しいコードはその表で置き場所を決める。違反は `pnpm lint` が検出する。
- ビジネスロジックは `domain/` と `usecases/` に置く。`ui/` のコンポーネントは表示と入力に専念し、`entrypoints/` はリスナー登録と配線だけにする。
- UI は Solid で書く。他の UI ライブラリを持ち込まない。
- content script がページ上に出す UI は、closed Shadow DOM を持つ `Overlay`（`src/ui/content/Overlay.tsx`）の中に描画する。ページの DOM に UI を直接置かない。
- CSS はソースに直書きせず `.css` ファイルに分ける。Shadow DOM やページに `<style>` で差し込むものは `?inline` で文字列として import する。インラインスタイルは座標などの動的な値と、ページ側 CSS に負けないための `!important` 指定に限る。

## 型と境界の検証

- `as` による型キャストと、暗黙の `any` を使わない。型が合わないときは型定義や処理を見直す。どうしても必要なキャストには理由をコメントで残す（例: `Overlay.tsx` の `delegateEvents`）。テストのモックは例外。
- 外から入ってくる値（拡張内メッセージ、`storage`、IndexedDB、外部 API の応答）は valibot で検証する。型はスキーマから `v.InferOutput` で導出し、境界をまたぐスキーマは `domain/` に置く。
- storage の項目は `defineValidatedItem`（`src/infra/storage/item.ts`）で定義する。
- background との通信は `src/infra/messaging/protocol.ts` の `BACKGROUND_API` にエンドポイントを足して使う。`browser.runtime.sendMessage` などを個別に直接呼ばない。

## コメント

- コードだけでは読み取れない「なぜそうしないのか（Why not）」だけを書く。処理の説明、言い換え、経緯は書かない。JSDoc も同じ基準で扱う。

## テスト

- ユニットテストは対象ファイルと同じ場所に `*.test.ts` で置く（`pnpm test`）。
- E2E は `e2e/` に置き、Vitest の `e2e` プロジェクトで動かす（`pnpm build` の後に `pnpm test:e2e`）。Vitest の設定は `vitest.config.ts` の `test.projects` に集約し、設定ファイルを増やさない。非同期の結果は固定時間待たず `expect.poll` で待つ。
- バグを直すときは、修正前に失敗するテストを先に足す。
- 変更後は `pnpm format`、`pnpm lint`、`pnpm typecheck`、`pnpm test` を通す。翻訳の流れやページ上の UI に触れた場合は E2E も実行する。

## UI デザイン

- ダークモード専用。ライトモードは作らない。
- 配色は `src/ui/base.css` の CSS 変数を使う。Tailwind などの既定パレットを流用しない。背景は落ち着いた色、アクセントは彩度と明度を抑える。
- グロー（背景のグローを含む）、不要な角丸、目立つ枠線、見出しの下のリード文を入れない。

## GitHub Actions

- `uses:` はタグで書き、SHA は `.github/workflows/actions.lock` で固定する。`uses:` を変えたら `gh-actions-lock`（mise で入る）を実行してロックファイルを更新する。

## コミット

- ユーザーに頼まれたときだけコミットする。
- メッセージは Conventional Commits の `type: 日本語の件名` 形式で書く（例: `fix: white-space で改行を保つ要素では訳文でも改行を残す`）。
