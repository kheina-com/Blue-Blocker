import { BlockCounter } from './models/block_counter';
import { BlockQueue } from './models/block_queue';
import { QueueConsumer } from './models/queue_consumer';
import {
	api,
	DefaultOptions,
	logstr,
	Headers,
	ReasonBlueVerified,
	ReasonNftAvatar,
	ReasonBusinessVerified,
	ReasonMap,
	SoupcanExtensionId,
	ErrorEvent,
	EventKey,
	MessageEvent,
	ReasonTransphobia,
	ReasonPromoted,
	HistoryStateGone,
} from './constants';
import {
	commafy,
	AddUserBlockHistory,
	EscapeHtml,
	FormatLegacyName,
	IsUserLegacyVerified,
	MakeToast,
	RemoveUserBlockHistory,
} from './utilities';

// TODO: tbh this file shouldn't even exist anymore and should be
// split between content/startup.ts and utilities.ts

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);
const blockCounter = new BlockCounter(api.storage.local);
const blockCache: Set<string> = new Set();
export const UnblockCache: Set<string> = new Set();

export function SetHeaders(headers: { [k: string]: string }) {
	api.storage.local.get({ headers: {} }).then((items) => {
		// so basically we want to only update items that have values
		for (const [header, value] of Object.entries(headers)) {
			items.headers[header.toLowerCase()] = value;
		}
		api.storage.local.set(items);
	});
}

setInterval(blockCache.clear, 10 * 60e3); // clear the cache every 10 minutes
// this is just here so we don't double add users unnecessarily (and also overwrite name)
setInterval(UnblockCache.clear, 10 * 60e3);

function unblockUser(
	user: { name: string; screen_name: string },
	user_id: string,
	reason: number,
	attempt: number = 1,
) {
	UnblockCache.add(user_id);
	api.storage.sync.get({ unblocked: {} }).then((items) => {
		items.unblocked[String(user_id)] = user.screen_name;
		api.storage.sync.set(items);
	});

	const match = window.location.href.match(/^https?:\/\/(?:\w+\.)?twitter.com(?=$|\/)/);

	if (!match) {
		throw new Error('unexpected or incorrectly formatted url');
	}

	const root: string = match[0];
	let url: string = '';

	if (root.includes('tweetdeck')) {
		url = 'https://api.twitter.com/1.1/';
	} else {
		url = `${root}/i/api/1.1/`;
	}

	api.storage.sync.get(DefaultOptions).then((_config) => {
		const config = _config as Config;
		if (config.mute) {
			url += 'mutes/users/destroy.json';
		} else {
			url += 'blocks/destroy.json';
		}

		api.storage.local
			.get({ headers: null })
			.then((items) => items.headers as { [k: string]: string })
			.then((req_headers: { [k: string]: string }) => {
				const body = `user_id=${user_id}`;
				const headers: { [k: string]: string } = {
					'content-length': body.length.toString(),
					'content-type': 'application/x-www-form-urlencoded',
				};

				for (const header of Headers) {
					if (req_headers[header]) {
						headers[header] = req_headers[header];
					}
				}

				// attempt to manually set the csrf token to the current active cookie
				const csrf = CsrfTokenRegex.exec(document.cookie);
				if (csrf) {
					headers['x-csrf-token'] = csrf[1];
				} else {
					// default to the request's csrf token
					headers['x-csrf-token'] = req_headers['x-csrf-token'];
				}

				const options: {
					body: string;
					headers: { [k: string]: string };
					method: string;
					credentials: RequestCredentials;
				} = {
					body,
					headers,
					method: 'POST',
					credentials: 'include',
				};
				fetch(url, options)
					.then((response) => {
						if (response.status === 403) {
							// user has been logged out, we need to stop queue and re-add
							MakeToast(
								`could not un${config.mute ? 'mute' : 'block'} @${
									user.screen_name
								}, you may have been logged out.`,
								config,
							);
							console.log(
								logstr,
								`user is logged out, failed to un${
									config.mute ? 'mute' : 'block'
								} user.`,
							);
						} else if (response.status === 404) {
							// notice the wording here is different than the blocked 404. the difference is that if the user
							// is unbanned, they will still be blocked and we want the user to know about that
							MakeToast(
								`could not un${config.mute ? 'mute' : 'block'} @${
									user.screen_name
								}, user has been suspended or no longer exists.`,
								config,
							);
							console.log(
								logstr,
								`failed to un${config.mute ? 'mute' : 'block'} ${FormatLegacyName(
									user,
								)}, user no longer exists`,
							);
						} else if (response.status >= 300) {
							MakeToast(
								`could not un${config.mute ? 'mute' : 'block'} @${
									user.screen_name
								}, twitter gave an unfamiliar response code.`,
								config,
							);
							console.error(
								logstr,
								`failed to un${config.mute ? 'mute' : 'block'} ${FormatLegacyName(
									user,
								)}:`,
								user,
								response,
							);
						} else {
							RemoveUserBlockHistory(user_id).catch((e) => console.error(logstr, e));
							console.log(
								logstr,
								`un${config.mute ? 'mut' : 'block'}ed ${FormatLegacyName(user)}`,
							);
							MakeToast(
								`un${config.mute ? 'mut' : 'block'}ed @${
									user.screen_name
								}, they won't be ${config.mute ? 'mut' : 'block'}ed again.`,
								config,
							);
						}
					})
					.catch((error) => {
						if (attempt < 3) {
							unblockUser(user, user_id, reason, attempt + 1);
						} else {
							console.error(
								logstr,
								`failed to un${config.mute ? 'mute' : 'block'} ${FormatLegacyName(
									user,
								)}:`,
								user,
								error,
							);
						}
					});
			});
	});
}

