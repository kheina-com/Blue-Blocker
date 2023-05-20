import { BlockCounter } from "./models/block_counter.js";
import { BlockQueue } from "./models/block_queue.js";
import { QueueConsumer } from "./models/queue_consumer.js";
import { commafy, FormatLegacyName } from "./utilities.js";
import { api, DefaultOptions, logstr, Headers, ReasonBlueVerified, ReasonNftAvatar, ReasonMap } from "./constants.js";

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);
const blockCounter = new BlockCounter(api.storage.local);
const blockCache = new Set();

export var options = { ...DefaultOptions };
export function SetOptions(items) {
	options = items;
}

export function SetHeaders(headers) {
	api.storage.local.get({ headers: { }}).then(items => {
		// so basically we want to only update items that have values
		for (const [header, value] of Object.entries(headers)) {
			items.headers[header.toLowerCase()] = value;
		}
		api.storage.local.set(items);
		console.debug(logstr, "updated headers:", items.headers);
	});
}

function unblockUser(user, user_id, reason, attempt = 1) {
	api.storage.sync.get({ unblocked: { } }).then(items => {
		items.unblocked[String(user_id)] = null;
		api.storage.sync.set(items);
	});

	const root = window.location.href.match(/^https?:\/\/(?:\w+\.)?twitter.com(?=$|\/)/)[0];
	let url = null;

	if (root.includes("tweetdeck")) {
		url = "https://api.twitter.com/1.1/";
	} else {
		url = `${root}/i/api/1.1/`;
	}

	if (options.mute) {
		url += "mutes/users/destroy.json";
	} else {
		url += "blocks/destroy.json";
	}

	api.storage.local.get({ headers: null }).then(items => {
		const body = `user_id=${user_id}`;
		const headers = {
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
				t.innerText = `could not unblock @${user.legacy.screen_name}, user has been suspended or no longer exists.`;
				const ele = document.getElementById("injected-blue-block-toasts");
				ele.appendChild(t);
				setTimeout(() => ele.removeChild(t), options.popupTimer * 1000);
				console.log(logstr, `failed to unblock ${FormatLegacyName(user)}, user no longer exists`);
			}
			else if (response.status >= 300) {
				console.error(logstr, `failed to unblock ${FormatLegacyName(user)}:`, user, response);
			}
			else {
				const t = document.createElement("div");
				t.className = "toast";
				t.innerText = `unblocked @${user.legacy.screen_name}, they won't be blocked again.`;
				const ele = document.getElementById("injected-blue-block-toasts");
				ele.appendChild(t);
				setTimeout(() => ele.removeChild(t), options.popupTimer * 1000);
				console.log(logstr, `unblocked ${FormatLegacyName(user)}`);
			}
		}).catch(error => {
			if (attempt < 3) {
				unblockUser(user, user_id, reason, attempt + 1);
			} else {
				console.error(logstr, `failed to unblock ${FormatLegacyName(user)}:`, user, error);
			}
		})
	});
}

export const EventKey = "MultiTabEvent";
export const ErrorEvent = "ErrorEvent";
const UserBlockedEvent = "UserBlockedEvent";
api.storage.local.onChanged.addListener(items => {
	// we're using local storage as a really dirty event driver
	if (!items.hasOwnProperty(EventKey)) {
		return;
	}
	const e = items[EventKey].newValue;

	switch (e.type) {
		case UserBlockedEvent:
			if (options.showBlockPopups) {
				const { user, user_id, reason } = e;
				const t = document.createElement("div");
				t.className = "toast";
				const name = user.legacy.name.length > 25 ? user.legacy.name.substring(0, 23).trim() + "..." : user.legacy.name;
				t.innerHTML = `blocked ${name} (<a href="/${user.legacy.screen_name}">@${user.legacy.screen_name}</a>)`;
				const b = document.createElement("button");
				b.onclick = () => {
					unblockUser(user, user_id, reason);
					t.removeChild(b);
				};
				b.innerText = "undo";
				t.appendChild(b);
				const ele = document.getElementById("injected-blue-block-toasts");
				ele.appendChild(t);
				setTimeout(() => ele.removeChild(t), options.popupTimer * 1000);
			}
			break;

		case ErrorEvent:
			// skip checking options, since errors should always be shown
			const { message, detail } = e;
			console.error(logstr, `${message}:`, detail);

			const t = document.createElement("div");
			t.className = "toast error";
			t.innerHTML = `<p>an error occurred! check the console and create an issue on <a href="https://github.com/kheina-com/Blue-Blocker/issues" target="_blank">GitHub</a></p>`;

			const ele = document.getElementById("injected-blue-block-toasts");
			ele.appendChild(t);
			setTimeout(() => ele.removeChild(t), options.popupTimer * 2000);
			break;

		default:
			console.error(logstr, "unknown multitab event occurred:", e);
	}
});

