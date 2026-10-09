import type { PagePosition } from "./position";

export const SELECTION_BUTTON_SIZE = 30;

export interface SelectionButtonItem {
  position: PagePosition;
  label: string;
  onClick: () => void;
}

export function SelectionButton(props: SelectionButtonItem) {
  return (
    <button
      class="sel-btn"
      title={props.label}
      aria-label={props.label}
      style={{ left: `${props.position.left}px`, top: `${props.position.top}px` }}
      // 選択範囲を解除させない
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => props.onClick()}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m5 8 6 6" />
        <path d="m4 14 6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="m22 22-5-10-5 10" />
        <path d="M14 18h6" />
      </svg>
    </button>
  );
}