const UserBlockedEvent = 'UserBlockedEvent';
const UserLogoutEvent = 'UserLogoutEvent';
api.storage.local.onChanged.addListener((items) => {
	// we're using local storage as a really dirty event driver
	// TODO: replace this with chrome.tabs.sendmessage at some point. (requires adding tabs permission)

	if (!items.hasOwnProperty(EventKey)) {
		return;
	}
	const e = items[EventKey].newValue;
	console.debug(logstr, 'received multi-tab event:', e);

	api.storage.sync.get(DefaultOptions).then((options) => {
		const config = options as Config;
		switch (e.type) {
			case MessageEvent:
				if (config.showBlockPopups) {
					MakeToast(e.message, config);
				}
				break;

			case UserBlockedEvent:
				if (config.showBlockPopups) {
					const event = e as BlockUser;
					const { user, user_id, reason } = event;
					const name =
						user.name.length > 25
							? user.name.substring(0, 23).trim() + '...'
							: user.name;
					const b = document.createElement('button');
					b.innerText = 'undo';
					b.onclick = () => {
						unblockUser(user, user_id, reason);
						const parent = b.parentNode as ParentNode;
						parent.removeChild(b);
					};
					const screen_name = EscapeHtml(user.screen_name); // this shouldn't really do anything, but can't be too careful
					MakeToast(
						`${config.mute ? 'mut' : 'block'}ed ${EscapeHtml(
							name,
						)} (<a href="/${screen_name}">@${screen_name}</a>)`,
						config,
						{ html: true, elements: [b] },
					);
				}
				break;

			case UserLogoutEvent:
				if (config.showBlockPopups) {
					MakeToast(
						`You have been logged out, and ${
							config.mute ? 'mut' : 'block'
						}ing has been paused.`,
						config,
						{
							warn: true,
						},
					);
				}
				break;

			case ErrorEvent:
				// skip checking options, since errors should always be shown
				if (e.message) {
					console.error(logstr, e.message, e);
				}
				MakeToast(
					`<p>an error occurred! check the console and create an issue on <a href="https://github.com/kheina-com/Blue-Blocker/issues" target="_blank">GitHub</a></p>`,
					config,
					{ html: true, error: true },
				);
				break;

			default:
				console.error(logstr, 'unknown multitab event occurred:', e);
		}
	});
});

