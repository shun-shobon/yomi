import { offerDismissedTabsItem } from "@/infra/storage/offer";

export async function isOfferDismissed(tabId: number): Promise<boolean> {
	return (await offerDismissedTabsItem.getValue()).includes(tabId);
}

export async function dismissOffer(tabId: number): Promise<void> {
	const tabs = await offerDismissedTabsItem.getValue();
	if (!tabs.includes(tabId)) await offerDismissedTabsItem.setValue([...tabs, tabId]);
}

export async function forgetOfferDismissal(tabId: number): Promise<void> {
	const tabs = await offerDismissedTabsItem.getValue();
	if (tabs.includes(tabId))
		await offerDismissedTabsItem.setValue(tabs.filter((id) => id !== tabId));
}
