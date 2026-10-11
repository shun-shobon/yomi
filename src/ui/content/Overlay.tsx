import { createSignal, Show } from "solid-js";
import { delegateEvents, render } from "solid-js/web";

import type { OfferOptions, Overlay, PanelState, ToastOptions } from "@/usecases/content/overlay";

import { OfferCard } from "./OfferCard";
import { currentViewport, placeBelow } from "./position";
import { SELECTION_BUTTON_SIZE, SelectionButton } from "./SelectionButton";
import type { SelectionButtonItem } from "./SelectionButton";
import { Toasts } from "./Toasts";
import type { ToastItem } from "./Toasts";
import { Tooltip } from "./Tooltip";
import type { TooltipItem } from "./Tooltip";
import { PANEL_ESTIMATED_HEIGHT, PANEL_MAX_WIDTH, TranslationPanel } from "./TranslationPanel";
import type { PanelItem } from "./TranslationPanel";

import overlayCss from "./overlay.css?inline";

const TOAST_DURATION_MS = 3500;
const PANEL_SIDE_MARGIN = 24;

export function createOverlay(): Overlay {
	const [toasts, setToasts] = createSignal<ToastItem[]>([]);
	const [tooltip, setTooltip] = createSignal<TooltipItem | null>(null);
	const [button, setButton] = createSignal<SelectionButtonItem | null>(null);
	const [panel, setPanel] = createSignal<PanelItem | null>(null);
	const [offer, setOffer] = createSignal<OfferOptions | null>(null);
	let nextId = 0;

	const dismissToast = (id: number) => setToasts((items) => items.filter((t) => t.id !== id));

	const hideOffer = () => {
		setOffer(null);
		document.removeEventListener("pointerdown", dismissOfferOutside, true);
	};
	// shadow DOM 内のクリックは host に付け替わって届くので、host 以外ならカードの外
	const dismissOfferOutside = (e: PointerEvent) => {
		if (e.target !== host) hideOffer();
	};

	let host: HTMLElement | null = null;
	const mount = () => {
		if (host == null) {
			host = document.createElement("yomi-ui");
			host.dataset["gtUi"] = "";
			host.style.cssText =
				"position:absolute!important;top:0!important;left:0!important;width:0!important;height:0!important;z-index:2147483647!important;";
			const shadow = host.attachShadow({ mode: "closed" });
			const style = document.createElement("style");
			style.textContent = overlayCss;
			const layer = document.createElement("div");
			layer.className = "layer";
			shadow.append(style, layer);
			// Solid は onClick などを document で委譲して受けるが、closed shadow DOM 内のノードは document 側の composedPath に現れず届かない
			// oxlint-disable-next-line typescript/no-unsafe-type-assertion
			delegateEvents(["click", "mousedown"], shadow as unknown as Document);
			render(
				() => (
					<>
						{/* z-index を使わず、後に書いたものほど上に重ねる */}
						<Toasts items={toasts()} onDismiss={dismissToast} />
						<Show when={offer()}>{(item) => <OfferCard {...item()} onDismiss={hideOffer} />}</Show>
						<Show when={panel()}>{(item) => <TranslationPanel {...item()} />}</Show>
						{/* 選び直すたびに作り直し、出現アニメーションを再生する */}
						<Show when={button()} keyed>
							{(item) => <SelectionButton {...item} />}
						</Show>
						<Show when={tooltip()} keyed>
							{(item) => <Tooltip {...item} />}
						</Show>
					</>
				),
				layer,
			);
		} else if (host.isConnected) {
			return;
		}
		// ページが documentElement の子を差し替えても、描画済みの UI ごと付け直す
		document.documentElement.append(host);
	};

	return {
		isOwnTarget: (target) => target != null && target === host,

		toast(message: string, opts: ToastOptions = {}) {
			mount();
			const id = nextId++;
			setToasts((items) => [...items, { id, message, ...opts }]);
			if ((opts.error == null || !opts.error) && opts.action == null)
				setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
		},

		showTooltip(anchor, label, text) {
			mount();
			setTooltip({ anchor, label, text });
		},
		hideTooltip: () => setTooltip(null),

		showSelectionButton(anchor, label, onClick) {
			mount();
			const size = { width: SELECTION_BUTTON_SIZE, height: SELECTION_BUTTON_SIZE };
			setButton({ position: placeBelow(anchor, size, currentViewport()), label, onClick });
		},
		hideSelectionButton: () => setButton(null),
		get selectionButtonShown() {
			return button() != null;
		},

		showOffer(item) {
			mount();
			setOffer(item);
			document.addEventListener("pointerdown", dismissOfferOutside, true);
		},
		hideOffer,

		openPanel(anchor, title, onClose) {
			mount();
			const id = nextId++;
			const viewport = currentViewport();
			const size = {
				// CSS 側の幅 min(440px, 100vw - 24px) と揃えるため、スクロールバーを含む innerWidth を使う
				width: Math.min(PANEL_MAX_WIDTH, innerWidth - PANEL_SIDE_MARGIN),
				height: PANEL_ESTIMATED_HEIGHT,
			};
			const initial: PanelState = { status: "translating", text: "" };
			setPanel({
				id,
				position: placeBelow(anchor, size, viewport),
				title,
				state: initial,
				onClose,
			});
			const isCurrent = () => panel()?.id === id;
			return {
				update(state) {
					if (isCurrent()) setPanel((p) => p && { ...p, state });
				},
				remove() {
					if (isCurrent()) setPanel(null);
				},
			};
		},
	};
}
