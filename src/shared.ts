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
} from './constants';
import { commafy, IsUserLegacyVerified, FormatLegacyName } from './utilities';

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);
const blockCounter = new BlockCounter(api.storage.local);
const blockCache = new Set();

export function SetHeaders(headers: { [k: string]: string }) {
	api.storage.local.get({ headers: { }}).then(items => {
		// so basically we want to only update items that have values
		for (const [header, value] of Object.entries(headers)) {
			items.headers[header.toLowerCase()] = value;
		}
		api.storage.local.set(items);
	});
}

function unblockUser(user: { name: string, screen_name: string }, user_id: string, reason: number, attempt: number = 1) {
	api.storage.sync.get({ unblocked: { } }).then(items => {
		items.unblocked[String(user_id)] = null;
		api.storage.sync.set(items);
	});

	const match = window.location.href.match(/^https?:\/\/(?:\w+\.)?twitter.com(?=$|\/)/);

	if (!match) {
		throw new Error("unexpected or incorrectly formatted url");
	}

	const root: string = match[0];
	let url: string = "";

	if (root.includes("tweetdeck")) {
		url = "https://api.twitter.com/1.1/";
	} else {
		url = `${root}/i/api/1.1/`;
	}

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		if (config.mute) {
			url += "mutes/users/destroy.json";
		} else {
			url += "blocks/destroy.json";
		}

		api.storage.local.get({ headers: null })
		.then(items => items.headers as { [k: string]: string })
		.then((req_headers: { [k: string]: string }) => {
			const body = `user_id=${user_id}`;
			const headers: { [k: string]: string } = {
				"content-length": body.length.toString(),
				"content-type": "application/x-www-form-urlencoded",
				"accept-encoding": "gzip, deflate, br",
				"accept-language": "en-US,en;q=0.9",
				accept: "*/*",
			};

			for (const header of Headers) {
				headers[header] = req_headers[header];
			}

			// attempt to manually set the csrf token to the current active cookie
			const csrf = CsrfTokenRegex.exec(document.cookie);
			if (csrf) {
				headers["x-csrf-token"] = csrf[1];
			} else {
				// default to the request's csrf token
				headers["x-csrf-token"] = req_headers["x-csrf-token"];
			}

			fetch(url, {
				body,
				headers,
				method: "POST",
				credentials: "include",
			}).then(response => {
				if (response.status === 403) {
					// user has been logged out, we need to stop queue and re-add
					console.log(logstr, "user is logged out, failed to unblock user.");
				}
				else if (response.status === 404) {
					// notice the wording here is different than the blocked 404. the difference is that if the user
					// is unbanned, they will still be blocked and we want the user to know about that

					const t = document.createElement("div");
					t.className = "toast";
					t.innerText = `could not unblock @${user.screen_name}, user has been suspended or no longer exists.`;
					const ele = document.getElementById("injected-blue-block-toasts");
					if (!ele) {
						throw new Error("blue blocker was unable to create or find toasts div.");
					}

					ele.appendChild(t);
					setTimeout(() => ele.removeChild(t), config.popupTimer * 1000);
					console.log(logstr, `failed to unblock ${FormatLegacyName(user)}, user no longer exists`);
				}
				else if (response.status >= 300) {
					console.error(logstr, `failed to unblock ${FormatLegacyName(user)}:`, user, response);
				}
				else {
					const t = document.createElement("div");
					t.className = "toast";
					t.innerText = `unblocked @${user.screen_name}, they won't be blocked again.`;
					const ele = document.getElementById("injected-blue-block-toasts");
					if (!ele) {
						throw new Error("blue blocker was unable to create or find toasts div.");
					}

					ele.appendChild(t);
					setTimeout(() => ele.removeChild(t), config.popupTimer * 1000);
					console.log(logstr, `unblocked ${FormatLegacyName(user)}`);
				}
			}).catch(error => {
				if (attempt < 3) {
					unblockUser(user, user_id, reason, attempt + 1);
				} else {
					console.error(logstr, `failed to unblock ${FormatLegacyName(user)}:`, user, error);
				}
			});
		});
	});
}

