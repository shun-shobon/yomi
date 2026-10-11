import solid from "vite-plugin-solid";
import { defineConfig } from "wxt";

export default defineConfig({
	srcDir: "src",
	vite: () => ({ plugins: [solid()] }),
	manifest: {
		name: "Yomi",
		description: "ChatGPT サブスクリプションで Web ページ全体や選択テキストを翻訳します。",
		minimum_chrome_version: "140",
		permissions: ["storage", "contextMenus"],
		host_permissions: [
			"https://auth.openai.com/*",
			"https://api.openai.com/*",
			// 認可コードを受け取る loopback リダイレクトの URL を tabs.onUpdated で読むために必要
			"http://127.0.0.1/*",
		],
		commands: {
			"translate-page": {
				suggested_key: { default: "Alt+T" },
				description: "ページを翻訳 / 停止（テキスト選択中は選択範囲を翻訳）",
			},
			"toggle-original": {
				suggested_key: { default: "Alt+O" },
				description: "原文と訳文を切り替え",
			},
		},
	},
});
