// This file handles requests made pertaining to search results.

export function HandleTypeahead(e, body) {
	// This endpoints appears to be extra/miscilaneous response data returned
	// when doing a search. it has a user list in it, so run it through the gamut!

	// like the home timeline, another array of users! fun!
	for (const user of body.users) {
		console.log(user);
	}
}

export function HandleAdaptive(e, body) {
	const users = body?.globalObjects?.users;
	for (const [user_id, user] of Object.entries(body.globalObjects.users)) {
		console.log(user_id, user);
	}
}
