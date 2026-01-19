import { api, logstr, EventKey, ErrorEvent } from '../constants';
import { BlockBlueVerified } from '../shared';
import { getScreenName, getUserName, isFollowing } from '../utilities';
// This file contains a bit of a special case for responses. many responses
// on twitter contain a shared type stored in an "instructions" key within
// the response body. since it doesn't match one specific request, it has
// its own file

// when parsing a timeline response body, these are the paths to navigate in the json to retrieve the "instructions" object
// the key to this object is the capture group from the request regex in inject.js
const InstructionsPaths: { [key: string]: string[][] } = {
	HomeLatestTimeline: [['data', 'home', 'home_timeline_urt', 'instructions']],
	HomeTimeline: [['data', 'home', 'home_timeline_urt', 'instructions']],
	SearchTimeline: [
		['data', 'search_by_raw_query', 'search_timeline', 'timeline', 'instructions'],
	],
	Favoriters: [['data', 'favoriters_timeline', 'timeline', 'instructions']],
	Retweeters: [['data', 'retweeters_timeline', 'timeline', 'instructions']],
	UserTweets: [
		['data', 'user', 'result', 'timeline_v2', 'timeline', 'instructions'],
		['data', 'user', 'result', 'timeline', 'timeline', 'instructions'],
	],
	Followers: [['data', 'user', 'result', 'timeline', 'timeline', 'instructions']],
	Following: [['data', 'user', 'result', 'timeline', 'timeline', 'instructions']],
	UserCreatorSubscriptions: [['data', 'user', 'result', 'timeline', 'timeline', 'instructions']],
	FollowersYouKnow: [['data', 'user', 'result', 'timeline', 'timeline', 'instructions']],
	BlueVerifiedFollowers: [['data', 'user', 'result', 'timeline', 'timeline', 'instructions']],
	TweetDetail: [['data', 'threaded_conversation_with_injections_v2', 'instructions']],
	ModeratedTimeline: [
		['data', 'tweet', 'result', 'timeline_response', 'timeline', 'instructions'],
	],
	'search/adaptive.json': [['timeline', 'instructions']],
};
// this is the path to retrieve the user object from the individual tweet
const UserObjectPath: string[] = [
	'tweet_results',
	'result',
	'tweet',
	'core',
	'user_results',
	'result',
];
const IgnoreTweetTypes = new Set(['TimelineTimelineCursor', 'TimelineUser']);
const PromotedStrings = new Set(['suggest_promoted', 'Promoted', 'promoted']);

function handleUserObject(obj: any, config: CompiledConfig, from_blue: boolean) {
	let userObj = obj.user_results?.result;
	if (!userObj) {
		console.log(logstr, 'empty user result');
		return;
	}

	if (userObj.__typename === 'UserUnavailable') {
		console.log(logstr, 'user is unavailable', userObj);
		return;
	}

	if (userObj.__typename !== 'User') {
		console.error(logstr, 'could not parse user object', userObj);
		return;
	}

	if (from_blue) {
		obj.user_results.result.is_blue_verified = true;
	}

	BlockBlueVerified(obj.user_results.result, config);
}

export function ParseTimelineUser(obj: any, config: CompiledConfig, from_blue: boolean) {
	handleUserObject(obj, config, from_blue);
}

function handleTweetObject(obj: any, config: CompiledConfig, promoted: boolean) {
	let ptr = obj,
		uses_blue_feats = false;
	for (const key of UserObjectPath) {
		if (ptr.__typename == 'TweetTombstone') {
			// If we hit a deleted tweet, we bail
			return;
		}
		if (ptr.hasOwnProperty(key)) {
			ptr = ptr[key];
			if (
				ptr.__typename == 'Tweet' &&
				(ptr?.note_tweet?.is_expandable == true ||
					typeof ptr?.edit_control?.edit_tweet_ids?.initial_tweet_id == 'string')
			) {
				uses_blue_feats = true;
			}
		}
	}
	if (ptr.__typename !== 'User') {
		console.error(logstr, 'could not parse tweet', obj);
		return;
	}
	ptr.promoted_tweet = promoted;
	ptr.is_blue_verified = ptr.is_blue_verified || uses_blue_feats;
	ptr.used_blue = uses_blue_feats;
	BlockBlueVerified(ptr as BlueBlockerUser, config);
}

