import { browser } from "#imports";

const MANAGE_USAGE_URL = "https://chatgpt.com/settings/usage";
const SHORTCUTS_URL = "chrome://extensions/shortcuts";

export function openOptionsPage(): Promise<void> {
	return browser.runtime.openOptionsPage();
}

export async function openUsagePage(): Promise<void> {
	await browser.tabs.create({ url: MANAGE_USAGE_URL });
}

export async function openShortcutsPage(): Promise<void> {
	await browser.tabs.create({ url: SHORTCUTS_URL });
}

export async function activeTabId(): Promise<number | undefined> {
	const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
	return tab?.id;
}
