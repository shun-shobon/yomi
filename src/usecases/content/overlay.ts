export interface Overlay {
	isOwnTarget(target: EventTarget | null): boolean;
	toast(message: string, opts?: ToastOptions): void;
	showTooltip(anchor: DOMRect, label: string, text: string): void;
	hideTooltip(): void;
	showSelectionButton(anchor: DOMRect, label: string, onClick: () => void): void;
	hideSelectionButton(): void;
	readonly selectionButtonShown: boolean;
	openPanel(anchor: DOMRect, title: string, onClose: () => void): TranslationPanel;
	showOffer(offer: OfferOptions): void;
	hideOffer(): void;
}

export interface OverlayAction {
	label: string;
	onClick: () => void;
}

export interface ToastOptions {
	error?: boolean;
	action?: OverlayAction;
}

/** 操作を選ぶか閉じるまで出し続ける。先頭の操作を主操作として強調する */
export interface OfferOptions {
	message: string;
	actions: OverlayAction[];
	menu: OverlayAction[];
	/** 操作を選ばずに ✕ やカードの外のクリックで閉じたときだけ呼ぶ */
	onDismiss: () => void;
}

export type PanelState =
	| { status: "translating"; text: string }
	| { status: "done"; text: string }
	| { status: "failed"; message: string };

export interface TranslationPanel {
	update(state: PanelState): void;
	remove(): void;
}
