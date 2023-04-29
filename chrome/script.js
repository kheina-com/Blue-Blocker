import { ClearCache, DefaultOptions, BlockCounter, BlockQueue, SetBlockCounter, SetBlockQueue, SetOptions, HandleInstructionsResponse, HandleHomeTimeline } from '../shared.js';
SetBlockQueue(new BlockQueue(chrome.storage.local));
SetBlockCounter(new BlockCounter(chrome.storage.local));


document.addEventListener("blue-blocker-event", function (e) {
	ClearCache();

	// retrieve option
	chrome.storage.sync.get(DefaultOptions, items => {
		SetOptions(items);
		const body = JSON.parse(e.detail.body);

		switch (e.detail.parsedUrl[1]) {
			case "HomeLatestTimeline":
			case "HomeTimeline":
			case "UserTweets":
			case "TweetDetail":
				return HandleInstructionsResponse(e, body);
			case "timeline/home.json":
				return HandleHomeTimeline(e, body);
			default:
				console.error("found an unexpected url that we don't know how to handle:", e.detail.url);
		}
	});
});
