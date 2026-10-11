import type { Overlay } from "./overlay";
import type { PageTranslator } from "./page-translator";

const HOVER_DELAY_MS = 300;

export function watchHoverOriginal(
	overlay: Overlay,
	page: PageTranslator,
	isEnabled: () => boolean,
) {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let anchor: Element | null = null;

	const hide = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		anchor = null;
		overlay.hideTooltip();
	};

	document.addEventListener("mouseover", (e) => {
		if (!isEnabled() || !(e.target instanceof Element)) return;
		const hit = page.originalTextAt(e.target);
		if (hit?.anchor === anchor) return;
		hide();
		if (!hit) return;
		anchor = hit.anchor;
		timer = setTimeout(() => {
			overlay.showTooltip(hit.anchor.getBoundingClientRect(), "原文", hit.text);
		}, HOVER_DELAY_MS);
	});
	document.addEventListener("scroll", hide, { passive: true, capture: true });
}
