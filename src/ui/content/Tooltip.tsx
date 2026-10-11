import { createSignal, onMount } from "solid-js";

import { currentViewport, placeAbove } from "./position";
import type { PagePosition } from "./position";

export interface TooltipItem {
	anchor: DOMRect;
	label: string;
	text: string;
}

/** 大きさは内容で決まるので、描画してから測って位置を決める */
export function Tooltip(props: TooltipItem) {
	let el: HTMLDivElement | undefined;
	const [position, setPosition] = createSignal<PagePosition | null>(null);
	onMount(() => {
		const { width, height } = el!.getBoundingClientRect();
		setPosition(placeAbove(props.anchor, { width, height }, currentViewport()));
	});
	return (
		<div
			ref={(node) => (el = node)}
			class="tooltip"
			style={{
				left: `${position()?.left ?? 0}px`,
				top: `${position()?.top ?? 0}px`,
				visibility: position() ? undefined : "hidden",
			}}
		>
			<span class="label">{props.label}</span>
			{props.text}
		</div>
	);
}