export function ParseTimelineTweet(tweet: any, config: CompiledConfig) {
	if (IgnoreTweetTypes.has(tweet.itemContent.itemType)) {
		return;
	}

	let promoted: boolean = false;
	if (tweet?.itemContent?.promotedMetadata !== undefined) {
		promoted = true;
	} else if (PromotedStrings.has(tweet?.clientEventInfo?.component)) {
		promoted = true;
	} else if (
		PromotedStrings.has(tweet?.clientEventInfo?.details?.timelinesDetails?.injectionType)
	) {
		promoted = true;
	}

	try {
		const userResult =
			tweet?.itemContent?.tweet_results?.result?.core?.user_results?.result ||
			tweet?.itemContent?.tweet_results?.result?.tweet?.core?.user_results?.result;
		const following = isFollowing(userResult);
		if (
			config.skipFollowingQrts &&
			following &&
			(tweet?.itemContent?.tweet_results?.result?.legacy?.is_quote_status ||
				tweet?.tweet_results?.result?.legacy?.retweeted_status_result)
		) {
			const skippedUser =
				tweet?.itemContent?.tweet_results?.result?.legacy?.retweeted_status_result?.result
					?.core?.user_results?.result ||
				tweet?.itemContent?.tweet_results?.result?.quoted_status_result?.result?.core
					?.user_results?.result;
			const username = getUserName(skippedUser);
			const screenName = getScreenName(skippedUser);
			console.log(
				logstr,
				`skipping ${username} (@${screenName}) because they got retweeted by someone you follow`,
			);
		}
		// Handle retweets and quoted tweets (check the retweeted user, too)
		else if (tweet?.itemContent?.tweet_results?.result?.quoted_status_result?.result) {
			handleTweetObject(
				tweet.itemContent.tweet_results.result.quoted_status_result.result,
				config,
				promoted,
			);
		} else if (
			tweet?.itemContent?.tweet_results?.result?.legacy?.retweeted_status_result?.result
		) {
			handleTweetObject(
				tweet.itemContent.tweet_results.result.legacy.retweeted_status_result.result,
				config,
				promoted,
			);
		}
		handleTweetObject(tweet.itemContent, config, promoted);
	} catch (e) {
		console.error(logstr, 'found unexpected tweet shape:', JSON.stringify(tweet), e);
		api.storage.local.set({
			[EventKey]: {
				type: ErrorEvent,
			},
		});
	}
}

export function HandleInstructionsResponse(
	e: CustomEvent<BlueBlockerEvent>,
	body: Body,
	config: CompiledConfig,
) {
	// pull the "instructions" object from the tweet
	let _instructions = body;
	let isFailed = false;
	for (const keys of InstructionsPaths[e.detail.parsedUrl[1]]) {
		try {
			for (const key of keys) {
				// @ts-ignore
				_instructions = _instructions[key];
			}
			isFailed = false;
			break;
		} catch (err) {
			// if we can't find the instructions, we just continue
			_instructions = body;
			isFailed = true;
		}
	}
	if (isFailed) {
		throw new Error(
			`failed to find instructions in response body for ${e.detail.parsedUrl[1]}`,
		);
	}

	// TODO: figure out how to do this cleanly
	// @ts-ignore
	const instructions: Instruction[] = _instructions;

	console.debug(logstr, 'parsed instructions path:', instructions);

	// "instructions" should be an array, we need to iterate over it to find the "TimelineAddEntries" type
	let tweets = undefined;
	let isAddToModule = false;
	for (const value of instructions) {
		if (value.type === 'TimelineAddEntries' || value.type === 'TimelineAddToModule') {
			tweets = value;
			isAddToModule = value.type === 'TimelineAddToModule';
			break;
		}
	}
	if (tweets === undefined) {
		console.error(
			logstr,
			'response object does not contain an instruction to add entries',
			body,
		);
		return;
	}

	tweets.entries = tweets.entries || [];
	if (isAddToModule) {
		// wrap AddToModule info so the handler can treat it the same (and unwrap it below)
		tweets.entries = [
			{
				content: {
					entryType: 'TimelineTimelineModule',
					items: tweets.moduleItems,
				},
			},
		];
	}

	// tweets object should now contain an array of all returned tweets
	for (const tweet of tweets.entries) {
		// parse each tweet for the user object
		switch (tweet?.content?.entryType) {
			case null:
				console.error(logstr, 'tweet structure does not match expectation', tweet);
				break;

			case 'TimelineTimelineItem':
				if (tweet.content.itemContent?.itemType == 'TimelineTweet') {
					ParseTimelineTweet(tweet.content, config);
				} else if (tweet.content.itemContent?.itemType == 'TimelineUser') {
					const from_blue = e.detail.parsedUrl[1] == 'BlueVerifiedFollowers';
					ParseTimelineUser(tweet.content.itemContent, config, from_blue);
				}
				break;

			case 'TimelineTimelineModule':
				for (const innerTweet of tweet.content.items || []) {
					ParseTimelineTweet(innerTweet.item, config);
				}
				break;

			default:
				if (!IgnoreTweetTypes.has(tweet.content.entryType)) {
					throw {
						message: `unexpected tweet type found: ${tweet?.content?.entryType}`,
						name: 'TweetType',
						tweet,
					};
				}
		}
	}

	if (isAddToModule) {
		tweets.moduleItems = tweets.entries?.[0]?.content?.items || [];
		delete tweets.entries;
	}
}
interface Body {
	data: {
		[key: string]: {
			home_timeline_urt?: Instruction[];
			result?: {
				timeline_v2: {
					timeline: { instructions: Instruction[] };
				};
			};
			instructions?: Instruction[];
		};
	};
}

// TODO: double check this interface
interface Instruction {
	type: string;
	direction?: string;
	moduleItems?: any;
	entries?: Entry[];
}

interface Entry {
	entryId?: string;
	sortIndex?: string;
	content: {
		itemContent?: {
			itemType: string;
		};
		entryType: string;
		items?: any[];
	};
}
