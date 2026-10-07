import { isLanguageCode, LANGUAGE_CODES, LANGUAGES } from "@/utils/languages";
import type { Settings } from "@/utils/settings";

type DisplaySwitch = "showSelectionButton" | "hoverOriginal" | "highlightPending";

const SWITCH_LABELS: Record<DisplaySwitch, string> = {
  showSelectionButton: "テキスト選択時に翻訳ボタンを表示",
  hoverOriginal: "翻訳後のテキストにホバーで原文を表示",
  highlightPending: "翻訳中のテキストをハイライト",
};

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  switches: DisplaySwitch[];
}

/** 翻訳先の言語と、指定した表示設定のスイッチ */
export function TranslationSettingsFields({ settings, update, switches }: Props) {
  return (
    <>
      <label class="field">
        <span>翻訳先の言語</span>
        <select
          value={settings.targetLang}
          onChange={(e) => {
            const { value } = e.currentTarget;
            if (isLanguageCode(value)) update({ targetLang: value });
          }}
        >
          {LANGUAGE_CODES.map((code) => (
            <option value={code}>{LANGUAGES[code].label}</option>
          ))}
        </select>
      </label>
      {switches.map((key) => (
        <label class="switch">
          <span>{SWITCH_LABELS[key]}</span>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => update({ [key]: e.currentTarget.checked })}
          />
        </label>
      ))}
    </>
  );
}
