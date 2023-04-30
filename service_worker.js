// we can't import things from shared, so re-initialize the api
let _api = null;
try {
	_api = browser;
	// manifest v2 has the action api stored in browserAction, so manually assign it to action
	_api.action = browser.browserAction;
}
catch (ReferenceError) {
	_api = chrome;
}
const api = _api;

function abbreviate(value) {
	if (value >= 1000000000)
	{ return `${Math.round(value / 100000000) / 10}B`; }
	if (value >= 1000000)
	{ return `${Math.round(value / 100000) / 10}M`; }
	if (value >= 1000)
	{ return `${Math.round(value / 100) / 10}K`; }
	return `${value}`;
}

api.action.setBadgeBackgroundColor({ color: "#666" });
api.action.setBadgeTextColor({ color: "#fff" });

api.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty('BlockCounter')) {
		// TODO: replace this tabs.query call to something more stable. this doesn't work when twitter is not the focused window
		api.action.setBadgeText({
			text: abbreviate(items.BlockCounter.newValue),
		});
	}
});
