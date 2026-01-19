import { SetHeaders } from '../shared';
import { api, logstr, DefaultOptions, emojiRegExp, ErrorEvent, EventKey } from '../constants';
import { escapeRegExp } from '../utilities';
import { HandleInstructionsResponse } from '../parsers/instructions';
import { HandleForYou } from '../parsers/timeline';
import { HandleTypeahead } from '../parsers/search';
import { HandleUnblock } from '../parsers/unblock';
import './startup.ts';
import { HandleRecommendations, HandleUserByScreenName } from '../parsers/user';

function compileConfig(config: Config): CompiledConfig {
	return {
		suspendedBlockCollection: config.suspendedBlockCollection,
		showBlockPopups: config.showBlockPopups,
		toastsLocation: config.toastsLocation,
		mute: config.mute,
		blockFollowing: config.blockFollowing,
		blockFollowers: config.blockFollowers,
		skipFollowingQrts: config.skipFollowingQrts,
		skipBlueCheckmark: config.skipBlueCheckmark,
		skipVerified: config.skipVerified,
		skipAffiliated: config.skipAffiliated,
		skip1Mplus: config.skip1Mplus,
		blockInterval: config.blockInterval,
		unblocked: config.unblocked,
		popupTimer: config.popupTimer,
		skipFollowerCount: config.skipFollowerCount,
		soupcanIntegration: config.soupcanIntegration,
		blockPromoted: config.blockPromoted,
		blockForUse: config.blockForUse,
		blockDisallowedWords: config.blockDisallowedWords,
		disallowedWords:
			config.disallowedWords.length === 0
				? null
				: new RegExp(
						config.disallowedWords
							.map(word =>
								word.match(emojiRegExp)
									? word
									: `(?:^|\\s)${escapeRegExp(word)}(?:$|\\s)`,
							)
							.join('|'),
						'i',
				  ),
	} as CompiledConfig;
}

function eventHandler(e: CustomEvent<BlueBlockerEvent>) {
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
				console.debug(
					logstr,
					'skipped',
					e.detail.parsedUrl[1],
					'response because it contained an error key:',
					{ event: e, body_str },
				);
				return;
			}

			switch (e.detail.parsedUrl[1]) {
				case 'blocks/destroy.json':
				case 'mutes/users/destroy.json':
					return HandleUnblock(e, parsed_body, config);
				case 'HomeLatestTimeline':
				case 'HomeTimeline':
				case 'SearchTimeline':
				case 'UserTweets':
				case 'TweetDetail':
				case 'ModeratedTimeline':
				case 'Following':
				case 'Followers':
				case 'UserCreatorSubscriptions':
				case 'FollowersYouKnow':
				case 'BlueVerifiedFollowers':
				case 'Favoriters':
				case 'Retweeters':
					return HandleInstructionsResponse(e, parsed_body, compileConfig(config));
				case 'timeline/home.json':
				case 'search/adaptive.json':
					return HandleForYou(e, parsed_body, compileConfig(config));
				case 'search/typeahead.json':
					return HandleTypeahead(e, parsed_body, compileConfig(config));
				case 'UserByScreenName':
					return HandleUserByScreenName(e, parsed_body, compileConfig(config));
				case 'recommendations.json':
					return HandleRecommendations(e, parsed_body, compileConfig(config));
				default:
					console.error(
						logstr,
						"found an unexpected url that we don't know how to handle",
						e,
					);
					api.storage.local.set({
						[EventKey]: {
							type: ErrorEvent,
						},
					});
			}
		} catch (error) {
			console.error(logstr, 'unexpected error occurred while parsing request body', {
				error,
				body_str,
				event: e,
			});
			api.storage.local.set({
				[EventKey]: {
					type: ErrorEvent,
				},
			});
		}
	});
}

// If we are running in Firefox, expose a function to page scripts
// This is a good test for Firefox since it's non-standard :)
/** @ts-ignore */
if (api?.runtime?.getBrowserInfo) {
	/** @ts-ignore Again, non-standard, literally only FF*/
	exportFunction(
		event => {
			eventHandler(event);
		},
		window,
		{ defineAs: 'blueBlockerRequest' },
	);
} else {
	document.addEventListener('blue-blocker-event', eventHandler);
}

// Add support for OldTwitter requests.
window.addEventListener('message', async function (ev) {
	if (ev.data.type !== 'OLDTWITTER_REQUEST_LOAD') return;
	if (!ev.data.url || !ev.data.body || !ev.data.headers)
		return console.error(logstr, 'OldTwitter sent an invalid payload.', ev.data);

	const body_str = JSON.stringify(ev.data.body);

	eventHandler(
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
