import { callBackground } from "@/infra/messaging/background-client";
import { createShortcuts } from "@/ui/hooks/shortcuts";

export function ShortcutHints() {
	const shortcuts = createShortcuts();
	return (
		<footer class="shortcuts small muted">
			<span>
				<kbd>{shortcuts()["translate-page"] ?? "未設定"}</kbd> 翻訳 / 停止
			</span>
			<span>
				<kbd>{shortcuts()["toggle-original"] ?? "未設定"}</kbd> 原文切替
			</span>
			<button class="btn link small" onClick={() => void callBackground("open:shortcuts")}>
				変更
			</button>
		</footer>
	);
}
