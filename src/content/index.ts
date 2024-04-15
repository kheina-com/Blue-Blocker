import { SetHeaders } from "../shared";
import { api, logstr, DefaultOptions, ErrorEvent, EventKey } from "../constants";
import { HandleInstructionsResponse } from "../parsers/instructions";
import { HandleForYou } from "../parsers/timeline";
import { HandleTypeahead } from "../parsers/search";
import { HandleUnblock } from "../parsers/unblock";
import "./startup.ts";

document.addEventListener("blue-blocker-event", function (e: CustomEvent<BlueBlockerEvent>) {
	if (e.detail.status < 300) {
		SetHeaders(e.detail.request.headers);
	} else {
		// we got an error response, we don't really care to parse it.
		return;
	}

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		const body_str = e.detail.body;
		try {
			const parsed_body = JSON.parse(body_str);
			if (parsed_body?.error || parsed_body?.errors) {
				// another error response, this time returned as a 200!
				console.debug(logstr, "skipped", e.detail.parsedUrl[1], "response because it contained an error key:", { event: e, body_str });
				return;
			}

			switch (e.detail.parsedUrl[1]) {
				case "blocks/destroy.json":
				case "mutes/users/destroy.json":
					return HandleUnblock(e, parsed_body, config);
				case "HomeLatestTimeline":
				case "HomeTimeline":
				case "SearchTimeline":
				case "UserTweets":
				case "TweetDetail":
				case "Following":
				case "Followers":
				case "UserCreatorSubscriptions":
					return HandleInstructionsResponse(e, parsed_body, config);
				case "timeline/home.json":
				case "search/adaptive.json":
					return HandleForYou(e, parsed_body, config);
				case "search/typeahead.json":
					return HandleTypeahead(e, parsed_body, config);
				default:
					console.error(logstr, "found an unexpected url that we don't know how to handle", e);
					api.storage.local.set({
						[EventKey]: {
							type: ErrorEvent,
						},
					});
			}
		} catch (error) {
			console.error(logstr, "unexpected error occurred while parsing request body", { error, body_str, event: e });
			api.storage.local.set({
				[EventKey]: {
					type: ErrorEvent,
				},
			});
		}
	});
});

// Add support for OldTwitter requests.
window.addEventListener('message', function (ev) {
	if (ev.data.type !== 'OLDTWITTER_REQUEST_LOAD') return;
	if (!ev.data.url || !ev.data.body || !ev.data.headers)
		return console.error(logstr, 'OldTwitter sent an invalid payload.', ev.data);

	const body_str = JSON.stringify(ev.data.body);

	document.dispatchEvent(
		new CustomEvent('blue-blocker-event', {
			detail: {
				parsedUrl: /(.+)/.exec(ev.data.url)!, // Have to turn the endpoint string into a regex result...
				url: ev.data.url,
				body: body_str as XMLHttpRequest['response'],
				request: {
					headers: ev.data.headers,
				},
				// OldTwitter only emits messages on success.
				status: 200,
			},
		}),
	);
});
