import { api } from './constants.js';
import { ClearCache, ErrorEvent, EventKey } from './shared.js';
import { HandleInstructionsResponse } from './parsers/instructions.js';
import { HandleForYou } from './parsers/timeline.js';
import { HandleTypeahead } from './parsers/search.js';

let s = document.createElement("script");
s.src = api.runtime.getURL("./injected/inject.js");
s.id = "injected-blue-block-xhr";
s.type = "text/javascript";
(document.head || document.documentElement).appendChild(s);

let l = document.createElement("link");
l.href = api.runtime.getURL("./injected/toasts.css");
l.rel = "stylesheet";
(document.head || document.documentElement).appendChild(l);

let t = document.createElement("div");
t.id = "injected-blue-block-toasts";
document.body.appendChild(t);

document.addEventListener("blue-blocker-event", function (e) {
	// TODO: we may want to seriously consider clearing the cache on a much less frequent
	// cadence since we're no longer able to block users immediately and need the queue
	ClearCache();
	let body = null;
	try {
		body = JSON.parse(e.detail.body);
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
				return HandleTypeahead(e, body);
			default:
				api.storage.local.set({ [EventKey]: { type: ErrorEvent, message: "found an unexpected url that we don't know how to handle", detail: e } });
		}
	}
	catch (error) {
		api.storage.local.set({ [EventKey]: { type: ErrorEvent, message: "exepected error occurred while parsing request body", detail: { error, body, event: e } } });
	}
});
