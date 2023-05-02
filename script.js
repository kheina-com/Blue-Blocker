import { logstr } from './constants.js';
import { ClearCache } from './shared.js';
import { HandleInstructionsResponse } from './parsers/instructions.js';
import { HandleForYou } from './parsers/timeline.js';
import { HandleAdaptive, HandleTypeahead } from './parsers/search.js';

document.addEventListener("blue-blocker-event", function (e) {
	// TODO: we may want to seriously consider clearing the cache on a much less frequent
	// cadence since we're no longer able to block users immediately and need the queue
	ClearCache();
	const body = JSON.parse(e.detail.body);
	switch (e.detail.parsedUrl[1]) {
		case "HomeLatestTimeline":
		case "HomeTimeline":
		case "UserTweets":
		case "TweetDetail":
			return HandleInstructionsResponse(e, body);
		case "timeline/home.json":
		case "search/adaptive.json":
			return HandleForYou(e, body);
		case "search/typeahead.json":
			return console.log(e, body);
		default:
			console.error(logstr, "found an unexpected url that we don't know how to handle:", e.detail.url);
	}
});
