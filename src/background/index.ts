import { api, logstr, ErrorStatus, IsVerifiedAction, ReasonExternal, SoupcanExtensionId, SuccessStatus, DefaultOptions } from '../constants';
import { abbreviate, CheckDbIsUserLegacyVerified, PopulateVerifiedDb } from '../utilities';
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
	if (items.hasOwnProperty('skipVerified') && items.skipVerified.newValue) {
		await PopulateVerifiedDb();
	}
});

api.runtime.onMessage.addListener((m, s, r) => { (async (_message, sender, respond) => {
	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	switch (_message?.action) {
		case IsVerifiedAction:
			const message = _message as { action: string, user_id: string, handle: string };
			try {
				const isVerified = await CheckDbIsUserLegacyVerified(message.user_id, message.handle);
				const response = { status: SuccessStatus, result: isVerified };
				respond(response);
			} catch (e) {
				const response = { status: ErrorStatus, message: "unknown error", error: e };
				respond(response);
			}
			break;

		default:
			console.error(logstr, "got a message that couldn't be handled from sender:", sender, _message);
			const response = { status: ErrorStatus, message: "unknown action", error: null };
			respond(response);
	}
	return true;
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
	switch (_message?.action) {
		case blockAction:
			const message = _message as { action: string, user_id: string, name: string, screen_name: string, reason: string };
			try {
				await queue.push({ user_id: message.user_id, user: { name: message.name, screen_name: message.screen_name }, reason: ReasonExternal, external_reason: message.reason });
				const response = { status: SuccessStatus, message: "user queued for blocking" };
				respond(response);
			} catch (e) {
				const response = { status: ErrorStatus, message: "unknown error", error: e };
				respond(response);
			}
			return;

		default:
			console.error(logstr, "got a message that couldn't be handled from sender:", sender, _message);
			const response = { status: ErrorStatus, message: "unknown action", error: null };
			respond(response);
		}
})(m, s, r); return true });
