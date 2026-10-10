export interface TextSelection {
  text: string;
  rect: DOMRect;
}

export function currentSelection(): TextSelection | null {
  const sel = getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const anchor = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
  // 入力欄内の選択は編集操作の邪魔になるので対象外
  if (anchor?.closest("input, textarea, [contenteditable=''], [contenteditable=true]")) return null;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  return { text, rect: rects.item(rects.length - 1) ?? range.getBoundingClientRect() };
}
