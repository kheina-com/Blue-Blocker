let _api: {
	action: typeof chrome.action | typeof browser.browserAction;
	runtime: typeof chrome.runtime;
	storage: typeof chrome.storage | typeof browser.storage;
};
try {
	_api = {
		// @ts-ignore
		runtime: browser.runtime,
		storage: browser.storage,
		action: browser.browserAction,
	};
} catch (ReferenceError) {
	_api = chrome;
}
export const api = _api;
export const logstr: string = '[Blue Blocker]';
export const DefaultOptions: Config = {
	// by default, spare as many people as possible
	// let the user decide if they want to be stricter
	suspendedBlockCollection: false,
	toastsLocation: 'bottom-left',
	showBlockPopups: true,
	mute: false,
	blockFollowing: false,
	blockFollowers: false,
	skipBlueCheckmark: false,
	skipVerified: true,
	skipAffiliated: true,
	skip1Mplus: true,
	blockInterval: 15,
	popupTimer: 30,
	skipFollowerCount: 1e6,
	soupcanIntegration: false,
	blockPromoted: false,
	disallowedWords: [],

	// this isn"t set, but is used
	// TODO: when migrating to firefox manifest v3, check to see if sets can be stored yet
	unblocked: {},
	blockForUse: false,
};
export const Headers = [
	// set by function:
	// "content-type",
	// "content-length",
	// "x-csrf-token",  // this is a special one with special logic
	// set by fetch:
	// "host",
	// "origin",
	// "referer",
	// "connection",
	// "keep-alive",
	// loaded from requests:
	'accept',
	'accept-encoding',
	'accept-language',
	'authorization',
	'sec-ch-ua',
	'sec-ch-ua-mobile',
	'sec-ch-ua-platform',
	'sec-fetch-dest',
	'sec-fetch-mode',
	'sec-fetch-site',
	'user-agent',
	'x-client-uuid',
	'x-twitter-active-user',
	'x-twitter-auth-type',
	'x-twitter-client-language',
];
export const [HistoryStateBlocked, HistoryStateUnblocked, HistoryStateGone] = [0, 1, 2];
export const ReasonExternal: number = -1;
export const ReasonBlueVerified: number = 0;
export const ReasonNftAvatar: number = 1;
export const ReasonBusinessVerified: number = 2;
export const ReasonTransphobia: number = 3;
export const ReasonPromoted: number = 4;
export const ReasonDisallowedWordsOrEmojis: number = 5;
export const ReasonMap = {
	[ReasonBlueVerified]: 'Twitter Blue verified',
	[ReasonNftAvatar]: 'NFT avatar',
	[ReasonBusinessVerified]: 'Twitter Business verified',
	[ReasonTransphobia]: 'transphobia',
	[ReasonPromoted]: 'promoting tweets',
	[ReasonDisallowedWordsOrEmojis]: 'disallowed words or emojis',
};

export const emojiRegExp = RegExp(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/, 'g')

export const LegacyVerifiedUrl: string =
	'https://gist.githubusercontent.com/travisbrown/b50d6745298cccd6b1f4697e4ec22103/raw/012009351630dc351e3a763b49bf24fa50ca3eb7/legacy-verified.csv';
export const Browser =
	api.runtime.getManifest()?.browser_specific_settings?.gecko === undefined
		? 'chrome'
		: 'firefox';
export const SoupcanExtensionId =
	Browser === 'chrome' ? 'hcneafegcikghlbibfmlgadahjfckonj' : 'soupcan@beth.lgbt';

// internal message actions
export const [IsVerifiedAction, AddToHistoryAction, RemoveFromHistoryAction, AddToQueueAction, PopFromQueueAction] = [
	'is_verified',
	'add_user_to_history',
	'remove_user_from_history',
  'add_user_to_queue', 'pop_user_from_queue'
];
export const SuccessStatus: SuccessStatus = 'SUCCESS';
export const ErrorStatus: ErrorStatus = 'ERROR';

// multi-tab event keys
export const EventKey = 'MultiTabEvent';
export const ErrorEvent = 'ErrorEvent';
export const MessageEvent = 'MessageEvent';

export const IntegrationStateDisabled = 0;
export const IntegrationStateReceiveOnly= 1;
export const IntegrationStateSendAndReceive = 2;
export const IntegrationStateSendOnly = 3;
