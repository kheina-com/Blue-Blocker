import { BlockBlueVerified } from '../shared';
// This file handles requests made pertaining to search results.

export function HandleTypeahead(e: CustomEvent<BlueBlockerEvent>, body: Body, config: Config) {
	// This endpoints appears to be extra/miscellaneous response data returned
	// when doing a search. it has a user list in it, so run it through the gamut!
	if (!body?.users?.length) {
		return;
	}

	// like the home timeline, another array of users! fun!
	for (const user of body.users) {
		BlockBlueVerified(
			{
				is_blue_verified: user.ext_is_blue_verified,
				legacy: {
					blocking: user?.is_blocked || false,
					followed_by: user?.social_context.followed_by || false,
					following: user?.social_context.following || false,
					name: user.name,
					screen_name: user.screen_name,
					verified: user.verified,
					verified_type: user?.ext_verified_type || '',
					followers_count: 1e10, // since we don't have this info, just put in a really large number for the option
				},
				super_following: false, // meh
				rest_id: user.id_str,
			} as BlueBlockerUser,
			config,
		);
	}
}

interface Body {
	num_results: number;
	users: TwitterUser[];
	topics: any[];
	events: any[];
	lists: any[];
	ordered_sections: any[];
	oneclick: any[];
	hashtags: any[];
	completed_in: number;
	query: string;
}

interface TwitterUser {
	id: number;
	id_str: string;
	verified: boolean;
	ext_is_blue_verified: boolean;
	badges: {
		badge_url: string;
		badge_type: string;
		description: string;
	}[];
	is_dm_able: boolean;
	is_blocked: boolean;
	can_media_tag: boolean;
	name: string;
	screen_name: string;
	profile_image_url: string;
	profile_image_url_https: string;
	location: string;
	is_protected: boolean;
	rounded_score: number;
	social_proof: number;
	connecting_user_count: number;
	connecting_user_ids: any[];
	social_proofs_ordered: any[];
	social_context: {
		following: boolean;
		followed_by: boolean;
	};
	tokens: any[];
	inline: boolean;
	ext_verified_type?: boolean;
}
