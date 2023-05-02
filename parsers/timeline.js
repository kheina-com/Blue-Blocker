import { BlockBlueVerified } from "../shared.js";
// This file handles any requests made to populate twitter's main timeline
// including the "For You" page as well as the "Following" page. it also
// seems to work for the "adaptive.json" response from search results

export function HandleForYou(e, body) {
	// This API endpoint currently does not deliver information required for
	// block filters (in particular, it's missing affiliates_highlighted_label).
	// The above doesn't seem completely true. it's missing affiliates specifically
	// but, it's not missing verified_type, which says "Business" when using a
	// gold (affiliate) checkmark.

	// so this url straight up gives us an array of users, so just use that lmao
	for (const [user_id, user] of Object.entries(body.globalObjects.users)) {
		// the user object is a bit different, so reshape it a little
		BlockBlueVerified({
			is_blue_verified: user.ext_is_blue_verified,
			has_nft_avatar: user.ext_has_nft_avatar,
			legacy: {
				blocking: user.blocking,
				followed_by: user.followed_by,
				following: user.following,
				name: user.name,
				screen_name: user.screen_name,
				verified: user.verified,
				verified_type: user.ext_verified_type,
				followers_count: user.followers_count,
			},
			super_following: user.ext?.superFollowMetadata?.r?.ok?.superFollowing,
			rest_id: user_id,
		}, e.detail.request.headers)
	}
}
