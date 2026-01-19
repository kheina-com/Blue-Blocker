import {
	api,
	logstr,
	AddToHistoryAction,
	IsVerifiedAction,
	RemoveFromHistoryAction,
	SuccessStatus,
	PopFromQueueAction,
	AddToQueueAction,
	HistoryStateBlocked,
} from './constants';

export function abbreviate(value: number): string {
	if (value >= 995e7) {
		return `${Math.round(value / 1e9)}B`;
	}
	if (value >= 9995e5) {
		return `${(value / 1e9).toFixed(1)}B`;
	}
	if (value >= 995e4) {
		return `${Math.round(value / 1e6)}M`;
	}
	if (value >= 9995e2) {
		return `${(value / 1e6).toFixed(1)}M`;
	}
	if (value >= 9950) {
		return `${Math.round(value / 1e3)}K`;
	}
	if (value >= 1e3) {
		return `${(value / 1e3).toFixed(1)}K`;
	}
	return `${value}`;
}

export function commafy(x: number): string {
	// from https://stackoverflow.com/a/2901298
	let parts = x.toString().split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return parts.join('.');
}

// 64bit random number generator. I believe it's not truly 64 bit
// due to floating point bullshit, but it's good enough
const MaxId: number = Number.MAX_SAFE_INTEGER;
export const RefId = (): number => Math.round(Math.random() * MaxId);
const epoch: number = 2500000000000;
export const QueueId = (time: Date | null = null): number =>
	epoch - ((time ?? new Date()).valueOf() + Math.random() * 1000);

async function sendMessage<T extends MessageResponse>(
	message: RuntimeMessage,
	err: string,
): Promise<T> {
	const maxAttempts = 5;
	let attempt: number = 0;
	let response: MessageResponse | null = null;

	for (; ;) {
		response = await api.runtime.sendMessage<RuntimeMessage, MessageResponse>(message);
		if (response.status === SuccessStatus) {
			return response as T;
		}
		if (attempt < maxAttempts) {
			await new Promise(r => setTimeout(r, attempt ** 2 * 1000));
			attempt++;
		} else {
			break;
		}
	}

	console.error(logstr, err, response);
	throw new Error(err);
}

export async function IsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	interface LegacyVerifiedResponse {
		status: SuccessStatus;
		result: boolean;
	}

	const response = await sendMessage<LegacyVerifiedResponse>(
		{
			action: IsVerifiedAction,
			data: { user_id, handle },
		},
		'legacy verified db returned non-success status',
	);
	return response.result;
}

export async function AddUserBlockHistory(
	user: BlockUser,
	state: number = HistoryStateBlocked,
): Promise<void> {
	// we are explicitly redefining this in case there are extraneous fields included in user
	const data: BlockedUser = {
		user_id: user.user_id,
		user: {
			name: user.user.name,
			screen_name: user.user.screen_name,
		},
		reason: user.reason,
		time: new Date(),
		state,
	};

	if (user?.external_reason) {
		data.external_reason = user.external_reason;
	}

	await sendMessage(
		{
			action: AddToHistoryAction,
			data,
		},
		'unable to add user to block history',
	);
}

export async function RemoveUserBlockHistory(user_id: string): Promise<void> {
	await sendMessage(
		{
			action: RemoveFromHistoryAction,
			data: { user_id },
		},
		'unable to remove user from block history',
	);
}

export function FormatLegacyName(user: { name: string; screen_name: string }) {
	const legacyName = user?.name;
	const screenName = user?.screen_name;
	return `${legacyName} (@${screenName})`;
}

export function FormatBlueBlockerUser(user: BlueBlockerUser) {
	const username = getUserName(user);
	const screenName = getScreenName(user);
	return FormatLegacyName({
		name: username,
		screen_name: screenName,
	});
}

