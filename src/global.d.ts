/// <reference types="vite/client" />

interface Config {
	suspendedBlockCollection: boolean,
	showBlockPopups: boolean,
	mute: boolean,
	blockFollowing: boolean,
	blockFollowers: boolean,
	skipVerified: boolean,
	skipAffiliated: boolean,
	skip1Mplus: boolean,
	blockNftAvatars: boolean,
	blockInterval: number,
	unblocked: { [k: string]: null },
	popupTimer: number,
}

interface BlueBlockerUser {
	is_blue_verified: boolean;
	has_nft_avatar: boolean;
	profile_image_shape: string;
	// TODO: verify affiliates_highlighted_label
	affiliates_highlighted_label?: {
		label?: {
			userLabelType?: string;
		};
	};
	legacy: {
		blocking: boolean;
		followed_by: boolean;
		following: boolean;
		name: string;
		screen_name: string;
		verified: boolean;
		verified_type?: string;
		followers_count: number;
	};
	super_following: boolean;
	rest_id: string;
}

interface BlueBlockerEvent {
	url: URL | string;
	parsedUrl: RegExpExecArray;
	body: XMLHttpRequestResponseType;
	request: { headers: any };
}

interface CustomEventMap {
	'blue-blocker-event': CustomEvent<BlueBlockerEvent>;
}

// https://stackoverflow.com/a/68783088/5808621
// https://github.com/microsoft/TypeScript/issues/28357#issuecomment-1493069662
interface Document {
	addEventListener<K extends keyof CustomEventMap>(
		type: K,
		listener: (this: Document, ev: CustomEventMap[K]) => void,
	): void;
	dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): void;
}

interface BlueBlockerXLMRequest extends XMLHttpRequest {
	_method: string;
	_url: string;
	_requestHeaders: any;
	_startTime: string;
}
