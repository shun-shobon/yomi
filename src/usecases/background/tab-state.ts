import { continuesTranslation } from "@/domain/navigation";
import type { Navigation } from "@/domain/navigation";
import type { StorageItem } from "@/infra/storage/item";
import { offerDismissedTabsItem, translatingTabsItem } from "@/infra/storage/tab-state";

export interface TabPageState {
	offerDismissed: boolean;
	translating: boolean;
}

let queue: Promise<unknown> = Promise.resolve();

/** 読み出してから書き込むまでに別のメッセージの更新が割り込むと、片方の変更が失われる */
function serialize<T>(task: () => Promise<T>): Promise<T> {
	const run = queue.then(task);
	queue = run.catch(() => {});
	return run;
}

async function setIncluded(item: StorageItem<number[]>, tabId: number, included: boolean) {
	const tabs = await item.getValue();
	if (tabs.includes(tabId) === included) return;
	await item.setValue(included ? [...tabs, tabId] : tabs.filter((id) => id !== tabId));
}

export function getTabPageState(tabId: number) {
	return serialize(async (): Promise<TabPageState> => {
		const [dismissed, translating] = await Promise.all([
			offerDismissedTabsItem.getValue(),
			translatingTabsItem.getValue(),
		]);
		return { offerDismissed: dismissed.includes(tabId), translating: translating.includes(tabId) };
	});
}

/** content script が状態を読むより先に届くので、ここで遷移の種類に応じて記録を消しておく */
export function commitNavigation(tabId: number, nav: Navigation) {
	return serialize(async () => {
		if (nav.transitionType === "reload") await setIncluded(offerDismissedTabsItem, tabId, false);
		if (!continuesTranslation(nav)) await setIncluded(translatingTabsItem, tabId, false);
	});
}

export function dismissOffer(tabId: number) {
	return serialize(() => setIncluded(offerDismissedTabsItem, tabId, true));
}

export function setTranslating(tabId: number, translating: boolean) {
	return serialize(() => setIncluded(translatingTabsItem, tabId, translating));
}

export function forgetTab(tabId: number) {
	return serialize(async () => {
		await setIncluded(offerDismissedTabsItem, tabId, false);
		await setIncluded(translatingTabsItem, tabId, false);
	});
}
