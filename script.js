import { api, ClearCache, DefaultOptions, SetOptions, HandleInstructionsResponse, HandleHomeTimeline } from './shared.js';

document.addEventListener("blue-blocker-event", function (e) {
	ClearCache();

	// retrieve option
	api.storage.sync.get(DefaultOptions, items => {
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
