import { callBackground } from "@/infra/messaging/background-client";
import { createShortcuts } from "@/ui/hooks/shortcuts";

export function UsageSection() {
	const shortcuts = createShortcuts();
	// Solid の JSX は実 DOM ノードなので、同じ要素を 2 か所に置くと後から置いた方へ移動してしまう
	const translateKey = () => <kbd>{shortcuts()["translate-page"] ?? "未設定"}</kbd>;
	return (
		<section class="section">
			<h2>使い方とショートカット</h2>
			<table class="usage">
				<tbody>
					<tr>
						<th>ページ全体を翻訳</th>
						<td>
							ツールバーのポップアップ、右クリック「このページを翻訳」、または {translateKey()}
						</td>
					</tr>
					<tr>
						<th>選択テキストを翻訳</th>
						<td>
							選択すると出るボタン、右クリック「選択テキストを翻訳」、または選択中に{" "}
							{translateKey()}
						</td>
					</tr>
					<tr>
						<th>原文 / 訳文の切り替え</th>
						<td>
							ポップアップのボタン、または <kbd>{shortcuts()["toggle-original"] ?? "未設定"}</kbd>
						</td>
					</tr>
				</tbody>
			</table>
			<button class="btn" onClick={() => void callBackground("open:shortcuts")}>
				ショートカットを変更
			</button>
		</section>
	);
}
