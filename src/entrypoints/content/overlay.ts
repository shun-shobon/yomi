const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.layer {
  position: absolute; top: 0; left: 0; width: 0; height: 0;
  font: 14px/1.6 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  color: var(--fg);
  --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --border: #d0d7de;
  --accent: #4f46e5; --accent-fg: #ffffff; --danger: #cf222e; --ok: #1a7f37;
  --shadow: 0 8px 24px rgba(31, 35, 40, .18), 0 1px 3px rgba(31, 35, 40, .12);
}
@media (prefers-color-scheme: dark) {
  .layer {
    --bg: #1f2430; --fg: #e6edf3; --muted: #9198a1; --border: #3d4450;
    --accent: #818cf8; --accent-fg: #11131a; --danger: #ff7b72; --ok: #3fb950;
    --shadow: 0 8px 24px rgba(0, 0, 0, .5), 0 1px 3px rgba(0, 0, 0, .4);
  }
}
button { font: inherit; color: inherit; cursor: pointer; }

.toasts {
  position: fixed; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px;
  align-items: flex-end; pointer-events: none;
}
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 12px; max-width: min(420px, calc(100vw - 32px));
  padding: 10px 12px 10px 14px; border-radius: 10px; background: var(--bg); border: 1px solid var(--border);
  box-shadow: var(--shadow); animation: rise .18s ease-out;
}
.toast.error { border-left: 4px solid var(--danger); }
.toast .msg { flex: 1; }
.toast .action {
  border: 0; border-radius: 6px; padding: 4px 10px; background: var(--accent); color: var(--accent-fg); font-weight: 600;
  white-space: nowrap;
}
.icon-btn {
  border: 0; background: transparent; color: var(--muted); padding: 2px 6px; border-radius: 6px; line-height: 1;
}
.icon-btn:hover { background: color-mix(in srgb, var(--fg) 8%, transparent); }

.tooltip {
  position: absolute; width: max-content; max-width: min(480px, calc(100vw - 16px)); padding: 8px 12px; border-radius: 8px;
  background: #1e293b; color: #f1f5f9; box-shadow: var(--shadow); font-size: 13px; line-height: 1.55;
  pointer-events: none; animation: fade .12s ease-out; white-space: pre-wrap; overflow-wrap: anywhere;
}
.tooltip .label { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 2px; }

.sel-btn {
  position: absolute; width: 30px; height: 30px; border-radius: 50%; border: 1px solid var(--border);
  background: var(--bg); color: var(--accent); box-shadow: var(--shadow);
  display: grid; place-items: center; padding: 0; animation: fade .15s ease-out; transition: transform .12s;
}
.sel-btn:hover { transform: scale(1.1); }
.sel-btn svg { width: 17px; height: 17px; }

.panel {
  position: absolute; width: min(440px, calc(100vw - 24px)); border-radius: 12px; background: var(--bg);
  border: 1px solid var(--border); box-shadow: var(--shadow); animation: fade .15s ease-out; overflow: hidden;
}
.panel header {
  display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--border);
  color: var(--muted); font-size: 12px;
}
.panel header .title { flex: 1; font-weight: 600; }
.panel .body {
  padding: 12px 14px; max-height: 50vh; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; min-height: 44px;
}
.panel .body.error { color: var(--danger); }
.panel footer { display: flex; gap: 8px; align-items: center; padding: 6px 8px 8px 14px; color: var(--muted); font-size: 12px; }
.panel footer .spacer { flex: 1; }
.panel footer button { border: 1px solid var(--border); background: transparent; border-radius: 6px; padding: 3px 10px; }
.panel footer button:hover { background: color-mix(in srgb, var(--fg) 6%, transparent); }
.panel footer button.copied { color: var(--ok); border-color: var(--ok); }
.panel footer a { color: inherit; }
.cursor::after {
  content: ""; display: inline-block; width: .5em; height: 1em; margin-left: 2px; vertical-align: -0.15em;
  background: var(--accent); animation: blink 1s steps(2) infinite;
}
.dots { display: inline-flex; gap: 4px; }
.dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: blink 1s infinite; }
.dots i:nth-child(2) { animation-delay: .15s; } .dots i:nth-child(3) { animation-delay: .3s; }

@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes blink { 50% { opacity: .25; } }
`;

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
    style.textContent = CSS;
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
