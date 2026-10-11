import { createSignal, For, Show } from "solid-js";

import type { OfferOptions } from "@/usecases/content/overlay";

export function OfferCard(props: OfferOptions & { onDismiss: () => void }) {
	const [menuOpen, setMenuOpen] = createSignal(false);
	const run = (onClick: () => void) => {
		onClick();
		props.onDismiss();
	};

	return (
		<div class="offer" role="dialog" aria-label="翻訳の提案">
			<p class="msg">{props.message}</p>
			<div class="actions">
				<For each={props.actions}>
					{(action, i) => (
						<button classList={{ primary: i() === 0 }} onClick={() => run(action.onClick)}>
							{action.label}
						</button>
					)}
				</For>
				<span class="spacer" />
				<div
					class="menu-area"
					on:focusout={(e) => {
						const next = e.relatedTarget;
						if (!(next instanceof Node && e.currentTarget.contains(next))) setMenuOpen(false);
					}}
				>
					<button
						class="icon-btn"
						aria-label="その他の操作"
						aria-expanded={menuOpen()}
						onClick={() => setMenuOpen((open) => !open)}
					>
						⋯
					</button>
					<Show when={menuOpen()}>
						<div class="menu" role="menu">
							<For each={props.menu}>
								{(item) => (
									<button role="menuitem" onClick={() => run(item.onClick)}>
										{item.label}
									</button>
								)}
							</For>
						</div>
					</Show>
				</div>
				<button class="icon-btn" aria-label="閉じる" onClick={() => props.onDismiss()}>
					✕
				</button>
			</div>
		</div>
	);
}
