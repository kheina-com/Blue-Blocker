import { BlockCounter } from './models/block_counter';
import { QueueConsumer } from './models/queue_consumer';
import {
	api,
	DefaultOptions,
	logstr,
	Headers,
	ReasonBlueVerified,
	ReasonBusinessVerified,
	ReasonMap,
	SoupcanExtensionId,
	ErrorEvent,
	EventKey,
	MessageEvent,
	ReasonTransphobia,
	ReasonPromoted,
	HistoryStateGone,
	SuccessStatus,
	ReasonExternal,
	IntegrationStateDisabled,
	IntegrationStateReceiveOnly,
	ReasonDisallowedWordsOrEmojis,
} from './constants';

import {
	commafy,
	AddUserBlockHistory,
	EscapeHtml,
	FormatLegacyName,
	IsUserLegacyVerified,
	MakeToast,
	RemoveUserBlockHistory,
	QueuePop,
	QueuePush,
	RefId,
} from './utilities';

// TODO: tbh this file shouldn't even exist anymore and should be
// split between content/startup.ts and utilities.ts

// Define constants that shouldn't be exported to the rest of the addon
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

const twitterWindowRegex = /^https?:\/\/(?:\w+\.)?(?:twitter|x)\.com(?=$|\/)/;

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

	const match = window.location.href.match(twitterWindowRegex);

	if (!match) {
		throw new Error('unexpected or incorrectly formatted url');
	}

	const root: string = match[0];
	let url: string = '';

	if (root.includes('tweetdeck')) {
		url = 'https://api.x.com/1.1/';
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
					MakeToast(e.message, config, e.options);
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

function queueBlockUser(
	user: BlueBlockerUser,
	user_id: string,
	reason: number,
	external_reason: string | null = null,
) {
	if (blockCache.has(user_id)) {
		return;
	}
	blockCache.add(user_id);

	const blockUser: BlockUser = {
		user_id,
		reason,
		user: {
			name: user.legacy.name,
			screen_name: user.legacy.screen_name,
		},
	};

	if (external_reason) {
		blockUser.external_reason = external_reason;
	}

	QueuePush(blockUser);
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
	return new Promise<void>((resolve, reject) => {
		QueuePop()
			.then((item) => {
				if (!item) {
					return reject();
				}
				blockUser(item);
				resolve();
			})
			.catch((error) => {
				console.error(
					logstr,
					'unexpected error occurred while processing block queue',
					error,
				);
				api.storage.local
					.set({
						[EventKey]: {
							type: ErrorEvent,
							message: 'unexpected error occurred while processing block queue',
							detail: { error, event: null },
						},
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
	});
}

const consumer = new QueueConsumer(api.storage.local, checkBlockQueue, async () => {
	const items = await api.storage.sync.get({ blockInterval: DefaultOptions.blockInterval });
	return items.blockInterval * 1000;
});
consumer.start();

const CsrfTokenRegex = /ct0=\s*(\w+);/;

function blockUser(user: BlockUser, attempt = 1) {
	const match = window.location.href.match(twitterWindowRegex);

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
			.then((req_headers) => {
				const body = `user_id=${user.user_id}`;
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
						console.debug(logstr, 'block response:', response);

						if (response.status === 403 || response.status === 401) {
							// user has been logged out, we need to stop queue and re-add
							consumer.stop();
							QueuePush(user);
							api.storage.local.set({ [EventKey]: { type: UserLogoutEvent } });
							console.log(
								logstr,
								'user is logged out, queue consumer has been halted.',
							);
						} else if (response.status === 404) {
							AddUserBlockHistory(user, HistoryStateGone).catch((e) =>
								console.error(logstr, e),
							);
							console.log(
								logstr,
								`could not block ${FormatLegacyName(
									user.user,
								)}, user no longer exists`,
							);
						} else if (response.status >= 300) {
							consumer.stop();
							QueuePush(user);
							console.error(
								logstr,
								`failed to block ${FormatLegacyName(
									user.user,
								)}, consumer stopped just in case.`,
								response,
							);
						} else {
							blockCounter.increment();
							AddUserBlockHistory(user).catch((e) => console.error(logstr, e));
							console.log(
								logstr,
								`blocked ${FormatLegacyName(user.user)} due to ${
									ReasonMap?.[user.reason] ?? user?.external_reason
								}.`,
							);
							api.storage.local.set({
								[EventKey]: { type: UserBlockedEvent, ...user },
							});
						}
					})
					.catch((error) => {
						if (attempt < 3) {
							blockUser(user, attempt + 1);
						} else {
							QueuePush(user);
							console.error(
								logstr,
								`failed to block ${FormatLegacyName(user.user)}:`,
								user,
								error,
							);
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
									QueuePush(user);
									api.storage.local.set({
										[EventKey]: { type: UserLogoutEvent },
									});
									console.log(
										logstr,
										'user is logged out, queue consumer has been halted.',
									);
								} else if (response.status === 404) {
									AddUserBlockHistory(user, HistoryStateGone).catch((e) =>
										console.error(logstr, e),
									);
									console.log(
										logstr,
										`could not ${
											config.mute ? 'mute' : 'block'
										} ${FormatLegacyName(user.user)}, user no longer exists`,
									);
								} else if (response.status >= 300) {
									consumer.stop();
									QueuePush(user);
									console.error(
										logstr,
										`failed to ${
											config.mute ? 'mute' : 'block'
										} ${FormatLegacyName(
											user.user,
										)}, consumer stopped just in case.`,
										response,
									);
								} else {
									blockCounter.increment();
									AddUserBlockHistory(user).catch((e) =>
										console.error(logstr, e),
									);
									console.log(
										logstr,
										`${config.mute ? 'mut' : 'block'}ed ${FormatLegacyName(
											user.user,
										)} due to ${ReasonMap[user.reason]}.`,
									);
									api.storage.local.set({
										[EventKey]: { type: UserBlockedEvent, ...user },
									});
								}
							})
							.catch((error) => {
								if (attempt < 3) {
									blockUser(user, attempt + 1);
								} else {
									QueuePush(user);
									console.error(
										logstr,
										`failed to ${
											config.mute ? 'mute' : 'block'
										} ${FormatLegacyName(user.user)}:`,
										user,
										error,
									);
								}
							});
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

		// Step 0: Check for disallowed words or emojis in usernames.
		const disallowedWordsWithoutEmptyStrings = config.disallowedWords.filter(word => word !== '');
		if (disallowedWordsWithoutEmptyStrings.length > 0){
			// this makes extra sure that emojis are always detected, regardless if they are attached to a word or another string of emojis.
			// the 'i' makes the test case insensitive, which helps users not have to worry about typing the same word multiple times with different variations.
			const disallowedWordsAndEmojis = new RegExp(`${config.disallowedWords.join('(?= |$)|')}(?= |$)`, 'i');
			const usernameToTest = (user.legacy.name).replace(/ {2,}/, ' ');
			if (disallowedWordsAndEmojis.test(usernameToTest)) {
				queueBlockUser(user, String(user.rest_id), ReasonDisallowedWordsOrEmojis);
				console.log(logstr, `${config.mute ? 'muted' : 'blocked'} ${formattedUserName} for having disallowed words/emojis in their username.`);
			  }
		}

		const legacyDbRejectMessage =
			'could not access the legacy verified database, skip legacy has been disabled.';
		// step 1: is user verified
		if ((!config.skipBlueCheckmark && user.is_blue_verified) || hasBlockableVerifiedTypes || hasBlockableAffiliateLabels) {
			if (
				// group for skip-verified option
				config.skipVerified &&
				(
					// if the user used blue features and the config says to, we can skip loading and checking the legacy database
					(config.blockForUse &&
					!user.used_blue) ||
					// ok so they didn't use blue features, load the DB and check
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
				})))
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
				const reason = hasBlockableVerifiedTypes
					? ReasonBusinessVerified
					: ReasonBlueVerified;
				queueBlockUser(user, String(user.rest_id), reason);
				return;
			}
		}

		// step 2: promoted tweets
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

	let updateIntegrations = false;
	api.storage.local
		.get({ integrations: {} })
		.then((items) => items.integrations as { [id: string]: { name: string; state: number } })
		.then(async (integrations) => {
			for (const [extensionId, integration] of Object.entries(integrations)) {
				if (
					!extensionId ||
					integration.state === IntegrationStateDisabled ||
					integration.state === IntegrationStateReceiveOnly
				) {
					continue;
				}

				const refid = RefId();
				try {
					const message = { action: 'check_twitter_user', data: user, refid };
					console.debug(logstr, refid, 'send:', message, integration);
					const response = (await api.runtime.sendMessage(
						extensionId,
						message,
					)) as MessageResponse;
					console.debug(logstr, refid, 'recv:', response);

					if (response?.status !== SuccessStatus) {
						console.error(
							logstr,
							refid,
							'received a non-success status from',
							integration.name,
							response,
						);
						return;
					}

					const successResponse = response as SuccessResponse;
					const result = successResponse.result as ExternalBlockResponse;
					if (result.block) {
						queueBlockUser(user, String(user.rest_id), ReasonExternal, result.reason);
						return;
					}
				} catch (_e) {
					const e = _e as Error;
					if (
						e.message ===
						'Could not establish connection. Receiving end does not exist.'
					) {
						updateIntegrations = true;
						integration.state = IntegrationStateDisabled;
						console.log(
							logstr,
							refid,
							'looks like',
							integration.name,
							'was uninstalled, disabling integration.',
						);
					} else {
						console.error(
							logstr,
							refid,
							`an unknown error occurred while messaging ${integration.name}:`,
							e,
						);
					}
				}
			}

			if (updateIntegrations) {
				api.storage.local.set({ integrations });
			}
		})
		.catch((e) =>
			// this error should basically be unreachable
			console.error(logstr, 'an unexpected error occurred while processing integrations:', e),
		);
}
