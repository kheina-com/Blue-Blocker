var s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
s.id = "injected-blue-block-xhr";
s.type = "text/javascript";
// s.onload = function() {
// 	this.remove();
// };
(document.head || document.documentElement).appendChild(s);

// this is the magic regex to determine if its a request we need. add new urls below
export const DefaultOptions = {
	// by default, spare the people we follow from getting blocked
	blockFollowing: false,
	skipVerified: true,
	blockNftAvatars: false,
};

// when parsing a timeline response body, these are the paths to navigate in the json to retrieve the "instructions" object
// the key to this object is the capture group from the request regex in inject.js
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
	TweetDetail: [
		"data",
		"threaded_conversation_with_injections_v2",
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

const ReasonBlueVerified = 0;
const ReasonNftAvatar = 1;

const ReasonMap = {
	[ReasonBlueVerified]: "Twitter Blue verified",
	[ReasonNftAvatar]: "NFT avatar",
};

const BlockCache = new Set();
export function ClearCache() {
	BlockCache.clear();
}

export function BlockUser(user, user_id, headers, reason, attempt=1) {
	if (BlockCache.has(user_id))
	{ return; }
	BlockCache.add(user_id);

	const formdata = new FormData();
	formdata.append("user_id", user_id);

	const ajax = new XMLHttpRequest();

	ajax.addEventListener('load', event => console.log(`blocked ${user.legacy.name} (@${user.legacy.screen_name}) due to ${ReasonMap[reason]}.`), false);
	ajax.addEventListener('error', error => {
		console.error('error:', error);

		if (attempt < 3)
		{ BlockUser(user, user_id, headers, reason, attempt + 1) }
		else
		{ console.error(`failed to block ${user.legacy.name} (@${user.legacy.screen_name}):`, user); }
	}, false);

	ajax.open('POST', "https://twitter.com/i/api/1.1/blocks/create.json");
	for (const header of Headers) {
		ajax.setRequestHeader(header, headers[header]);
	}
	ajax.send(formdata);
}

export function BlockBlueVerified(user, headers) {
	// since we can be fairly certain all user objects will be the same, break this into a separate function

	// don't hammer the API for blocked users
	if(user.legacy.blocking) return;
	if (user.is_blue_verified) {

		if(user.legacy.followers_count > 1000000 || !user.legacy.followers_count) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because Elon is an idiot.`);
			return;
		}		
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
			BlockUser(user, String(user.rest_id), headers, ReasonBlueVerified);
		}
	}
	if (options.blockNftAvatars && user.has_nft_avatar) {
		if (
			// group for block-following option
			!(options.blockFollowing || (!user.legacy.following && !user.super_following))
		) {
			console.log(`did not block user with NFT avatar ${user.legacy.name} (@${user.legacy.screen_name}) because you follow them.`);
		}
		else {
			BlockUser(user, String(user.rest_id), headers, ReasonNftAvatar);
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
		console.error("could not parse tweet", tweet);
		return;
	}

	BlockBlueVerified(user, headers)
}

export function HandleInstructionsResponse(e, body) {
	// pull the "instructions" object from the tweet
	let tweets = body;
	try {
		for (const key of InstructionsPaths[e.detail.parsedUrl[1]]) {
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
			has_nft_avatar: user.ext_has_nft_avatar,
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
