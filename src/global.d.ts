/// <reference types="vite/client" />

interface Config {
	suspendedBlockCollection: boolean;
	showBlockPopups: boolean;
	toastsLocation: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	mute: boolean;
	blockFollowing: boolean;
	blockFollowers: boolean;
	skipFollowingQrts: boolean;
	skipBlueCheckmark: boolean;
	skipVerified: boolean;
	skipAffiliated: boolean;
	skip1Mplus: boolean;
	blockInterval: number;
	unblocked: { [k: string]: string? };
	popupTimer: number;
	skipFollowerCount: number;
	soupcanIntegration: boolean;
	blockPromoted: boolean;
	blockForUse: boolean;
	blockDisallowedWords: boolean;
	disallowedWords: string[];
	silenceNotifications: boolean;
}

interface CompiledConfig {
	suspendedBlockCollection: boolean;
	showBlockPopups: boolean;
	toastsLocation: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
	mute: boolean;
	blockFollowing: boolean;
	blockFollowers: boolean;
	skipFollowingQrts: boolean;
	skipBlueCheckmark: boolean;
	skipVerified: boolean;
	skipAffiliated: boolean;
	skip1Mplus: boolean;
	blockInterval: number;
	unblocked: { [k: string]: string? };
	popupTimer: number;
	skipFollowerCount: number;
	soupcanIntegration: boolean;
	blockPromoted: boolean;
	blockForUse: boolean;
	blockDisallowedWords: boolean;
	disallowedWords: RegExp | null;
	silenceNotifications: boolean;
}

interface BlueBlockerUser {
	__typename: 'User';
	is_blue_verified: boolean;
	rest_id: string;
	id: string;
	// TODO: verify affiliates_highlighted_label
	affiliates_highlighted_label?: {
		label?: {
			userLabelType?: string;
		};
	};
	core: {
		created_at: string;
		name: string;
		screen_name: string;
	};
	legacy: {
		blocking?: boolean;
		followed_by?: boolean;
		following?: boolean;
		name?: string;
		screen_name?: string;
		verified: boolean;
		verified_type?: string;
		followers_count: number;
		muting?: boolean;
		protected: boolean;
		can_dm: boolean;
		can_media_tag: boolean;
		created_at: string;
		default_profile: boolean;
		default_profile_image: boolean;
		description: string;
		entities: {
			description: {
				urls: string[];
			};
		};
		fast_followers_count: number;
		favourites_count: number;
		friends_count: number;
		has_custom_timelines: boolean;
		is_translator: boolean;
		listed_count: number;
		location: string;
		media_count: number;
		normal_followers_count: number;
		normal_followers_count: string[];
		possibly_sensitive: boolean;
		profile_banner_url: string;
		profile_banner_url_https: string;
		profile_interstitial_type: string;
		statuses_count: string;
		translator_type: string;
		want_retweets: boolean;
		withheld_in_countries: string[];
	};
	tipjar_settings?: {
		/* TODO: figure out what gets put here */
	};
	super_following?: boolean;
	has_graduated_access?: boolean;
	profile_image_shape?: string;
	promoted_tweet?: boolean;
	used_blue?: boolean;
	relationship_perspectives?: {
		following: boolean;
		followed_by?: boolean;
		blocking?: boolean;
		muting?: boolean;
	};
}

// extension message types
type SuccessStatus = 'SUCCESS';
type ErrorStatus = 'ERROR';
type MessageStatus = SuccessStatus | ErrorStatus;

interface RuntimeMessage {
	action: string;
	data: any;
}

interface RegisterRequest {
	action: 'register';
	name: string;
}

interface SuccessResponse {
	status: SuccessStatus;
	result: any;
}

interface ErrorResponse {
	status: ErrorStatus;
	message: string;
}

type MessageResponse = SuccessResponse | ErrorResponse;

interface ExternalBlockResponse {
	block: boolean;
	reason?: string;
}

interface BlueBlockerEvent {
	url: URL | string;
	parsedUrl: RegExpExecArray;
	body: XMLHttpRequestResponseType;
	request: { headers: { [k: string]: string } };
	status: number;
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

interface BlockUser {
	user_id: string;
	user: { name: string; screen_name: string };
	reason: number;
	external_reason?: string;
}

interface BlockedUser {
	user_id: string;
	user: { name: string; screen_name: string };
	reason: number;
	external_reason?: string;
	state: number;
	time: Date;
}

interface Integration {
	name: string;
	state: number;
}