const UserBlockedEvent = 'UserBlockedEvent';
api.storage.local.onChanged.addListener((items) => {
	// we're using local storage as a really dirty event driver
	if (!items.hasOwnProperty(EventKey)) {
		return;
	}
	const e = items[EventKey].newValue;

	api.storage.sync.get(DefaultOptions).then(options => {
		switch (e.type) {
			case MessageEvent:
				if (options.showBlockPopups) {
					const t = document.createElement('div');
					t.className = 'toast';
					t.innerText = e.message;
					const ele = document.getElementById('injected-blue-block-toasts');
					if (ele) {
						ele.appendChild(t);
						setTimeout(() => ele.removeChild(t), options.popupTimer * 1000);
					}
				}
				break;

			case UserBlockedEvent:
				if (options.showBlockPopups) {
					const event = e as BlockUser;
					const { user, user_id, reason } = event;
					const t = document.createElement('div');
					t.className = 'toast';
					const name =
						user.name.length > 25
							? user.name.substring(0, 23).trim() + '...'
							: user.name;
					t.innerHTML = `blocked ${name} (<a href="/${user.screen_name}">@${user.screen_name}</a>)`;
					const b = document.createElement('button');
					b.onclick = () => {
						unblockUser(user, user_id, reason);
						t.removeChild(b);
					};
					b.innerText = 'undo';
					t.appendChild(b);
					const ele = document.getElementById('injected-blue-block-toasts');
					if (ele) {
						ele.appendChild(t);
						setTimeout(() => ele.removeChild(t), options.popupTimer * 1000);
					}
				}
				break;

			case ErrorEvent:
				// skip checking options, since errors should always be shown
				const { message, detail } = e;
				console.error(logstr, `${message}:`, detail);

				const t = document.createElement('div');
				t.className = 'toast error';
				t.innerHTML = `<p>an error occurred! check the console and create an issue on <a href="https://github.com/kheina-com/Blue-Blocker/issues" target="_blank">GitHub</a></p>`;

				const ele = document.getElementById('injected-blue-block-toasts');
				if (ele) {
					ele.appendChild(t);
					setTimeout(() => ele.removeChild(t), 60e3);
				}
				break;

			default:
				console.error(logstr, 'unknown multitab event occurred:', e);
		}
	});
});

export function ClearCache() {
	blockCache.clear();
}

function queueBlockUser(user: BlueBlockerUser, user_id: string, reason: number) {
	if (blockCache.has(user_id)) {
		return;
	}
	blockCache.add(user_id);
	queue.push({ user_id, reason, user: { name: user.legacy.name, screen_name: user.legacy.screen_name } });
	console.log(logstr, `queued ${FormatLegacyName(user.legacy)} for a block due to ${ReasonMap[reason]}.`);
	consumer.start();
}

