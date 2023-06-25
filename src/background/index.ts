import { api, logstr, ReasonExternal, SoupcanExtensionId } from '../constants';
import { abbreviate, PopulateVerifiedDb } from '../utilities';
import { BlockQueue } from '../models/block_queue';

api.action.setBadgeBackgroundColor({ color: '#666' });
api.action.setBadgeTextColor({ color: '#fff' });

// TODO: change to message listener ?
api.storage.local.onChanged.addListener((items) => {
	if (items.hasOwnProperty('BlockCounter')) {
		api.action.setBadgeText({
			text: abbreviate(items.BlockCounter.newValue),
		});
	}
});

api.storage.sync.get({ skipVerified: false, suspendedBlockCollection: false, soupcan: false }).then(items => {
	// set initial extension state
	api.action.setIcon({ path: items.suspendedBlockCollection ? "/icon/icon-128-greyscale.png" : "/icon/icon-128.png" });
	if (items.skipVerified) {
		PopulateVerifiedDb();
	}
});

// populate verified db
api.storage.sync.onChanged.addListener((items) => {
	if (items.hasOwnProperty('skipVerified') && items.skipVerified.newValue) {
		PopulateVerifiedDb();
	}
});

const queue = new BlockQueue(api.storage.local);
const [errorStatus, successStatus] = ["ERROR", "SUCCESS"];
const [blockAction] = ["BLOCK"];
const allowedExtensionIds = new Set([SoupcanExtensionId]);

api.runtime.onMessageExternal.addListener(async (message, sender, respond) => {
	if (!allowedExtensionIds.has(sender?.id ?? "")) {
		return;
	}

	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	switch (message?.action) {
		case blockAction:
			// expected message format: { action, user_id: string, name: string, screen_name: string, reason: string }
			// TODO: figure out a better structure of user that only takes the things we need for blocking (name, handle)
			await queue.push({ user_id: message.user_id, user: { name: message.name, screen_name: message.screen_name }, reason: ReasonExternal, external_reason: message.reason });
			respond({ status: successStatus, message: "user queued for blocking" });
			break;

		default:
			console.error(logstr, "got a message that couldn't be handled from sender:", sender, message);
			respond({ status: errorStatus, message: "unknown action" });
	}
});
