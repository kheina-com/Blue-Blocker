let _api: typeof chrome | typeof browser;
try {
  _api = browser;
  // manifest v2 has the action api stored in browserAction, so manually assign it to action
  _api.action = browser.browserAction;
} catch (ReferenceError) {
  _api = chrome;
}
export const api = _api;
export const logstr: string = '[Blue Blocker]';
export const DefaultOptions: Config = {
  // by default, spare as many people as possible
  // let the user decide if they want to be stricter
  suspendedBlockCollection: false,
  showBlockPopups: true,
  mute: false,
  blockFollowing: false,
  blockFollowers: false,
  skipVerified: true,
  skipAffiliated: true,
  skip1Mplus: true,
  blockNftAvatars: false,
  blockInterval: 15,

  // this isn't set, but is used
  // TODO: when migrating to firefox manifest v3, check to see if sets can be stored yet
  unblocked: {},
};
export const Headers = [
  'authorization',
  'x-twitter-active-user',
  'x-twitter-auth-type',
  'x-twitter-client-language',
];
export const ReasonBlueVerified: number = 0;
export const ReasonNftAvatar: number = 1;
export const ReasonBusinessVerified: number = 2;
export const ReasonMap = {
  [ReasonBlueVerified]: 'Twitter Blue verified',
  [ReasonNftAvatar]: 'NFT avatar',
  [ReasonBusinessVerified]: 'Twitter Business verified',
};
export const LegacyVerifiedUrl: string = 'https://gist.githubusercontent.com/travisbrown/b50d6745298cccd6b1f4697e4ec22103/raw/012009351630dc351e3a763b49bf24fa50ca3eb7/legacy-verified.csv';
