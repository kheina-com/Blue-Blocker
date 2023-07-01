import { api, logstr, AddToHistoryAction, ErrorStatus, IsVerifiedAction, MessageStatus, ReasonExternal, RemoveFromHistoryAction, SoupcanExtensionId, SuccessStatus, DefaultOptions } from '../constants';
import { abbreviate } from '../utilities';
import { AddUserToHistory, CheckDbIsUserLegacyVerified, ConnectHistoryDb, PopulateVerifiedDb, RemoveUserFromHistory } from './db';
import { BlockQueue } from '../models/block_queue';

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

ConnectHistoryDb();

interface Response {
	status: MessageStatus,
}

interface SuccessResponse {
	status: "SUCCESS",
	result: any,
}

interface ErrorResponse {
	status: "ERROR",
	message: string,
	error?: Error,
}

api.runtime.onMessage.addListener((m, s, r) => { (async (_message, sender, respond) => {
	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	let response: Response;
	switch (_message?.action) {
		case IsVerifiedAction:
			const verifiedMessage = _message as { user_id: string, handle: string };
			try {
				const isVerified = await CheckDbIsUserLegacyVerified(verifiedMessage.user_id, verifiedMessage.handle);
				response = { status: SuccessStatus, result: isVerified } as SuccessResponse;
			} catch (e) {
				response = { status: ErrorStatus, message: "unknown error", error: e } as ErrorResponse;
			}
			break;

		case AddToHistoryAction:
			const historyMessage = _message.data as BlockUser;
			try {
				await AddUserToHistory(historyMessage);
				response = { status: SuccessStatus, result: null } as SuccessResponse;
			} catch (e) {
				response = { status: ErrorStatus, message: "unknown error", error: e } as ErrorResponse;
			}
			break;

		case RemoveFromHistoryAction:
			const removeMessage = _message.data as { user_id: string };
			try {
				await RemoveUserFromHistory(removeMessage.user_id);
				response = { status: SuccessStatus, result: null } as SuccessResponse;
			} catch (e) {
				response = { status: ErrorStatus, message: "unknown error", error: e } as ErrorResponse;
			}
			break;

		default:
			console.error(logstr, "got a message that couldn't be handled from sender:", sender, _message);
			response = { status: ErrorStatus, message: "unknown action" } as ErrorResponse;
	}
	respond(response);
})(m, s, r); return true });

////////////////////////////////////////////////// EXTERNAL MESSAGE HANDLING //////////////////////////////////////////////////

const queue = new BlockQueue(api.storage.local);
const [blockAction] = ["BLOCK"];
const allowedExtensionIds = new Set([SoupcanExtensionId]);

api.runtime.onMessageExternal.addListener((m, s, r) => { (async (_message, sender, respond) => {
	if (!allowedExtensionIds.has(sender?.id ?? "")) {
		return;
	}

	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	let response: Response;
	switch (_message?.action) {
		case blockAction:
			const message = _message as { action: string, user_id: string, name: string, screen_name: string, reason: string };
			try {
				await queue.push({ user_id: message.user_id, user: { name: message.name, screen_name: message.screen_name }, reason: ReasonExternal, external_reason: message.reason });
				response = { status: SuccessStatus, result: "user queued for blocking" } as SuccessResponse;
			} catch (e) {
				response = { status: ErrorStatus, message: "unknown error", error: e } as ErrorResponse;
			}
			break;

		default:
			console.error(logstr, "got a message that couldn't be handled from sender:", sender, _message);
			response = { status: ErrorStatus, message: "unknown action" } as ErrorResponse;
	}
	respond(response);
})(m, s, r); return true });
