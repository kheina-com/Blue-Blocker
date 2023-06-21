import { api, logstr, ReasonExternal } from '../constants';
import { abbreviate, PopulateVerifiedDb } from '../utilities';
import { BlockQueue } from '../models/block_queue';

api.action.setBadgeBackgroundColor({ color: '#666' });
api.action.setBadgeTextColor({ color: '#fff' });

api.storage.local.onChanged.addListener((items) => {
	if (items.hasOwnProperty('BlockCounter')) {
		api.action.setBadgeText({
			text: abbreviate(items.BlockCounter.newValue),
		});
	}
});

// populate verified db
api.storage.sync.onChanged.addListener((items) => {
	if (items.hasOwnProperty('skipVerified') && items.skipVerified.newValue) {
		PopulateVerifiedDb();
	}
});
api.storage.sync.get({ skipVerified: false }).then(items => {
	if (items.skipVerified) {
		PopulateVerifiedDb();
	}
});

const queue = new BlockQueue(api.storage.local);
const [errorStatus, successStatus] = ["ERROR", "SUCCESS"];
const [blockAction] = ["BLOCK"];

api.runtime.onMessageExternal.addListener(async (message, sender, respond) => {
	// messages are ALWAYS expected to be:
	// 	1. objects
	// 	2. contain a string value stored under message.action. should be one defined above
	// other message contents change based on the defined action
	switch (message?.action) {
		case blockAction:
			// expected message format: { action, user_id: string, name: string, screen_name: string, reason: string }
			await queue.push({ user_id: message.user_id, user: { name: message.name, screen_name: message.screen_name }, reason: ReasonExternal });
			respond({ status: successStatus, message: "user queued for blocking" });
			break;

		default:
			console.error(logstr, "got a message that couldn't be handled from sender:", sender, message);
			respond({ status: errorStatus, message: "unknown action" })
	}
});