export function MakeToast(
	content: string,
	config: Config,
	options: {
		html?: false;
		warn?: boolean;
		error?: boolean;
		elements?: Array<HTMLElement>;
	} = {},
) {
	if (config.silenceNotifications) {
		return;
	}
	const ele = document.getElementById('injected-blue-block-toasts');
	if (!ele) {
		throw new Error('blue blocker was unable to create or find toasts div.');
	}

	const t = document.createElement('div');
	let popupTimer: number = 60e3;
	if (options?.error) {
		t.className = 'toast error';
	} else if (options?.warn) {
		t.className = 'toast warn';
	} else {
		t.className = 'toast';
		popupTimer = config.popupTimer * 1000;
	}
	t.innerText = content;

	if (options?.elements) {
		options.elements.forEach(e => t.appendChild(e));
	}
	const close = document.createElement('a');
	close.innerText = '✕';
	close.className = 'close';

	const timeout = setTimeout(() => ele.removeChild(t), popupTimer);
	close.onclick = () => {
		ele.removeChild(t);
		clearTimeout(timeout);
	};

	t.appendChild(close);
	ele.appendChild(t);
}

export function escapeRegExp(text: string) {
	// stolen straight from MDN, o7
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function EscapeHtml(unsafe: string): string {
	// Step 1, create an element
	const element = document.createElement('div');
	// Step 2, safely add text to the element
	element.textContent = unsafe;
	/**
	 * Step 3, let the browser handle turning "<", ">", and "&" into entities
	 * Using innerText here returns a string that doesn't use HTML entities, so we use innerHTML to get entities.
	 *
	 * If a browser engine cannot do this, it means that setting Element.textContent is unsafe...
	 */
	const partiallySafe = element.innerHTML;
	// Step 4, replace single and double quotes with entities so that the string can be added to attributes safely
	const safe = partiallySafe.replace(/'/g, '&#039;').replace(/"/g, '&quot;');

	return safe;
}

export async function QueuePop(): Promise<BlockUser | null> {
	interface PopFromQueueResponse {
		status: SuccessStatus;
		result: BlockUser | null;
	}

	const response = await sendMessage<PopFromQueueResponse>(
		{
			action: PopFromQueueAction,
			data: null,
		},
		'unable to pop user from queue',
	);
	return response.result;
}

export async function QueuePush(user: BlockUser): Promise<void> {
	await sendMessage(
		{
			action: AddToQueueAction,
			data: user,
		},
		'unable to push user to queue',
	);
}

export function UsernameElement(userName: string, screenName: string): HTMLParagraphElement {
	const p = document.createElement('p');
	const a = document.createElement('a');
	a.href = 'https://twitter.com/' + screenName;
	a.target = '_blank';
	a.textContent = '@' + screenName;
	p.appendChild(document.createTextNode(userName + ' ('));
	p.appendChild(a);
	p.appendChild(document.createTextNode(')'));
	return p;
}

export function getUserName(user: BlueBlockerUser) {
	const username = user?.legacy?.name || user?.core?.name;
	if (!username) {
		throw new Error(`Unable to get user name for user ${user.rest_id}`);
	}

	return username;
}

export function getScreenName(user: BlueBlockerUser) {
	const screen_name = user?.legacy?.screen_name || user?.core?.screen_name;
	if (!screen_name) {
		throw new Error(`Unable to get screen name for user ${user.rest_id}`);
	}

	return screen_name;
}

export function isFollowing(user: BlueBlockerUser): boolean {
	const following = user?.legacy?.following || user?.relationship_perspectives?.following;
	if (following === undefined) {
		throw new Error(`Unable to get following status for user ${user.rest_id}`); // if we can't determine following, throw an error. because one of these keys must exist.
	}

	return following;
}

export function isFollowedBy(user: BlueBlockerUser): boolean {
	return user?.legacy?.followed_by || user?.relationship_perspectives?.followed_by || false; // if we can't determine followed by, assume not followed by
}

export function isBlocking(user: BlueBlockerUser): boolean {
	return user?.legacy?.blocking || user?.relationship_perspectives?.blocking || false; // if we can't determine blocking, assume not blocking
}

export function isMuting(user: BlueBlockerUser): boolean {
	return user?.legacy?.muting || user?.relationship_perspectives?.muting || false; // if we can't determine muting, assume not muting
}
