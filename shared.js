var s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
s.id = "injected-blue-block-xhr";
s.type = "text/javascript";
// s.onload = function() {
// 	this.remove();
// };
(document.head || document.documentElement).appendChild(s);

export const DefaultOptions = {
	// by default, spare as many people as possible
	// let the user decide if they want to be stricter
	blockFollowing: false,
	blockFollowers: false,
	skipVerified: true,
	skipAffiliated: true,
	skip1Mplus: true,
	skipSWs: true,
	blockNftAvatars: false
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
	HomeTimeline: [
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
export const SexWorkerStrings = [
	"onlyfans",
	"OF",
	"spicy site",
	"linktr",
	"NSFW",
	"nsfw",
	"\u{1f3f3}\u{fe0f}\u{200d}\u{26a7}\u{fe0f}", // trans flag
	"nudes",
	"18+",
	"\u{1f51e}", // no one under 18 symbol
];
export function IncludesAny(haystack, needles) {
	for (var needle of needles) {
		if (haystack.includes(needle)) {
			return true;
		}
	}
	return false;
}

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

const BlockQueue = [];
const BlockCache = new Set();
let BlockInterval = undefined;

export function ClearCache() {
	BlockCache.clear();
}

function QueueBlockUser(user, user_id, headers, reason) {
	if (BlockCache.has(user_id)) {
		return;
	}
	BlockCache.add(user_id);
	BlockQueue.push({user, user_id, headers, reason});
	console.log(`queued ${user.legacy.name} (@${user.legacy.screen_name}) for a block due to ${ReasonMap[reason]}.`);
	
	if (BlockInterval === undefined) {
		BlockInterval = setInterval(CheckBlockQueue, 5000);
	}
}

function CheckBlockQueue() {
	if (BlockQueue.length === 0) {
		clearInterval(BlockInterval);
		BlockInterval = undefined;
		return;
	}
	const {user, user_id, headers, reason} = BlockQueue.shift();
	BlockUser(user, user_id, headers, reason);
}

function BlockUser(user, user_id, headers, reason, attempt=1) {
	const formdata = new FormData();
	formdata.append("user_id", user_id);

	const ajax = new XMLHttpRequest();

	ajax.addEventListener('load', event => console.log(`blocked ${user.legacy.name} (@${user.legacy.screen_name}) due to ${ReasonMap[reason]}.`), false);
	ajax.addEventListener('error', error => {
		console.error('error:', error);

		if (attempt < 3) {
			BlockUser(user, user_id, headers, reason, attempt + 1);
		} else {
			console.error(`failed to block ${user.legacy.name} (@${user.legacy.screen_name}):`, user);
		}
	}, false);

	ajax.open('POST', "https://twitter.com/i/api/1.1/blocks/create.json");
	for (const header of Headers) {
		ajax.setRequestHeader(header, headers[header]);
	}
	ajax.send(formdata);
}

export function BlockBlueVerified(user, headers) {
	// since we can be fairly certain all user objects will be the same, break this into a separate function
	if (user.legacy.blocking) {
		return;
	}
	if (user.is_blue_verified) {	
		if (
			// group for block-following option
			!options.blockFollowing && (user.legacy.following || user.super_following)
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because you follow them.`);
		}
		else if (
			// group for block-followers option
			!options.blockFollowers && user.legacy.followed_by
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they follow you.`);
		}
		else if (
			// group for skip-verified option
			options.skipVerified && (user.legacy.verified || user.legacy.verified_type)
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they are verified through other means.`);
		}
		else if (
			// verified via an affiliated organisation instead of blue
			options.skipAffiliated && user.affiliates_highlighted_label.label
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they are verified through an affiliated organisation.`);
		}
		else if (
			// verified by follower count
			options.skip1Mplus && (user.legacy.followers_count > 1000000 || !user.legacy.followers_count)
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they have over a million followers and Elon is an idiot.`);
		}
		else if (
			// check for sex worker
			options.skipSWs && IncludesAny(user.legacy.description, SexWorkerStrings)
		) {
			console.log(`did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they appear to be a sex worker <3`);
		}
		else {
			QueueBlockUser(user, String(user.rest_id), headers, ReasonBlueVerified);
		}
	}
	if (options.blockNftAvatars && user.has_nft_avatar) {
		if (
			// group for block-following option
			!options.blockFollowing && (user.legacy.following || user.super_following)
		) {
			console.log(`did not block user with NFT avatar ${user.legacy.name} (@${user.legacy.screen_name}) because you follow them.`);
		}
		else if (
			// group for block-followers option
			!options.blockFollowers && user.legacy.followed_by
		) {
			console.log(`did not block user with NFT avatar ${user.legacy.name} (@${user.legacy.screen_name}) because they follow you.`);
		}
		else {
			QueueBlockUser(user, String(user.rest_id), headers, ReasonNftAvatar);
		}
	}
}

function HandleTweetObject(obj, headers) {
	let ptr = obj;
	for (const key of UserObjectPath) {
		if (ptr.hasOwnProperty(key)) {
			ptr = ptr[key];
		}
	}
	if (ptr.__typename !== "User") {
		console.error("could not parse tweet", obj);
		return;
	}
	BlockBlueVerified(ptr, headers);
}

export function ParseTimelineTweet(tweet, headers) {
	if(tweet.itemType=="TimelineTimelineCursor") {
		return;
	}
	
	// Handle retweets and quoted tweets (check the retweeted user, too)
	if(tweet?.tweet_results?.result?.quoted_status_result) {
		HandleTweetObject(tweet.tweet_results.result.quoted_status_result.result, headers);
	} else if(tweet?.tweet_results?.result?.legacy?.retweeted_status_result) {
		HandleTweetObject(tweet.tweet_results.result.legacy.retweeted_status_result.result, headers);
	}
	HandleTweetObject(tweet, headers);
}

export function HandleInstructionsResponse(e, body) {
	// pull the "instructions" object from the tweet
	let instructions = body;
	
	try {
		for (const key of InstructionsPaths[e.detail.parsedUrl[1]]) {
			instructions = instructions[key];
		}
	}
	catch (e) {
		console.error("failed to parse response body for instructions object", e, body);
		return;
	}

	// "instructions" should be an array, we need to iterate over it to find the "TimelineAddEntries" type
	let tweets = undefined;
	let isAddToModule = false;
	for (const value of instructions) {
		if (value.type === "TimelineAddEntries" || value.type === "TimelineAddToModule") {
			tweets = value;
			isAddToModule = value.type === "TimelineAddToModule";
			break;
		}
	}
	if (tweets === undefined) {
		console.error("response object does not contain an instruction to add entries", body);
		return;
	}

	if (isAddToModule) {
		// wrap AddToModule info so the handler can treat it the same (and unwrap it below)
		tweets.entries = [{
			content: {
				entryType: "TimelineTimelineModule",
				items: tweets.moduleItems
			}
		}];
	}

	// tweets object should now contain an array of all returned tweets
	for (const tweet of tweets.entries) {
		// parse each tweet for the user object
		switch (tweet?.content?.entryType) {
			case null:
				console.error("tweet structure does not match expectation", tweet);
				break;

			case "TimelineTimelineItem":
				if (tweet.content.itemContent.itemType=="TimelineTweet") {
					ParseTimelineTweet(tweet.content.itemContent, e.detail.request.headers);
				}
				break;
			case "TimelineTimelineModule":
				for (const innerTweet of tweet.content.items) {
					ParseTimelineTweet(innerTweet.item.itemContent, e.detail.request.headers)
				}
				break;

			default:
				if (!IgnoreTweetTypes.has(tweet.content.entryType)) {
					console.error(`unexpected tweet type found: ${tweet.content.entryType}`, tweet);
				}
		}
	}

	if (isAddToModule) {
		tweets.moduleItems = tweets.entries[0]?.content?.items || [];
		delete tweets.entries;
	}
}

export function HandleHomeTimeline(e, body) {
	// This API endpoint currently does not deliver information required for
	// block filters (in particular, it's missing affiliates_highlighted_label).
	// So if the user has set the "skip users verified by other means" options,
	// this function must be skipped, however, it is still mostly covered by the
	// instructions responses
	if (options.skipAffiliated) return;

	// so this url straight up gives us an array of users, so just use that lmao
	for (const [user_id, user] of Object.entries(body.globalObjects.users)) {
		// the user object is a bit different, so reshape it a little
		BlockBlueVerified({
			is_blue_verified: user.ext_is_blue_verified,
			has_nft_avatar: user.ext_has_nft_avatar,
			legacy: {
				blocking: user.blocking,
				followed_by: user.followed_by,
				following: user.following,
				name: user.name,
				screen_name: user.screen_name,
				verified: user.verified,
				verified_type: user.ext_verified_type,
			},
			super_following: user.ext?.superFollowMetadata?.r?.ok?.superFollowing,
			rest_id: user_id,
		}, e.detail.request.headers)
	}
}
