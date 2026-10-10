import { blockAncestor, isHidden } from "./segmenter";

const PREFETCH_MARGIN = "800px 0px";
const RESCAN_THROTTLE_MS = 400;
const VISIBILITY_ATTRIBUTES = ["class", "style", "hidden", "open", "aria-hidden"];

export interface DomWatcherHandlers {
  isOwn: (node: Node) => boolean;
  onEnterView: (el: Element) => void;
  onTextChanged: (node: Text) => void;
  rescan: (roots: Element[]) => void;
}

export class DomWatcher {
  private io: IntersectionObserver | null = null;
  private mo: MutationObserver | null = null;
  private readonly visible = new Set<Element>();
  private readonly dirty = new Set<Element>();
  private readonly hidden = new Set<Element>();
  private visibilityChanged = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly handlers: DomWatcherHandlers) {}

  start(observed: Iterable<Element>) {
    this.io = new IntersectionObserver((entries) => this.onIntersect(entries), {
      rootMargin: PREFETCH_MARGIN,
    });
    this.mo = new MutationObserver((records) => this.onMutations(records));
    this.mo.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: VISIBILITY_ATTRIBUTES,
    });
    for (const el of observed) this.io.observe(el);
  }

  stop() {
    this.io?.disconnect();
    this.mo?.disconnect();
    this.io = this.mo = null;
    this.visible.clear();
    this.dirty.clear();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  observe(el: Element) {
    this.io?.observe(el);
  }

  unobserve(el: Element) {
    this.io?.unobserve(el);
    this.visible.delete(el);
  }

  isVisible(el: Element): boolean {
    return this.visible.has(el);
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

  private onIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        this.visible.add(entry.target);
        this.handlers.onEnterView(entry.target);
      } else {
        this.visible.delete(entry.target);
      }
    }
  }

  private onMutations(records: MutationRecord[]) {
    for (const record of records) {
      switch (record.type) {
        case "attributes":
          if (this.hidden.size) {
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
