export function abbreviate(value) {
	if (value >= 1000000000)
	{ return `${Math.round(value / 100000000) / 10}B`; }
	if (value >= 1000000)
	{ return `${Math.round(value / 100000) / 10}M`; }
	if (value >= 1000)
	{ return `${Math.round(value / 100) / 10}K`; }
	return `${value}`;
}

chrome.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty('BlockCounter')) {
		// TODO: replace this tabs.query call to something more stable. this doesn't work when twitter is not the focused window
		chrome.tabs.query({active: true, currentWindow: true}).then(tabs => {
			if (tabs.length === 0) {
				return;
			}
			const tab = tabs[0];
			chrome.action.setBadgeText({
				tabId: tab.id,
				text: abbreviate(items.BlockCounter.newValue),
			});
		});
	}
});
