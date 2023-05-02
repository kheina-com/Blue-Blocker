import { BlockCounter } from "./models/block_counter.js";
import { BlockQueue } from "./models/block_queue.js";
import { QueueConsumer } from "./models/queue_consumer.js";
import { api, DefaultOptions, logstr, Headers, ReasonBlueVerified, ReasonNftAvatar, ReasonMap } from "./constants.js";

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);
const blockCounter = new BlockCounter(api.storage.local);
const blockCache = new Set();

export var options = { ...DefaultOptions };
export function SetOptions(items) {
	options = items;
}

// retrieve settings immediately on startup
api.storage.sync.get(DefaultOptions).then(SetOptions);

export function ClearCache() {
	blockCache.clear();
}

function QueueBlockUser(user, user_id, headers, reason) {
	if (blockCache.has(user_id)) {
		return;
	}
	blockCache.add(user_id);
	queue.push({user, user_id, headers, reason});
	console.log(logstr, `queued ${user.legacy.name} (@${user.legacy.screen_name}) for a block due to ${ReasonMap[reason]}.`);

	consumer.start();
}

function CheckBlockQueue() {
	queue.shift().then(item => {
		if (item === undefined) {
			consumer.stop();
			return;
		}
		api.storage.sync.get(DefaultOptions).then(items => {
			SetOptions(items);
			const {user, user_id, headers, reason} = item;
			BlockUser(user, user_id, headers, reason);
		});
	});
}

const consumer = new QueueConsumer(api.storage.local, CheckBlockQueue, async s => {
	const items = await api.storage.sync.get({ blockInterval: options.blockInterval });
	return items.blockInterval * 1000
});
consumer.start();

const CsrfTokenRegex = /ct0=\s*(\w+);/;
function BlockUser(user, user_id, headers, reason, attempt=1) {
	const formdata = new FormData();
	formdata.append("user_id", user_id);

	const ajax = new XMLHttpRequest();

	ajax.addEventListener('load', event => {
		if (event.target.status === 403) {
			// user has been logged out, we need to stop queue and re-add
			consumer.stop();
			queue.push({user, user_id, headers, reason});
			console.log(logstr, "user is logged out, queue consumer has been halted.");
			return;
		}
		else if (event.target.status >= 300) {
			queue.push({user, user_id, headers, reason});
			console.error(logstr, `failed to block ${user.legacy.name} (@${user.legacy.screen_name}):`, user, event);
		}
		else {
			blockCounter.increment();
			console.log(logstr, `blocked ${user.legacy.name} (@${user.legacy.screen_name}) due to ${ReasonMap[reason]}.`);
		}
	});
	ajax.addEventListener('error', error => {
		console.error(logstr, 'error:', error);

		if (attempt < 3) {
			BlockUser(user, user_id, headers, reason, attempt + 1);
		} else {
			queue.push({user, user_id, headers, reason});
			console.error(logstr, `failed to block ${user.legacy.name} (@${user.legacy.screen_name}):`, user, error);
		}
	});

	if (options.mute) {
		ajax.open('POST', "https://twitter.com/i/api/1.1/mutes/users/create.json");
	}
	else {
		ajax.open('POST', "https://twitter.com/i/api/1.1/blocks/create.json");
	}

	for (const header of Headers) {
		ajax.setRequestHeader(header, headers[header]);
	}

	// attempt to manually set the csrf token to the current active cookie
	const csrf = CsrfTokenRegex.exec(document.cookie);
	if (csrf) {
		ajax.setRequestHeader("x-csrf-token", csrf[1]);
	}
	else {
		// default to the request's csrf token
		ajax.setRequestHeader("x-csrf-token", headers["x-csrf-token"]);
	}
	ajax.send(formdata);
}

const blockableAffiliateLabels = new Set(["AutomatedLabel"]);
const blockableVerifiedTypes = new Set(["Business"]);
export function BlockBlueVerified(user, headers) {
	// since we can be fairly certain all user objects will be the same, break this into a separate function
	if (user.legacy.verified_type && !blockableVerifiedTypes.has(user.legacy.verified_type)) {
		return;
	}
	if (user.legacy.blocking) {
		return;
	}
	if (user.is_blue_verified) {	
		if (
			// group for block-following option
			!options.blockFollowing && (user.legacy.following || user.super_following)
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because you follow them.`);
		}
		else if (
			// group for block-followers option
			!options.blockFollowers && user.legacy.followed_by
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they follow you.`);
		}
		else if (
			// group for skip-verified option
			// TODO: look to see if there's some other way to check legacy verified
			options.skipVerified && (user.legacy.verified)
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they are verified through other means.`);
		}
		else if (
			// verified via an affiliated organisation instead of blue
			options.skipAffiliated && (blockableAffiliateLabels.has(user?.affiliates_highlighted_label?.label?.userLabelType) || user.legacy.verified_type === "Business")
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they are verified through an affiliated organisation.`);
		}
		else if (
			// verified by follower count
			options.skip1Mplus && user.legacy.followers_count > 1000000
		) {
			console.log(logstr, `did not block Twitter Blue verified user ${user.legacy.name} (@${user.legacy.screen_name}) because they have over a million followers and Elon is an idiot.`);
		}
		else {
			QueueBlockUser(user, String(user.rest_id), headers, ReasonBlueVerified);
		}
	}
	else if (options.blockNftAvatars && user.has_nft_avatar) {
		if (
			// group for block-following option
			!options.blockFollowing && (user.legacy.following || user.super_following)
		) {
			console.log(logstr, `did not block user with NFT avatar ${user.legacy.name} (@${user.legacy.screen_name}) because you follow them.`);
		}
		else if (
			// group for block-followers option
			!options.blockFollowers && user.legacy.followed_by
		) {
			console.log(logstr, `did not block user with NFT avatar ${user.legacy.name} (@${user.legacy.screen_name}) because they follow you.`);
		}
		else {
			QueueBlockUser(user, String(user.rest_id), headers, ReasonNftAvatar);
		}
	}
}
