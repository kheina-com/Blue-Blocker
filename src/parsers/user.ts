import { logstr } from '../constants';
import { BlockBlueVerified } from '../shared';

const keyTranslations = [
	['is_blue_verified', 'ext_is_blue_verified'],
	['rest_id', 'id_str'],
	['id', 'id_str'],
	['affiliates_highlighted_label', 'ext_highlighted_label'],
	['is_blue_verified', 'ext_is_blue_verified'],
];

function TranslateUserObject(obj: RecommendationUser) {
	let newUserObj = {
		__typename: 'User',
	} as { [k: string]: any };

	// Pull together a normal object
	for (const t of keyTranslations) {
		if (obj?.[t[1]] == undefined) {
			console.log(logstr, `object missing key: ${t[1]}`);
			return;
		}

		newUserObj[t[0]] = obj[t[1]];
	}

	// Do a little Russian doll thing idk
	newUserObj.legacy = obj;
	return newUserObj as BlueBlockerUser;
}

export function HandleRecommendations(
	e: CustomEvent<BlueBlockerEvent>,
	body: any,
	config: CompiledConfig,
) {
	if (!Array.isArray(body)) {
		console.log(logstr, 'recommendations are not an array');
		return;
	}

	for (const obj of body) {
		// This is actually the legacy part of a user object >:(
		let userObj = obj.user as RecommendationUser | undefined;

		if (!userObj) {
			console.log(logstr, 'no user object');
			continue;
		}

		const userTranslated = TranslateUserObject(userObj);
		if (userTranslated !== undefined) {
			BlockBlueVerified(userTranslated, config);
		}
	}
}

interface RecommendationUser {
	ext_is_blue_verified: boolean;
	id_str: string;
	ext_highlighted_label: {
		label?: {
			userLabelType?: string;
		};
	};
	[k: string]: any;
}

export function HandleUserByScreenName(
	e: CustomEvent<BlueBlockerEvent>,
	body: any,
	config: CompiledConfig,
) {
	let obj = body?.data?.user?.result;

	let userObj = obj.user_results?.result;
	if (!userObj) {
		console.log(logstr, 'empty user result');
		return;
	}

	if (userObj.__typename === 'UserUnavailable') {
		console.log(logstr, 'user is unavailable', userObj);
		return;
	}

	if (userObj.__typename !== 'User') {
		console.error(logstr, 'could not parse user object', userObj);
		return;
	}

	BlockBlueVerified(obj.user_results.result, config);
}
