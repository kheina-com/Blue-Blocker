// we can't import things from shared, so re-initialize the api
const api = chrome || browser;

export function abbreviate(value) {
	if (value >= 1000000000)
	{ return `${Math.round(value / 100000000) / 10}B`; }
	if (value >= 1000000)
	{ return `${Math.round(value / 100000) / 10}M`; }
	if (value >= 1000)
	{ return `${Math.round(value / 100) / 10}K`; }
	return `${value}`;
}

api.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty('BlockCounter')) {
		// TODO: replace this tabs.query call to something more stable. this doesn't work when twitter is not the focused window
		api.tabs.query({active: true, currentWindow: true}).then(tabs => {
			if (tabs.length === 0) {
				return;
			}
			const tab = tabs[0];
			api.action.setBadgeText({
				tabId: tab.id,
				text: abbreviate(items.BlockCounter.newValue),
			});
		});
	}
});
