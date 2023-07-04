import { api, logstr, AddToHistoryAction, IsVerifiedAction, RemoveFromHistoryAction, SuccessStatus, HistoryStateBlocked } from "./constants";

export function abbreviate(value: number): string {
	if (value >= 995e7)
	{ return `${Math.round(value / 1e9)}B`; }
	if (value >= 9995e5)
	{ return `${(value / 1e9).toFixed(1)}B`; }
	if (value >= 995e4)
	{ return `${Math.round(value / 1e6)}M`; }
	if (value >= 9995e2)
	{ return `${(value / 1e6).toFixed(1)}M`; }
	if (value >= 9950)
	{ return `${Math.round(value / 1e3)}K`; }
	if (value >= 1e3)
	{ return `${(value / 1e3).toFixed(1)}K`; }
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
export const QueueId = (time: Date | null = null): number => epoch - ((time ?? new Date()).valueOf() + Math.random() * 1000);

export async function IsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	interface LegacyVerifiedResponse {
		status: "SUCCESS",
		result: boolean,
	}

	let response: LegacyVerifiedResponse | MessageResponse | null = null;
	for (let i = 0; i < 5; i++) {
		response = await api.runtime.sendMessage(
			{ action: IsVerifiedAction, data: { user_id, handle } },
		) as LegacyVerifiedResponse;
		if (response.status === SuccessStatus) {
			return (response as LegacyVerifiedResponse).result;
		}
	}

	if (response?.status !== SuccessStatus) {
		const message = "legacy verified db returned non-success status";
		console.error(logstr, message, response);
		throw new Error(message);
	}

	return (response as LegacyVerifiedResponse).result;
}

export async function AddUserBlockHistory(user: BlockUser, state: number = HistoryStateBlocked): Promise<void> {
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

	let response: MessageResponse | null = null;
	for (let i = 0; i < 5; i++) {
		const d = { action: AddToHistoryAction, data }
		response = await api.runtime.sendMessage(d) as MessageResponse;
		if (response.status === SuccessStatus) {
			return;
		}
	}

	if (response?.status !== SuccessStatus) {
		const message = "unable to add user to block history";
		console.error(logstr, message, response);
		throw new Error(message);
	}
}

export async function RemoveUserBlockHistory(user_id: string): Promise<void> {
	let response: MessageResponse | null = null;
	for (let i = 0; i < 5; i++) {
		response = await api.runtime.sendMessage({ action: RemoveFromHistoryAction, data: { user_id } }) as MessageResponse;
		if (response.status === SuccessStatus) {
			return;
		}
	}

	if (response?.status !== SuccessStatus) {
		const message = "unable to remove user from block history";
		console.error(logstr, message, response);
		throw new Error(message);
	}
}

export function FormatLegacyName(user: { name: string, screen_name: string }) {
	const legacyName = user?.name;
	const screenName = user?.screen_name;
	return `${legacyName} (@${screenName})`;
}

export function MakeToast(content: string, config: Config, options: { html?: boolean, warn?: boolean, error?: boolean, elements?: Array<HTMLElement> } = { }) {
	const ele = document.getElementById("injected-blue-block-toasts");
	if (!ele) {
		throw new Error("blue blocker was unable to create or find toasts div.");
	}

	const t = document.createElement("div");
	let popupTimer: number = 60e3;
	if (options?.error) {
		t.className = "toast error";
	} else if (options?.warn) {
		t.className = "toast warn";
	} else {
		t.className = "toast";
		popupTimer = config.popupTimer * 1000;
	}
	if (options?.html) {
		t.innerHTML = content;
	} else {
		t.innerText = content;
	}

	if (options?.elements) {
		options.elements.forEach(e => t.appendChild(e));
	}
	const close = document.createElement("a");
	close.innerText = "✕";
	close.className = "close";

	const timeout = setTimeout(() => ele.removeChild(t), popupTimer);
	close.onclick = () => {
		ele.removeChild(t);
		clearTimeout(timeout);
	};

	t.appendChild(close);
	ele.appendChild(t);
}

export function EscapeHtml(text: string): string {
	return new Option(text).innerHTML;
}
