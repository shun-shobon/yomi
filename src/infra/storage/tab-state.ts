import * as v from "valibot";

import { defineValidatedItem } from "./item";

// タブ ID はブラウザを再起動すると振り直されるので、session storage に置く

export const offerDismissedTabsItem = defineValidatedItem(
	"session:offerDismissedTabs",
	v.array(v.number()),
	[],
);

export const translatingTabsItem = defineValidatedItem(
	"session:translatingTabs",
	v.array(v.number()),
	[],
);
