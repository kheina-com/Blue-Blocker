import { RequestRegex, SetBlockFollowing, HandleInstructionsResponse, HandleHomeTimeline } from './shared.js';

// TODO: add other request types for search, replies, etc
document.addEventListener("blue-blocker-event", function (e) {
	// determine if request is a timeline/tweet-returning request
	const urlParse = RequestRegex.exec(e.detail.url);
	if (!urlParse) {
		return;
	}

	// retrieve option
	browser.storage.sync.get({
		// by default, spare the people we follow from getting blocked
		blockFollowing: false,
	}).then(items => {
		SetBlockFollowing(items.blockFollowing);
		const body = JSON.parse(e.detail.body);

		switch (urlParse[1]) {
			case "HomeLatestTimeline":
			case "UserTweets":
				return HandleInstructionsResponse(e, urlParse[1], body);
			case "timeline/home.json":
				return HandleHomeTimeline(e, body);
			default:
				console.error("found an unexpected url that we don't know how to handle:", e.detail.url);
		}
	});
});
