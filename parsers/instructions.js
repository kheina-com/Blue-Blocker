import { BlockBlueVerified } from "../shared.js";
// This file contains a bit of a special case for responses. many responses
// on twitter contain a shared type stored in an "instructions" key within
// the response body. since it doesn't match one specific request, it has
// its own file

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
	"search/adaptive.json": [
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

function handleTweetObject(obj, headers) {
	let ptr = obj;
	for (const key of UserObjectPath) {
		if (ptr.hasOwnProperty(key)) {
			ptr = ptr[key];
		}
	}
	if (ptr.__typename !== "User") {
		console.error(logstr, "could not parse tweet", obj);
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
		handleTweetObject(tweet.tweet_results.result.quoted_status_result.result, headers);
	} else if(tweet?.tweet_results?.result?.legacy?.retweeted_status_result) {
		handleTweetObject(tweet.tweet_results.result.legacy.retweeted_status_result.result, headers);
	}
	handleTweetObject(tweet, headers);
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
		console.error(logstr, "failed to parse response body for instructions object", e, body);
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
		console.error(logstr, "response object does not contain an instruction to add entries", body);
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
				console.error(logstr, "tweet structure does not match expectation", tweet);
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
					console.error(logstr, `unexpected tweet type found: ${tweet.content.entryType}`, tweet);
				}
		}
	}

	if (isAddToModule) {
		tweets.moduleItems = tweets.entries[0]?.content?.items || [];
		delete tweets.entries;
	}
}
