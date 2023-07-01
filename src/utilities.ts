import { logstr, AddToHistoryAction, IsVerifiedAction, RemoveFromHistoryAction, SuccessStatus } from "./constants";

export function abbreviate(value: number): string {
	if (value >= 1e10)
	{ return `${Math.round(value / 1e9)}B`; }
	if (value >= 9995e5)
	{ return `${(value / 1e9).toFixed(1)}B`; }
	if (value >= 1e7)
	{ return `${Math.round(value / 1e6)}M`; }
	if (value >= 9995e2)
	{ return `${(value / 1e6).toFixed(1)}M`; }
	if (value >= 1e4)
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
const MaxId: number = 0xffffffffffffffff;
export const RefId = (): number => Math.round(Math.random() * MaxId);

export async function IsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	const response = await chrome.runtime.sendMessage(
		{ action: IsVerifiedAction, user_id, handle },
	) as { status: string, result: boolean };

	if (response?.status !== SuccessStatus) {
		const message = "legacy verified db returned non-success status";
		console.error(logstr, message, response);
		throw new Error(message);
	}

	return response.result;
}

export async function AddUserBlockHistory(user: BlockUser): Promise<void> {
	const response = await chrome.runtime.sendMessage({ action: AddToHistoryAction, data: user }) as { status: string, result: null };

	if (response?.status !== SuccessStatus) {
		const message = "unable to add user to block history";
		console.error(logstr, message, response);
		throw new Error(message);
	}
}

export async function RemoveUserBlockHistory(user_id: string): Promise<void> {
	const response = await chrome.runtime.sendMessage({ action: RemoveFromHistoryAction, data: { user_id } }) as { status: string, result: null };

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

export function MakeToast(content: string, config: Config, options: { html?: boolean, error?: boolean, elements?: Array<HTMLElement> } = { }) {
	const ele = document.getElementById("injected-blue-block-toasts");
	if (!ele) {
		throw new Error("blue blocker was unable to create or find toasts div.");
	}

	const t = document.createElement("div");
	let popupTimer: number;
	if (options?.error) {
		t.className = "toast error";
		popupTimer = 60e3;
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
