import { logstr } from "../constants.js";
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
	SearchTimeline: [
		"data",
		"search_by_raw_query",
		"search_timeline",
		"timeline",
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

function handleTweetObject(obj, config) {
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
	BlockBlueVerified(ptr, config);
}

export function ParseTimelineTweet(tweet, config) {
	if(tweet.itemType=="TimelineTimelineCursor") {
		return;
	}
	
	// Handle retweets and quoted tweets (check the retweeted user, too)
	if(tweet?.tweet_results?.result?.quoted_status_result) {
		handleTweetObject(tweet.tweet_results.result.quoted_status_result.result, config);
	} else if(tweet?.tweet_results?.result?.legacy?.retweeted_status_result) {
		handleTweetObject(tweet.tweet_results.result.legacy.retweeted_status_result.result, config);
	}
	handleTweetObject(tweet, config);
}

export function HandleInstructionsResponse(e, body, config) {
	// pull the "instructions" object from the tweet
	let instructions = body;

	for (const key of InstructionsPaths[e.detail.parsedUrl[1]]) {
		instructions = instructions[key];
	}

	console.debug(logstr, "parsed instructions path:", instructions);

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
					ParseTimelineTweet(tweet.content.itemContent, config);
				}
				break;

			case "TimelineTimelineModule":
				for (const innerTweet of tweet.content.items) {
					ParseTimelineTweet(innerTweet.item.itemContent, config)
				}
				break;

			default:
				if (!IgnoreTweetTypes.has(tweet.content.entryType)) {
					throw {
						message: `unexpected tweet type found: ${tweet?.content?.entryType}`,
						name: "TweetType",
						tweet,
					};
				}
		}
	}
}
