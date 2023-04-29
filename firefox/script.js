import { ClearCache, DefaultOptions, BlockCounter, BlockQueue, SetBlockCounter, SetBlockQueue, SetOptions, HandleInstructionsResponse, HandleHomeTimeline } from '../shared.js';
SetBlockQueue(new BlockQueue(browser.storage.local));
SetBlockCounter(new BlockCounter(browser.storage.local));


document.addEventListener("blue-blocker-event", function (e) {
	ClearCache();

	// retrieve option
	browser.storage.sync.get(DefaultOptions).then(items => {
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
