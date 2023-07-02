import { api, logstr, AddToHistoryAction, ErrorStatus, IsVerifiedAction, ReasonExternal, RemoveFromHistoryAction, SoupcanExtensionId, SuccessStatus, DefaultOptions, OldTwitterExtensionId } from '../constants';
import { abbreviate, RefId } from '../utilities';
import { AddUserToHistory, CheckDbIsUserLegacyVerified, ConnectDb, PopulateVerifiedDb, RemoveUserFromHistory } from './db';
import { BlockQueue } from '../models/block_queue';
import { HandleTwitterApiResponse } from "../parsers/request.js";

api.action.setBadgeBackgroundColor({ color: "#666" });
if (api.action.hasOwnProperty("setBadgeTextColor")) {
	// setBadgeTextColor requires chrome 110+
	api.action.setBadgeTextColor({ color: "#fff" });
}

// TODO: change to message listener ?
api.storage.local.onChanged.addListener((items) => {
	if (items.hasOwnProperty("BlockCounter")) {
		api.action.setBadgeText({
			text: abbreviate(items.BlockCounter.newValue),
		});
	}
});

api.storage.sync.get(DefaultOptions).then(async items => {
	// set initial extension state
	api.action.setIcon({ path: items.suspendedBlockCollection ? "/icon/icon-128-greyscale.png" : "/icon/icon-128.png" });
	if (items.skipVerified) {
		await PopulateVerifiedDb();
	}
});

// populate verified db
api.storage.sync.onChanged.addListener(async items => {
	if (
		items.hasOwnProperty('skipVerified') &&
		items.skipVerified.oldValue === false &&
		items.skipVerified.newValue === true
	) {
		await PopulateVerifiedDb();
	}
});

ConnectDb();

api.runtime.onMessage.addListener((m, s, r) => { let response: MessageResponse; (async (message: RuntimeMessage, sender) => {
	const refid = RefId();
	console.debug(logstr, refid, "recv:", message, sender);
	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	try {
		switch (message?.action) {
			case IsVerifiedAction:
				const verifiedMessage = message.data as { user_id: string, handle: string };
				const isVerified = await CheckDbIsUserLegacyVerified(verifiedMessage.user_id, verifiedMessage.handle);
				response = { status: SuccessStatus, result: isVerified } as SuccessResponse;
				break;

			case AddToHistoryAction:
				const historyMessage = message.data as BlockedUser;
				await AddUserToHistory(historyMessage);
				response = { status: SuccessStatus, result: null } as SuccessResponse;
				break;

			case RemoveFromHistoryAction:
				const removeMessage = message.data as { user_id: string };
				await RemoveUserFromHistory(removeMessage.user_id);
				response = { status: SuccessStatus, result: null } as SuccessResponse;
				break;

			default:
				console.error(logstr, refid, "got a message that couldn't be handled from sender:", sender, message);
				response = { status: ErrorStatus, message: "unknown action" } as ErrorResponse;
		}
	} catch (_e) {
		const e = _e as Error;
		console.error(logstr, refid, "unexpected error caught during", message?.action, "action", e);
		response = { status: ErrorStatus, message: e.message ?? "unknown error" } as ErrorResponse;
	}
	console.debug(logstr, refid, "respond:", response);
})(m, s).finally(() => r(response)); return true });

////////////////////////////////////////////////// EXTERNAL MESSAGE HANDLING //////////////////////////////////////////////////

const queue = new BlockQueue(api.storage.local);
const [blockAction, twitterApiResponseAction] = ["BLOCK", "twitter_api_response"];
const allowedExtensionIds = new Set([SoupcanExtensionId, OldTwitterExtensionId]);

api.runtime.onMessageExternal.addListener((m, s, r) => { let response: MessageResponse; (async (message, sender) => {
	const refid = RefId();
	console.debug(logstr, refid, "ext recv:", message, sender);
	if (!allowedExtensionIds.has(sender?.id ?? "")) {
		return;
	}

	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	try {
		switch (message?.action) {
			case blockAction:
				const blockMessage = message as { user_id: string, name: string, screen_name: string, reason: string };
				const user: BlockUser = { user_id: blockMessage.user_id, user: { name: blockMessage.name, screen_name: blockMessage.screen_name }, reason: ReasonExternal, external_reason: blockMessage.reason };
				await queue.push(user);
				response = { status: SuccessStatus, result: "user queued for blocking" } as SuccessResponse;
				break;

			case twitterApiResponseAction:
				const twitterApiResponse = message.data as TwitterApiResponse;
				response = { status: SuccessStatus, result: "ack" } as SuccessResponse;
				// run this async so that we don't wait to ack since we never want to error
				(async () => HandleTwitterApiResponse(message))().catch(e => console.error(logstr, e));
				break;

			default:
				console.error(logstr, refid, "got a message that couldn't be handled from sender:", sender, message);
				response = { status: ErrorStatus, message: "unknown action" } as ErrorResponse;
		}
	} catch (_e) {
		const e = _e as Error;
		console.error(logstr, refid, "unexpected error caught during", message?.action, "action", e);
		response = { status: ErrorStatus, message: e.message ?? "unknown error" } as ErrorResponse;
	}
	console.debug(logstr, refid, "respond:", response);
})(m, s).finally(() => r(response)); return true });
