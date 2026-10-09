export interface PagePosition {
  left: number;
  top: number;
}

export interface Viewport {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

const EDGE = 8;

export function currentViewport(): Viewport {
  return {
    width: document.documentElement.clientWidth,
    height: innerHeight,
    scrollX,
    scrollY,
  };
}

/** anchor の直下に置く。下に収まらなければ上に反転する。anchor はビューポート座標 */
export function placeBelow(
  anchor: DOMRect,
  size: { width: number; height: number },
  viewport: Viewport,
): PagePosition {
  const gap = 8;
  const top =
    anchor.bottom + gap + size.height <= viewport.height
      ? anchor.bottom + gap
      : Math.max(EDGE, anchor.top - gap - size.height);
  const left = Math.max(
    EDGE,
    Math.min(anchor.right - size.width / 2, viewport.width - size.width - EDGE),
  );
  return { left: left + viewport.scrollX, top: top + viewport.scrollY };
}

/** anchor の直上に置く。上に収まらなければ下に反転する。anchor はビューポート座標 */
export function placeAbove(
  anchor: DOMRect,
  size: { width: number; height: number },
  viewport: Viewport,
): PagePosition {
  const gap = 6;
  const top =
    anchor.top - size.height - gap >= 0 ? anchor.top - size.height - gap : anchor.bottom + gap;
  const left = Math.max(EDGE, Math.min(anchor.left, viewport.width - size.width - EDGE));
  return { left: left + viewport.scrollX, top: top + viewport.scrollY };
}