function checkBlockQueue(): Promise<void> {
	return new Promise<void>(resolve => {
		queue.shift()
		.then(item => {
			if (item === undefined) {
				consumer.stop();
				return;
			}
			const { user, user_id, reason } = item;
			blockUser(user, user_id, reason);
			resolve();
		})
		.catch(error => {
			console.error(logstr, "unexpected error occurred while processing block queue", error);
			api.storage.local.set({
				[EventKey]: {
					type: ErrorEvent,
					message: "unexpected error occurred while processing block queue",
					detail: { error, event: null },
				},
			})
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
function blockUser(user: { name: string, screen_name: string }, user_id: string, reason: number, attempt = 1) {
	const match = window.location.href.match(/^https?:\/\/(?:\w+\.)?twitter.com(?=$|\/)/);

	if (!match) {
		throw new Error("unexpected or incorrectly formatted url");
	}

	const root: string = match[0];
	let url: string = "";

	if (root.includes("tweetdeck")) {
		url = "https://api.twitter.com/1.1/";
	} else {
		url = `${root}/i/api/1.1/`;
	}

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		if (config.mute) {
			url += "mutes/users/create.json";
		} else {
			url += "blocks/create.json";
		}

		api.storage.local.get({ headers: null }).then(items => {
			const body = `user_id=${user_id}`;
			let headers: { [k: string]: string } = {
				"content-length": body.length.toString(),
				"content-type": "application/x-www-form-urlencoded",
				"accept-encoding": "gzip, deflate, br",
				"accept-language": "en-US,en;q=0.9",
				accept: "*/*",
			};

			for (const header of Headers) {
				headers[header] = items.headers[header];
			}

			// attempt to manually set the csrf token to the current active cookie
			const csrf = CsrfTokenRegex.exec(document.cookie);
			if (csrf) {
				headers["x-csrf-token"] = csrf[1];
			} else {
				// default to the request's csrf token
				headers["x-csrf-token"] = items.headers["x-csrf-token"];
			}

			const options: {
				body: string,
				headers: { [k: string]: string },
				method: string,
				credentials: RequestCredentials,
			} = {
				body,
				headers,
				method: "POST",
				credentials: "include",
			};
			console.debug(logstr, "block request:", { url, ...options });

			fetch(url, options).then(response => {
				console.debug(logstr, "block response:", response);

				if (response.status === 403) {
					// user has been logged out, we need to stop queue and re-add
					consumer.stop();
					queue.push({user, user_id, reason});
					console.log(logstr, "user is logged out, queue consumer has been halted.");
				}
				else if (response.status === 404) {
					console.log(logstr, `did not block ${FormatLegacyName(user)}, user no longer exists`);
				}
				else if (response.status >= 300) {
					queue.push({user, user_id, reason});
					console.error(logstr, `failed to block ${FormatLegacyName(user)}:`, user, response);
				}
				else {
					blockCounter.increment();
					console.log(logstr, `blocked ${FormatLegacyName(user)} due to ${ReasonMap[reason]}.`);
					api.storage.local.set({ [EventKey]: { type: UserBlockedEvent, user, user_id, reason } })
				}
			}).catch(error => {
				if (attempt < 3) {
					blockUser(user, user_id, reason, attempt + 1);
				} else {
					queue.push({user, user_id, reason});
					console.error(logstr, `failed to block ${FormatLegacyName(user)}:`, user, error);
				}
			});
		});
	});
}

const blockableAffiliateLabels = new Set(['AutomatedLabel']);
const blockableVerifiedTypes = new Set(['Business']);
export async function BlockBlueVerified(user: BlueBlockerUser, config: Config) {
	// We're not currently adding anything to the queue so give up.
	if (config.suspendedBlockCollection) {
		return;
	}

	if (
		user.rest_id === undefined ||
		user?.legacy.name === undefined ||
		user?.legacy.screen_name === undefined
	) {
		console.error(logstr, 'invalid user object passed to BlockBlueVerified');
		return;
	}

	const formattedUserName = FormatLegacyName(user.legacy);
	const hasBlockableVerifiedTypes = blockableVerifiedTypes.has(user.legacy?.verified_type || '');
	const hasBlockableAffiliateLabels = blockableAffiliateLabels.has(
		user.affiliates_highlighted_label?.label?.userLabelType || '',
	);

	// since we can be fairly certain all user objects will be the same, break this into a separate function
	if (user.legacy?.verified_type && !blockableVerifiedTypes.has(user.legacy.verified_type)) {
		return;
	}
	if (user.legacy?.blocking) {
		return;
	}

	// TODO: we should be able to move unified logic (just following and followed-by for now) above the groups

	// step 1: is user verified
	if (user.is_blue_verified || hasBlockableVerifiedTypes || hasBlockableAffiliateLabels) {
		if (
			// group for if the user has unblocked them previously
			// you cannot store sets in sync memory, so this will be a janky object
			config.unblocked.hasOwnProperty(String(user.rest_id))
		) {
			console.log(
				logstr,
				`did not block Twitter Blue verified user ${formattedUserName} because you unblocked them previously.`,
			);
		} else if (
			// group for block-following option
			!config.blockFollowing &&
			(user.legacy?.following || user.super_following)
		) {
			console.log(
				logstr,
				`did not block Twitter Blue verified user ${formattedUserName} because you follow them.`,
			);
		} else if (
			// group for block-followers option
			!config.blockFollowers &&
			user.legacy?.followed_by
		) {
			console.log(
				logstr,
				`did not block Twitter Blue verified user ${formattedUserName} because they follow you.`,
			);
		} else if (
			// group for skip-verified option
			config.skipVerified &&
			await IsUserLegacyVerified(user.rest_id, user.legacy.screen_name)
		) {
			console.log(
				logstr,
				`did not block Twitter Blue verified user ${formattedUserName} because they are legacy verified.`,
			);
		} else if (
			// verified via an affiliated organization instead of blue
			config.skipAffiliated &&
			(hasBlockableAffiliateLabels || hasBlockableVerifiedTypes)
		) {
			console.log(
				logstr,
				`did not block Twitter Blue verified user ${formattedUserName} because they are verified through an affiliated organization.`,
			);
		} else if (
			// verified by follower count
			config.skip1Mplus &&
			user.legacy?.followers_count > config.skipFollowerCount
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because they have over ${commafy(config.skipFollowerCount)} followers and Elon is an idiot.`);
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
	if (config.blockNftAvatars && (user.has_nft_avatar || user.profile_image_shape === "Hexagon")) {
		if (
			// group for if the user has unblocked them previously
			// you cannot store sets in sync memory, so this will be a janky object
			config.unblocked.hasOwnProperty(String(user.rest_id))
		) {
			console.log(
				logstr,
				`did not block user with NFT avatar ${formattedUserName} because you unblocked them previously.`,
			);
		} else if (
			// group for block-following option
			!config.blockFollowing &&
			(user.legacy?.following || user.super_following)
		) {
			console.log(
				logstr,
				`did not block user with NFT avatar ${formattedUserName} because you follow them.`,
			);
		} else if (
			// group for block-followers option
			!config.blockFollowers &&
			user.legacy?.followed_by
		) {
			console.log(
				logstr,
				`did not block user with NFT avatar ${formattedUserName} because they follow you.`,
			);
		} else {
			queueBlockUser(user, String(user.rest_id), ReasonNftAvatar);
			return;
		}
	}

	// step 3: external addon integrations
	if (config.soupcanIntegration) {
		// fire an event here to soupcan and check for transphobia
		try {
			const response = await chrome.runtime.sendMessage(
				SoupcanExtensionId,
				{ action: "check_twitter_user", screen_name: user.legacy.screen_name },
			);
			console.debug(logstr, `soupcan response for @${user.legacy.screen_name}:`, response);
			if (response?.status !== "transphobic") {
				// just exit, don't bother reporting since this will trigger for most users. remember, ALL users pass through this function.
			} else if (
				// group for if the user has unblocked them previously
				// you cannot store sets in sync memory, so this will be a janky object
				config.unblocked.hasOwnProperty(String(user.rest_id))
			) {
				console.log(
					logstr,
					`did not block transphobic user ${formattedUserName} because you unblocked them previously.`,
				);
			} else if (
				// group for block-following option
				!config.blockFollowing &&
				(user.legacy?.following || user.super_following)
			) {
				console.log(
					logstr,
					`did not block transphobic user ${formattedUserName} because you follow them.`,
				);
			} else if (
				// group for block-followers option
				!config.blockFollowers &&
				user.legacy?.followed_by
			) {
				console.log(
					logstr,
					`did not block transphobic user ${formattedUserName} because they follow you.`,
				);
			} else {
				queueBlockUser(user, String(user.rest_id), ReasonTransphobia);
			}
		} catch (_e) {
			const e = _e as Error;
			if (e.message === "Could not establish connection. Receiving end does not exist.") {
				api.storage.sync.set({ soupcanIntegration: false });
				console.log(logstr, "looks like soupcan was uninstalled, disabling integration.");
			} else {
				console.error(logstr, "an unknown error occurred while messaging soupcan:", e);
			}
		}
	}
}
