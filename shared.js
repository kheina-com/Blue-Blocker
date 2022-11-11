var s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
s.id = "injected-blue-block-xhr";
s.type = "text/javascript";
// s.onload = function() {
// 	this.remove();
// };
(document.head || document.documentElement).appendChild(s);

// this is the magic regex to determine if its a request we need. add new urls below
export const RequestRegex = /^https?:\/\/(?:\w+\.)?twitter.com\/[\w\/]+\/(HomeLatestTimeline|UserTweets|timeline\/home\.json)(?:$|\?)/;

// when parsing a timeline response body, these are the paths to navigate in the json to retrieve the "instructions" object
// the key to this object is the capture group from the request regex
export const InstructionsPaths = {
	HomeLatestTimeline: [
		"data",
		"home",
		"home_timeline_urt",
		"instructions",
	],
	UserTweets: [
		"data",
		"user",
		"result",
		"timeline_v2",
		"timeline",
		"instructions",
	],
};
// this is the path to retrieve the user object from the individual tweet
export const UserObjectPath = [
	"tweet_results",
	"result",
	"tweet",
	"core",
	"user_results",
	"result",
];
export const IgnoreTweetTypes = new Set([
	"TimelineTimelineCursor",
]);
export const Headers = [
	"authorization",
	"x-csrf-token",
	"x-twitter-active-user",
	"x-twitter-auth-type",
	"x-twitter-client-language",
];

var options = { };
export function SetOptions(items) {
	options = items;
}

export function BlockUser(user, user_id, headers, attempt=1) {
	// TODO: create a cache of recently-blocked users so that we don't try to block the same user multiple times from the same block of tweets
	const url = "https://twitter.com/i/api/1.1/blocks/create.json";

	const formdata = new FormData();
	formdata.append("user_id", user_id);

	const ajax = new XMLHttpRequest();

	ajax.addEventListener('load', (event) => console.log(`blocked ${user.legacy.name} (@${user.legacy.screen_name}) due to Twitter Blue verified.`), false);
	ajax.addEventListener('error', (error) => {
		console.error('error:', error);

		if (attempt < 3)
		{ BlockUser(user_id, headers, attempt + 1) }
		else
		{ console.error(`failed to block ${user.legacy.name} (@${user.legacy.screen_name}):`, user); }
	}, false);

	ajax.open('POST', url);
	for (const header of Headers) {
		ajax.setRequestHeader(header, headers[header]);
	}
	ajax.send(formdata);
}

export function BlockBlueVerified(user, headers) {
	// since we can be fairly certain all user objects will be the same, break this into a separate function
	if (user.is_blue_verified) {
		if (
			// group for block-following option
			!(options.blockFollowing || (!user.legacy.following && !user.super_following))
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because you follow them.`);
		}
		else if (
			// group for skip-verified option
			!(!options.skipVerified || !user.legacy.verified)
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they are verified through other means.`);
		}
		else {
			BlockUser(user, String(user.rest_id), headers);
		}
	}
}

export function ParseTimelineTweet(tweet, headers) {
	let user = tweet;
	for (const key of UserObjectPath) {
		if (user.hasOwnProperty(key))
		{ user = user[key]; }
	}

	if (user.__typename !== "User") {
		console.error("could not parse tweet", tweet, e);
		return;
	}

	BlockBlueVerified(user, headers)
}

export function HandleInstructionsResponse(e, endpoint, body) {
	// pull the "instructions" object from the tweet
	let tweets = body;
	try {
		for (const key of InstructionsPaths[endpoint]) {
			tweets = tweets[key];
		}
	}
	catch (e) {
		console.error("failed to parse response body for instructions object", e, body);
		return;
	}

	// "instructions" should be an array, we need to iterate over it to find the "TimelineAddEntries" type
	for (const value of tweets) {
		if (value.type === "TimelineAddEntries") {
			tweets = value;
			break;
		}
	}

	if (tweets.type !== "TimelineAddEntries") {
		console.error('response object does not contain "TimelineAddEntries"', body);
		return;
	}

	// tweets object should now contain an array of all returned tweets
	for (const tweet of tweets.entries) {
		// parse each tweet for the user object
		switch (tweet?.content?.entryType) {
			case null:
				console.error("tweet structure does not match expectation", tweet);
				break;

			case "TimelineTimelineItem":
				return ParseTimelineTweet(tweet.content.itemContent, e.detail.request.headers);
			
			case "TimelineTimelineModule":
				for (const innerTweet of tweet.content.items) {
					ParseTimelineTweet(innerTweet.item.itemContent, e.detail.request.headers)
				}
				return;

			default:
				if (!IgnoreTweetTypes.has(tweet.content.entryType)) {
					console.error(`unexpected tweet type found: ${tweet.content.entryType}`, tweet);
				}
		}
	}
}

export function HandleHomeTimeline(e, body) {
	// so this url straight up gives us an array of users, so just use that lmao
	for (const [user_id, user] of Object.entries(body.globalObjects.users)) {
		// the user object is a bit different, so reshape it a little
		BlockBlueVerified({
			is_blue_verified: user.ext_is_blue_verified,
			legacy: {
				name: user.name,
				screen_name: user.screen_name,
				following: user?.following,
				verified: user?.verified,
			},
			super_following: user.ext?.superFollowMetadata?.r?.ok?.superFollowing,
			rest_id: user_id,
		}, e.detail.request.headers)
	}
}
