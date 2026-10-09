import overlayCss from "./overlay.css?inline";

const TOAST_DURATION_MS = 3500;

export interface PagePosition {
  left: number;
  top: number;
}

/** ページの CSS から隔離した UI レイヤー。要素はページ座標で配置する */
export class Overlay {
  private readonly layer = document.createElement("div");
  private readonly toasts = document.createElement("div");
  private host: HTMLElement | null = null;
  private tooltip: HTMLDivElement | null = null;

  constructor() {
    this.layer.className = "layer";
    this.toasts.className = "toasts";
    this.layer.append(this.toasts);
  }

  /** closed shadow DOM 内のイベントはホスト要素に retarget される */
  isHost(target: EventTarget | null): boolean {
    return target !== null && target === this.host;
  }

  place(el: HTMLElement, position: PagePosition) {
    this.mount();
    el.style.left = `${position.left}px`;
    el.style.top = `${position.top}px`;
    this.layer.append(el);
  }

  /** エラーや操作ボタン付きのトーストはユーザーが閉じるまで残す */
  toast(
    message: string,
    opts: { error?: boolean; action?: { label: string; onClick: () => void } } = {},
  ) {
    this.mount();
    const el = document.createElement("div");
    el.className = opts.error ? "toast error" : "toast";
    const msg = document.createElement("span");
    msg.className = "msg";
    msg.textContent = message;
    el.append(msg);
    if (opts.action) {
      const { label, onClick } = opts.action;
      el.append(
        button("action", label, () => {
          onClick();
          el.remove();
        }),
      );
    }
    const close = button("icon-btn", "✕", () => el.remove());
    close.setAttribute("aria-label", "閉じる");
    el.append(close);
    this.toasts.append(el);
    if (!opts.error && !opts.action) setTimeout(() => el.remove(), TOAST_DURATION_MS);
  }

  showTooltip(anchor: DOMRect, label: string, text: string) {
    this.hideTooltip();
    const tip = document.createElement("div");
    tip.className = "tooltip";
    const labelEl = document.createElement("span");
    labelEl.className = "label";
    labelEl.textContent = label;
    tip.append(labelEl, text);
    tip.style.visibility = "hidden";
    this.place(tip, { left: 0, top: 0 });
    const { height, width } = tip.getBoundingClientRect();
    const gap = 6;
    const top = anchor.top - height - gap >= 0 ? anchor.top - height - gap : anchor.bottom + gap;
    const left = Math.max(
      8,
      Math.min(anchor.left, document.documentElement.clientWidth - width - 8),
    );
    tip.style.top = `${top + scrollY}px`;
    tip.style.left = `${left + scrollX}px`;
    tip.style.visibility = "";
    this.tooltip = tip;
  }

  hideTooltip() {
    this.tooltip?.remove();
    this.tooltip = null;
  }

  private mount() {
    if (this.host?.isConnected) return;
    this.host = document.createElement("yomi-ui");
    this.host.setAttribute("data-gt-ui", "");
    this.host.style.cssText =
      "position:absolute!important;top:0!important;left:0!important;width:0!important;height:0!important;z-index:2147483647!important;";
    const shadow = this.host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = overlayCss;
    shadow.append(style, this.layer);
    document.documentElement.append(this.host);
  }
}

function button(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = className;
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}
