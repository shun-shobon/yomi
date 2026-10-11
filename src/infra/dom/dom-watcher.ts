import { blockAncestor, isHidden } from "./segmenter";

const RESCAN_THROTTLE_MS = 400;
const VISIBILITY_ATTRIBUTES = ["class", "style", "hidden", "open", "aria-hidden"];

export interface DomWatcherHandlers {
	isOwn: (node: Node) => boolean;
	onTextChanged: (node: Text) => void;
	rescan: (roots: Element[]) => void;
}

export class DomWatcher {
	private mo: MutationObserver | null = null;
	private rootMo: MutationObserver | null = null;
	private body: HTMLElement | null = null;
	private readonly dirty = new Set<Element>();
	private readonly hidden = new Set<Element>();
	private visibilityChanged = false;
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly handlers: DomWatcherHandlers) {}

	start() {
		this.mo = new MutationObserver((records) => this.onMutations(records));
		this.observeBody(document.body);
		// Turbo などの SPA は遷移のたびに body 要素ごと差し替えるため、外れた body を見続けないよう付け替える。
		// <html> 全体を subtree で監視すると <head> の変化まで拾ってしまう
		this.rootMo = new MutationObserver(() => {
			if (document.body === this.body) return;
			this.mo?.disconnect();
			this.observeBody(document.body);
			this.markDirty(document.body);
		});
		this.rootMo.observe(document.documentElement, { childList: true });
	}

	stop() {
		this.rootMo?.disconnect();
		this.rootMo = null;
		this.mo?.disconnect();
		this.mo = null;
		this.body = null;
		this.dirty.clear();
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
	}

	private observeBody(body: HTMLElement) {
		this.body = body;
		this.mo?.observe(body, {
			childList: true,
			characterData: true,
			subtree: true,
			attributes: true,
			attributeFilter: VISIBILITY_ATTRIBUTES,
		});
	}

	trackHidden(el: Element) {
		this.hidden.add(el);
	}

	forgetHidden() {
		this.hidden.clear();
	}

	markDirty(node: Node) {
		const block = blockAncestor(node);
		if (!block) return;
		this.dirty.add(block);
		this.scheduleRescan();
	}

	private onMutations(records: MutationRecord[]) {
		for (const record of records) {
			switch (record.type) {
				case "attributes":
					if (this.hidden.size > 0) {
						this.visibilityChanged = true;
						this.scheduleRescan();
					}
					break;
				case "characterData":
					if (record.target instanceof Text) this.handlers.onTextChanged(record.target);
					break;
				case "childList":
					for (const node of record.addedNodes) {
						if ((node instanceof Text || node instanceof Element) && !this.handlers.isOwn(node)) {
							this.markDirty(node);
						}
					}
					break;
			}
		}
	}

	private scheduleRescan() {
		// 絶えず DOM が変わるページでも再スキャンが止まらないよう、タイマーは延長しない
		if (this.timer || !this.mo) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.flush();
		}, RESCAN_THROTTLE_MS);
	}

	private flush() {
		if (this.visibilityChanged) {
			this.visibilityChanged = false;
			for (const el of this.hidden) {
				if (!el.isConnected) {
					this.hidden.delete(el);
				} else if (!isHidden(el)) {
					this.hidden.delete(el);
					this.dirty.add(el);
				}
			}
		}
		const roots = [...this.dirty].filter((el) => el.isConnected);
		this.dirty.clear();
		this.handlers.rescan(
			roots.filter((el) => !roots.some((other) => other !== el && other.contains(el))),
		);
	}
}
