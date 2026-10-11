import type { KnipConfig } from "knip";

export default {
	wxt: {
		entry: ["src/entrypoints/*/{index,main}.{ts,tsx}"],
	},
	ignoreUnresolved: ["#imports"],
} satisfies KnipConfig;
