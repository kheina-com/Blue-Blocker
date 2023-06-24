import { ClearCache, SetHeaders } from '../shared';
import { api, logstr, DefaultOptions, ErrorEvent, EventKey } from '../constants';
import { HandleInstructionsResponse } from '../parsers/instructions';
import { HandleForYou } from '../parsers/timeline';
import { HandleTypeahead } from '../parsers/search';

// https://github.com/crxjs/chrome-extension-tools/issues/576#issuecomment-1312838225
// TODO: see if we can remove this ignore
// @ts-ignore
import inject from '/src/injected/inject?script&module';
const script = document.createElement('script');
script.src = chrome.runtime.getURL(inject);
script.id = 'injected-blue-block-xhr';
script.type = 'text/javascript';
document.head.prepend(script);

let l = document.createElement('link');
l.href = api.runtime.getURL('src/injected/toasts.css'); // MUST BE ABSOLUTE PATH
l.rel = 'stylesheet';
(document.head || document.documentElement).appendChild(l);

let t = document.createElement('div');
t.id = 'injected-blue-block-toasts';
document.body.appendChild(t);

document.addEventListener('blue-blocker-event', function (e: CustomEvent<BlueBlockerEvent>) {
	// TODO: we may want to seriously consider clearing the cache on a much less frequent
	// cadence since we're no longer able to block users immediately and need the queue

	// TODO: probably also check status code here so that we're not parsing error responses
	// for no reason

	if (e.detail.status < 300) {
		SetHeaders(e.detail.request.headers);
	} else {
		// we got an error response, we don't really care to parse it.
		return;
	}

	ClearCache();
	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		const body_str = e.detail.body;
		try {
			const parsed_body = JSON.parse(body_str);
			switch (e.detail.parsedUrl[1]) {
				case 'HomeLatestTimeline':
				case 'HomeTimeline':
				case "SearchTimeline":
				case 'UserTweets':
				case 'TweetDetail':
					return HandleInstructionsResponse(e, parsed_body, config);
				case 'timeline/home.json':
				case 'search/adaptive.json':
					return HandleForYou(e, parsed_body, config);
				case 'search/typeahead.json':
					return HandleTypeahead(e, parsed_body, config);
				default:
					console.error(logstr, "found an unexpected url that we don't know how to handle");
					api.storage.local.set({
						[EventKey]: {
							type: ErrorEvent,
							message: "found an unexpected url that we don't know how to handle",
							detail: e,
						},
					});
			}
		} catch (error) {
			api.storage.local.set({
				[EventKey]: {
					type: ErrorEvent,
					message: "unexpected error occurred while parsing request body",
					detail: { error, body_str, event: e },
				},
			});
		}
	});
});