// retrieve settings immediately on startup
api.storage.sync.get(DefaultOptions).then(SetOptions);

export function ClearCache() {
	blockCache.clear();
}

function queueBlockUser(user, user_id, reason) {
	if (blockCache.has(user_id)) {
		return;
	}
	blockCache.add(user_id);
	queue.push({user, user_id, reason});
	console.log(logstr, `queued ${FormatLegacyName(user)} for a block due to ${ReasonMap[reason]}.`);
	consumer.start();
}

function checkBlockQueue() {
	let event = null;
	api.storage.sync.get(DefaultOptions)
	.then(items => SetOptions(items))
	.then(() => queue.shift())
	.then(item => {
		if (item === undefined) {
			consumer.stop();
			return;
		}
		const {user, user_id, reason} = item;
		blockUser(user, user_id, reason);
	}).catch(error => api.storage.local.set({ [EventKey]: { type: ErrorEvent, message: "unexpected error occurred while processing block queue", detail: { error, event } } }));
}

const consumer = new QueueConsumer(api.storage.local, checkBlockQueue, async s => {
	const items = await api.storage.sync.get({ blockInterval: options.blockInterval });
	return items.blockInterval * 1000
});
consumer.start();

const CsrfTokenRegex = /ct0=\s*(\w+);/;
function blockUser(user, user_id, reason, attempt=1) {
	const root = window.location.href.match(/^https?:\/\/(?:\w+\.)?twitter.com(?=$|\/)/)[0];
	let url = null;

	if (root.includes("tweetdeck")) {
		url = "https://api.twitter.com/1.1/";
	} else {
		url = `${root}/i/api/1.1/`;
	}

	if (options.mute) {
		url += "mutes/users/create.json";
	} else {
		url += "blocks/create.json";
	}

	api.storage.local.get({ headers: null }).then(items => {
		const body = `user_id=${user_id}`;
		let headers = {
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

		const options = {
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
		})
	});
}

const blockableAffiliateLabels = new Set(["AutomatedLabel"]);
const blockableVerifiedTypes = new Set(["Business"]);
export function BlockBlueVerified(user, config) {
	// We're not currently adding anything to the queue so give up.
	if (config.suspendedBlockCollection) {
		return;
	}

	if (!user?.rest_id) {
		console.error(logstr, 'invalid user object passed to BlockBlueVerified');
		return;
	}

	const formattedUserName = FormatLegacyName(user);

	// since we can be fairly certain all user objects will be the same, break this into a separate function
	if (user.legacy?.verified_type && !blockableVerifiedTypes.has(user.legacy.verified_type)) {
		return;
	}
	if (user.legacy?.blocking) {
		return;
	}
	if (user.is_blue_verified) {	
		if (
			// group for if the user has unblocked them previously
			// you cannot store sets in sync memory, so this will be a janky object
			config.unblocked.hasOwnProperty(String(user.rest_id))
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because you unblocked them previously.`);
		}
		else if (
			// group for block-following option
			!config.blockFollowing && (user.legacy?.following || user.super_following)
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because you follow them.`);
		}
		else if (
			// group for block-followers option
			!config.blockFollowers && user.legacy?.followed_by
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because they follow you.`);
		}
		else if (
			// group for skip-verified option
			// TODO: look to see if there's some other way to check legacy verified
			config.skipVerified && (user.legacy?.verified)
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because they are verified through other means.`);
		}
		else if (
			// verified via an affiliated organization instead of blue
			config.skipAffiliated && (blockableAffiliateLabels.has(user.affiliates_highlighted_label?.label?.userLabelType) || user.legacy?.verified_type === "Business")
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because they are verified through an affiliated organization.`);
		}
		else if (
			// verified by follower count
			config.skip1Mplus && user.legacy?.followers_count > (config.skipFollowerCount)
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${formattedUserName} because they have over ${commafy(config.skipFollowerCount)} followers and Elon is an idiot.`);
		}
		else {
			queueBlockUser(user, String(user.rest_id), ReasonBlueVerified);
		}
	}
	else if (config.blockNftAvatars && user.has_nft_avatar) {
		if (
			// group for block-following option
			!config.blockFollowing && (user.legacy?.following || user.super_following)
		) {
			console.log(logstr, `did not block user with NFT avatar ${formattedUserName} because you follow them.`);
		}
		else if (
			// group for block-followers option
			!config.blockFollowers && user.legacy?.followed_by
		) {
			console.log(logstr, `did not block user with NFT avatar ${formattedUserName} because they follow you.`);
		}
		else {
			queueBlockUser(user, String(user.rest_id), headers, ReasonNftAvatar);
		}
	}
}