function queueBlockUser(user: BlueBlockerUser, user_id: string, reason: number) {
	if (blockCache.has(user_id)) {
		return;
	}
	blockCache.add(user_id);
	queue.push({
		user_id,
		reason,
		user: { name: user.legacy.name, screen_name: user.legacy.screen_name },
	});
	api.storage.sync.get(DefaultOptions).then((_config) => {
		const config = _config as Config;
		console.log(
			logstr,
			`queued ${FormatLegacyName(user.legacy)} for a ${
				config.mute ? 'mute' : 'block'
			} due to ${ReasonMap[reason]}.`,
		);
	});
	consumer.start();
}

function checkBlockQueue(): Promise<void> {
	return new Promise<void>((resolve) => {
		queue
			.shift()
			.then((_item) => {
				const item = _item as BlockUser;
				if (item === undefined) {
					consumer.stop();
					return;
				}
				const { user, user_id, reason } = item;

				// required for users enqueued before 0.3.0
				if (user.hasOwnProperty('legacy')) {
					// @ts-ignore
					for (const [key, value] of Object.entries(user.legacy)) {
						// @ts-ignore
						user[key] = value;
					}
				}

				blockUser(user, user_id, reason);
				resolve();
			})
			.catch((error) => {
				console.error(
					logstr,
					'unexpected error occurred while processing block queue',
					error,
				);
				api.storage.local.set({
					[EventKey]: {
						type: ErrorEvent,
						message: 'unexpected error occurred while processing block queue',
						detail: { error, event: null },
					},
				});
				resolve();
			});
	});
}

const consumer = new QueueConsumer(api.storage.local, checkBlockQueue, async () => {
	const items = await api.storage.sync.get({ blockInterval: DefaultOptions.blockInterval });
	return items.blockInterval * 1000;
});
consumer.start();

