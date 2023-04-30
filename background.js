

let BlockTotal = 0;

if (chrome) {
	chrome.action.setBadgeText({text: ""});
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (message.type === 'USER_BLOCKED_MESSAGE') {
			BlockTotal++;
			chrome.action.setBadgeText({text: BlockTotal.toString()});
		}
	});
}