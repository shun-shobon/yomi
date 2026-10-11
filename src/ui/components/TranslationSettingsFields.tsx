import { For } from "solid-js";

import { isLanguageCode, LANGUAGE_CODES, LANGUAGES } from "@/domain/languages";
import type { Settings } from "@/domain/settings";

type DisplaySwitch =
	| "offerTranslation"
	| "showSelectionButton"
	| "hoverOriginal"
	| "highlightPending";

const SWITCH_LABELS: Record<DisplaySwitch, string> = {
	offerTranslation: "翻訳先と違う言語のページで翻訳を提案",
	showSelectionButton: "テキスト選択時に翻訳ボタンを表示",
	hoverOriginal: "翻訳後のテキストにホバーで原文を表示",
	highlightPending: "翻訳中のテキストをハイライト",
};

interface Props {
	settings: Settings;
	update: (patch: Partial<Settings>) => void;
	switches: DisplaySwitch[];
}

export function TranslationSettingsFields(props: Props) {
	return (
		<>
			<label class="field">
				<span>翻訳先の言語</span>
				<select
					value={props.settings.targetLang}
					onChange={(e) => {
						const { value } = e.currentTarget;
						if (isLanguageCode(value)) props.update({ targetLang: value });
					}}
				>
					<For each={LANGUAGE_CODES}>
						{(code) => <option value={code}>{LANGUAGES[code].label}</option>}
					</For>
				</select>
			</label>
			<For each={props.switches}>
				{(key) => (
					<label class="switch">
						<span>{SWITCH_LABELS[key]}</span>
						<input
							type="checkbox"
							checked={props.settings[key]}
							onChange={(e) => props.update({ [key]: e.currentTarget.checked })}
						/>
					</label>
				)}
			</For>
		</>
	);
}
