import { api, logstr } from '../constants';
import { MakeToast } from '../utilities';
import { UnblockCache } from '../shared';

export function HandleUnblock(
	e: CustomEvent<BlueBlockerEvent>,
	body: any,
	config: Config,
) {
	if (body?.id_str === undefined || body?.screen_name === undefined) {
		console.error(logstr, "got and unknown or mangled response from an unblock request:", body);
		MakeToast("couldn't parse unblock response", config);
		return;
	}

	const user_id = String(body.id_str);
	if (UnblockCache.has(user_id)) {
		return;
	}

	UnblockCache.add(user_id);
	const unblocked = config.unblocked;
	unblocked[user_id] = body.screen_name;
	api.storage.sync.set({ unblocked }).then(() => MakeToast(`okay, @${body.screen_name} won't be blocked again.`, config));
}
