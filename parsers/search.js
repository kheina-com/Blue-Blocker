import { BlockBlueVerified } from "../shared.js";
// This file handles requests made pertaining to search results.

export function HandleTypeahead(e, body) {
	// This endpoints appears to be extra/miscilaneous response data returned
	// when doing a search. it has a user list in it, so run it through the gamut!
	if (!body.users) {
		return;
	}

	// like the home timeline, another array of users! fun!
	for (const user of body.users) {
		BlockBlueVerified({
			is_blue_verified: user.ext_is_blue_verified,
			has_nft_avatar: user.ext_has_nft_avatar,
			legacy: {
				blocking: user?.is_blocked || false,
				followed_by: user.social_context.followed_by,
				following: user.social_context.following,
				name: user.name,
				screen_name: user.screen_name,
				verified: user.verified,
				verified_type: user?.ext_verified_type,
				followers_count: 1e10, // since we don't have this info, just put in a really large number for the option
			},
			super_following: false, // meh
			rest_id: user.id_str,
		}, e.detail.request.headers)
	}
}
