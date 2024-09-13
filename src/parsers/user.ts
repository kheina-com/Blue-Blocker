import { logstr } from '../constants';
import { BlockBlueVerified } from '../shared';

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
