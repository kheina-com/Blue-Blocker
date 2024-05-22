import { BlockBlueVerified } from '../shared';
// This file handles any requests made to populate twitter's main timeline
// including the "For You" page as well as the "Following" page. it also
// seems to work for the "adaptive.json" response from search results

export function HandleForYou(e: CustomEvent<BlueBlockerEvent>, body: Body, config: CompiledConfig) {
	// This API endpoint currently does not deliver information required for
	// block filters (in particular, it's missing affiliates_highlighted_label).
	// The above doesn't seem completely true. it's missing affiliates specifically
	// but, it's not missing verified_type, which says "Business" when using a
	// gold (affiliate) checkmark.

	// so this url straight up gives us an array of users, so just use that lmao
	for (const [user_id, user] of Object.entries(body.globalObjects.users)) {
		// the user object is a bit different, so reshape it a little
		BlockBlueVerified(
			{
				is_blue_verified: user.ext_is_blue_verified,
				legacy: {
					blocking: user.blocking,
					followed_by: user.followed_by,
					following: user.following,
					name: user.name,
					screen_name: user.screen_name,
					verified: user.verified,
					verified_type: user?.ext_verified_type || '',
					followers_count: user.followers_count,
				},
				super_following: user.ext?.superFollowMetadata?.r?.ok?.superFollowing,
				rest_id: user_id,
			} as BlueBlockerUser,
			config,
		);
	}
}

interface Body {
	globalObjects: {
		users: {
			[id: string]: TwitterUser;
		};
		moments: object;
		cards: object;
		places: object;
		media: object;
		broadcasts: object;
		topics: object;
		lists: object;
	};
}

interface TwitterUser {
	id: number;
	id_str: string;
	name: string;
	screen_name: string;
	location: string;
	description: string;
	ext_verified_type?: string;
	url?: string;
	entities: {
		description: {
			urls?: any[];
		};
	};
	protected: boolean;
	followers_count: number;
	fast_followers_count: number;
	normal_followers_count: number;
	friends_count: number;
	listed_count: number;
	created_at: string;
	favourites_count: number;
	utc_offset?: any;
	time_zone?: any;
	geo_enabled: boolean;
	verified: boolean;
	statuses_count: number;
	media_count: number;
	lang?: any;
	contributors_enabled: boolean;
	is_translator: boolean;
	is_translation_enabled: boolean;
	profile_background_color: string;
	profile_background_image_url: string;
	profile_background_image_url_https: string;
	profile_background_tile: boolean;
	profile_image_url: string;
	profile_image_url_https: string;
	profile_banner_url: string;
	profile_link_color: string;
	profile_sidebar_border_color: string;
	profile_sidebar_fill_color: string;
	profile_text_color: string;
	profile_use_background_image: boolean;
	has_extended_profile: boolean;
	default_profile: boolean;
	default_profile_image: boolean;
	pinned_tweet_ids: number[];
	pinned_tweet_ids_str: string[];
	has_custom_timelines: boolean;
	can_dm: boolean;
	can_media_tag: boolean;
	following: boolean;
	follow_request_sent: boolean;
	notifications: boolean;
	muting: boolean;
	blocking: boolean;
	blocked_by: boolean;
	want_retweets: boolean;
	advertiser_account_type: string;
	advertiser_account_service_levels: string[];
	profile_interstitial_type: string;
	business_profile_state: string;
	translator_type: string;
	withheld_in_countries?: any[];
	followed_by: boolean;
	ext_is_blue_verified: boolean;
	ext: {
		highlightedLabel: {
			r: {
				ok: object;
			};
			ttl: number;
		};
		superFollowMetadata: {
			r: {
				ok: {
					superFollowEligible: boolean;
					superFollowing: boolean;
					superFollowedBy: boolean;
					exclusiveTweetFollowing: boolean;
					privateSuperFollowing: boolean;
				};
			};
			ttl: number;
		};
	};
	require_some_consent: boolean;
}
