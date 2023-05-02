import { api } from "./constants.js";
import { abbreviate } from "./utilities.js";

api.action.setBadgeBackgroundColor({ color: "#666" });
api.action.setBadgeTextColor({ color: "#fff" });

api.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty("BlockCounter")) {
		// TODO: replace this tabs.query call to something more stable. this doesn't work when twitter is not the focused window
		api.action.setBadgeText({
			text: abbreviate(items.BlockCounter.newValue),
		});
	}
});
