import { api, logstr, DefaultOptions, ErrorEvent, EventKey } from "../constants";
import { HandleInstructionsResponse } from "./instructions";
import { HandleForYou } from "./timeline";
import { HandleTypeahead } from "./search";
import { HandleUnblock } from "./unblock";
import { edit, SetHeaders } from "../utilities";

const RequestRegex = edit(
	/^https?:\/\/(?:\w+\.)?twitter.com\/[\w\/\.\-\_\=]+\/({queries})(?:$|\?)/, { queries: [
		/HomeLatestTimeline/,
		/HomeTimeline/,
		/SearchTimeline/,
		/UserTweets/,
		/timeline\/home\.json/,
		/TweetDetail/,
		/search\/typeahead\.json/,
		/search\/adaptive\.json/,
		/blocks\/destroy\.json/,
		/mutes\/users\/destroy\.json/,
	].map((r: RegExp) => r.source).join("|"),
});

export function HandleTwitterApiResponse(response: TwitterApiResponse) {
	if (response.status < 300) {
		SetHeaders(response.request.headers);
	} else {
		// we got an error response, we don't really care to parse it.
		return;
	}

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		try {
			if (!response?.text && !response?.json) {
				throw new Error("could not parse response. expected one of: {text, json}");
			}
			const json = response?.json ?? JSON.parse(response?.text ?? "");
			const parsedUrl = response?.parsedUrl ?? RequestRegex.exec(String(response.request.url));

			if (!parsedUrl) {
				return;
			}

			const e: BlueBlockerEvent = {
				request: response.request,
				status: response.status,
				url: response.url,
				ok: response.ok,
				parsedUrl,
				json,
			};

			if (json?.error || json?.errors) {
				// another error response, this time returned as a 200!
				console.debug(logstr, "skipped", e.parsedUrl[1], "response because it contained an error key:", response);
				return;
			}

			switch (parsedUrl[1]) {
				case "blocks/destroy.json":
				case "mutes/users/destroy.json":
					return HandleUnblock(e, config);
				case "HomeLatestTimeline":
				case "HomeTimeline":
				case "SearchTimeline":
				case "UserTweets":
				case "TweetDetail":
					return HandleInstructionsResponse(e, config);
				case "timeline/home.json":
				case "search/adaptive.json":
					return HandleForYou(e, config);
				case "search/typeahead.json":
					return HandleTypeahead(e, config);
				default:
					console.error(logstr, "found an unexpected url that we don't know how to handle", response);
					api.storage.local.set({
						[EventKey]: {
							type: ErrorEvent,
						},
					});
			}
		} catch (error) {
			console.error(logstr, "unexpected error occurred while parsing request body", { error, response });
			api.storage.local.set({
				[EventKey]: {
					type: ErrorEvent,
				},
			});
		}
	});
}