const CsrfTokenRegex = /ct0=\s*(\w+);/;
function blockUser(
	user: { name: string; screen_name: string },
	user_id: string,
	reason: number,
	attempt = 1,
) {
	const match = window.location.href.match(/^https?:\/\/(?:\w+\.)?twitter.com(?=$|\/)/);

	if (!match) {
		throw new Error('unexpected or incorrectly formatted url');
	}

	const root: string = match[0];
	let url: string = '';

	if (root.includes('tweetdeck')) {
		url = 'https://api.twitter.com/1.1/';
	} else {
		url = `${root}/i/api/1.1/`;
	}

	api.storage.sync.get(DefaultOptions).then((_config) => {
		const config = _config as Config;
		if (config.mute) {
			url += 'mutes/users/create.json';
		} else {
			url += 'blocks/create.json';
		}

		api.storage.local
			.get({ headers: null })
			.then((items) => items.headers as { [k: string]: string })
			.then((req_headers: { [k: string]: string }) => {
				const body = `user_id=${user_id}`;
				const headers: { [k: string]: string } = {
					'content-length': body.length.toString(),
					'content-type': 'application/x-www-form-urlencoded',
				};

				for (const header of Headers) {
					if (req_headers[header]) {
						headers[header] = req_headers[header];
					}
				}

				// attempt to manually set the csrf token to the current active cookie
				const csrf = CsrfTokenRegex.exec(document.cookie);
				if (csrf) {
					headers['x-csrf-token'] = csrf[1];
				} else {
					// default to the request's csrf token
					headers['x-csrf-token'] = req_headers['x-csrf-token'];
				}

				const options: {
					body: string;
					headers: { [k: string]: string };
					method: string;
					credentials: RequestCredentials;
				} = {
					body,
					headers,
					method: 'POST',
					credentials: 'include',
				};

				fetch(url, options)
					.then((response) => {
						console.debug(
							logstr,
							`${config.mute ? 'mute' : 'block'} response:`,
							response,
						);

						if (response.status === 403 || response.status === 401) {
							// user has been logged out, we need to stop queue and re-add
							consumer.stop();
							queue.push({ user, user_id, reason });
							api.storage.local.set({ [EventKey]: { type: UserLogoutEvent } });
							console.log(
								logstr,
								'user is logged out, queue consumer has been halted.',
							);
						} else if (response.status === 404) {
							AddUserBlockHistory({ user_id, user, reason }, HistoryStateGone).catch(
								(e) => console.error(logstr, e),
							);
							console.log(
								logstr,
								`could not ${config.mute ? 'mute' : 'block'} ${FormatLegacyName(
									user,
								)}, user no longer exists`,
							);
						} else if (response.status >= 300) {
							consumer.stop();
							queue.push({ user, user_id, reason });
							console.error(
								logstr,
								`failed to ${config.mute ? 'mute' : 'block'} ${FormatLegacyName(
									user,
								)}, consumer stopped just in case.`,
								response,
							);
						} else {
							blockCounter.increment();
							AddUserBlockHistory({ user_id, user, reason }).catch((e) =>
								console.error(logstr, e),
							);
							console.log(
								logstr,
								`${config.mute ? 'mut' : 'block'}ed ${FormatLegacyName(
									user,
								)} due to ${ReasonMap[reason]}.`,
							);
							api.storage.local.set({
								[EventKey]: { type: UserBlockedEvent, user, user_id, reason },
							});
						}
					})
					.catch((error) => {
						if (attempt < 3) {
							blockUser(user, user_id, reason, attempt + 1);
						} else {
							queue.push({ user, user_id, reason });
							console.error(
								logstr,
								`failed to ${config.mute ? 'mute' : 'block'} ${FormatLegacyName(
									user,
								)}:`,
								user,
								error,
							);
						}
					});
			});
	});
}

