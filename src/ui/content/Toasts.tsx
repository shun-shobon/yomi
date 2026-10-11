import { For, Show } from "solid-js";

import type { ToastOptions } from "@/usecases/content/overlay";

export interface ToastItem extends ToastOptions {
	id: number;
	message: string;
}

export function Toasts(props: { items: ToastItem[]; onDismiss: (id: number) => void }) {
	return (
		<div class="toasts">
			<For each={props.items}>
				{(toast) => (
					<div class="toast" classList={{ error: toast.error }}>
						<span class="msg">{toast.message}</span>
						<Show when={toast.action}>
							{(action) => (
								<button
									class="action"
									onClick={() => {
										action().onClick();
										props.onDismiss(toast.id);
									}}
								>
									{action().label}
								</button>
							)}
						</Show>
						<button class="icon-btn" aria-label="閉じる" onClick={() => props.onDismiss(toast.id)}>
							✕
						</button>
					</div>
				)}
			</For>
		</div>
	);
}