const blockableAffiliateLabels: Set<string> = new Set([]);
const blockableVerifiedTypes: Set<string> = new Set(['Business']);
export async function BlockBlueVerified(user: BlueBlockerUser, config: Config) {
	// We're not currently adding anything to the queue so give up.
	if (config.suspendedBlockCollection) {
		return;
	}

	try {
		if (
			user?.rest_id === undefined ||
			user?.legacy?.name === undefined ||
			user?.legacy?.screen_name === undefined
		) {
			throw new Error('invalid user object passed to BlockBlueVerified');
		}

		const formattedUserName = FormatLegacyName(user.legacy);
		const hasBlockableVerifiedTypes = blockableVerifiedTypes.has(
			user.legacy?.verified_type || '',
		);
		const hasBlockableAffiliateLabels = blockableAffiliateLabels.has(
			user.affiliates_highlighted_label?.label?.userLabelType || '',
		);

		// since we can be fairly certain all user objects will be the same, break this into a separate function
		if (user.legacy?.verified_type && !blockableVerifiedTypes.has(user.legacy.verified_type)) {
			return;
		}
		if (user.legacy?.blocking || (config.mute && user.legacy?.muting)) {
			return;
		}

		// some unified logic so it's not copied in a bunch of places. log everything as debug because it'll be noisy
		if (
			// group for if the user has unblocked them previously
			// you cannot store sets in sync memory, so this will be a janky object
			config.unblocked.hasOwnProperty(String(user.rest_id))
		) {
			console.debug(
				logstr,
				`skipped user ${formattedUserName} because you un${
					config.mute ? 'mut' : 'block'
				}ed them previously.`,
			);
			return;
		} else if (
			// group for block-following option
			!config.blockFollowing &&
			(user.legacy?.following || user.super_following)
		) {
			console.debug(logstr, `skipped user ${formattedUserName} because you follow them.`);
			return;
		} else if (
			// group for block-followers option
			!config.blockFollowers &&
			user.legacy?.followed_by
		) {
			console.debug(logstr, `skipped user ${formattedUserName} because they follow you.`);
			return;
		}

		const legacyDbRejectMessage =
			'could not access the legacy verified database, skip legacy has been disabled.';
		// step 1: is user verified
		if (user.is_blue_verified || hasBlockableVerifiedTypes || hasBlockableAffiliateLabels) {
			if (
				// group for skip-verified option
				config.skipVerified &&
				(await new Promise((resolve, reject) => {
					// basically, we're wrapping a promise around a promise to set a timeout on it
					// in case the user's device was unable to set up the legacy db
					function disableSkipLegacy() {
						api.storage.sync.set({ skipVerified: false });
						reject(legacyDbRejectMessage);
					}
					const timeout = setTimeout(disableSkipLegacy, 1000); // 1 second. indexed db is crazy fast (<10ms), this should be plenty
					IsUserLegacyVerified(user.rest_id, user.legacy.screen_name)
						.then(resolve)
						.catch(disableSkipLegacy)
						.finally(() => clearTimeout(timeout));
				}))
			) {
				console.log(
					logstr,
					`did not ${
						config.mute ? 'mute' : 'block'
					} Twitter Blue verified user ${formattedUserName} because they are legacy verified.`,
				);
			} else if (
				// verified via an affiliated organization instead of blue
				config.skipAffiliated &&
				(hasBlockableAffiliateLabels || hasBlockableVerifiedTypes)
			) {
				console.log(
					logstr,
					`did not ${
						config.mute ? 'mute' : 'block'
					} Twitter Blue verified user ${formattedUserName} because they are verified through an affiliated organization.`,
				);
			} else if (
				// verified by follower count
				config.skip1Mplus &&
				user.legacy?.followers_count > config.skipFollowerCount
			) {
				console.log(
					logstr,
					`did not ${
						config.mute ? 'mute' : 'block'
					} Twitter Blue verified user ${formattedUserName} because they have over ${commafy(
						config.skipFollowerCount,
					)} followers and Elon is an idiot.`,
				);
			} else {
				let reason = ReasonBlueVerified;
				if (hasBlockableVerifiedTypes) {
					reason = ReasonBusinessVerified;
				}
				queueBlockUser(user, String(user.rest_id), reason);
				return;
			}
		}

		// step 2: is user an nft bro
		if (
			config.blockNftAvatars &&
			(user.has_nft_avatar || user.profile_image_shape === 'Hexagon')
		) {
			queueBlockUser(user, String(user.rest_id), ReasonNftAvatar);
			return;
		}

		// step 3: promoted tweets
		if (config.blockPromoted && user.promoted_tweet) {
			queueBlockUser(user, String(user.rest_id), ReasonPromoted);
			return;
		}
	} catch (e) {
		console.error(logstr, e);
	}

	// external integrations always come last and have their own error handling
	if (config.soupcanIntegration) {
		// fire an event here to soupcan and check for transphobia
		try {
			const response = await api.runtime.sendMessage(SoupcanExtensionId, {
				action: 'check_twitter_user',
				screen_name: user.legacy.screen_name,
			});
			console.debug(logstr, `soupcan response for @${user.legacy.screen_name}:`, response);
			if (response?.status === 'transphobic') {
				queueBlockUser(user, String(user.rest_id), ReasonTransphobia);
				return;
			}
		} catch (_e) {
			const e = _e as Error;
			console.debug(logstr, `soupcan error for @${user.legacy.screen_name}:`, e);
			if (e.message === 'Could not establish connection. Receiving end does not exist.') {
				api.storage.sync.set({ soupcanIntegration: false });
				console.log(logstr, 'looks like soupcan was uninstalled, disabling integration.');
			} else {
				console.error(logstr, 'an unknown error occurred while messaging soupcan:', e);
			}
		}
	}
}
