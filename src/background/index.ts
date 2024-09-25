import {
	api,
	logstr,
	AddToHistoryAction,
	ErrorStatus,
	IsVerifiedAction,
	ReasonExternal,
	RemoveFromHistoryAction,
	SuccessStatus,
	DefaultOptions,
	AddToQueueAction,
	PopFromQueueAction,
	IntegrationStateSendAndReceive,
	IntegrationStateDisabled,
	IntegrationStateSendOnly,
	EventKey,
	MessageEvent,
} from '../constants';
import { abbreviate, RefId } from '../utilities';
import {
	AddUserToHistory,
	AddUserToQueue,
	CheckDbIsUserLegacyVerified,
	ConnectDb,
	PopUserFromQueue,
	PopulateVerifiedDb,
	RemoveUserFromHistory,
} from './db';

api.action.setBadgeBackgroundColor({ color: '#666' });
if (api.action.hasOwnProperty('setBadgeTextColor')) {
	// setBadgeTextColor requires chrome 110+
	api.action.setBadgeTextColor({ color: '#fff' });
}

// TODO: change to message listener ?
api.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty('BlockCounter')) {
		api.action.setBadgeText({
			text: abbreviate(items.BlockCounter.newValue),
		});
	}
});

api.storage.sync.get(DefaultOptions).then(async items => {
	// set initial extension state
	api.action.setIcon({
		path: items.suspendedBlockCollection
			? '/icon/icon-128-greyscale.png'
			: '/icon/icon-128.png',
	});
	if (items.skipVerified) {
		await PopulateVerifiedDb();
	}
});

// populate verified db
api.storage.sync.onChanged.addListener(async items => {
	if (
		items.hasOwnProperty('skipVerified') &&
		items.skipVerified.oldValue === false &&
		items.skipVerified.newValue === true
	) {
		await PopulateVerifiedDb();
	}
});

ConnectDb();

api.runtime.onMessage.addListener((m, s, r) => {
	let response: MessageResponse;
	(async (message: RuntimeMessage, sender) => {
		const refid = RefId();
		console.debug(logstr, refid, 'recv:', message, sender);
		// messages are ALWAYS expected to be:
		// 	1. objects
		// 	2. contain a string value stored under message.action. should be one defined above
		// other message contents change based on the defined action
		try {
			switch (message?.action) {
				case IsVerifiedAction:
					const verifiedMessage = message.data as { user_id: string; handle: string };
					const isVerified = await CheckDbIsUserLegacyVerified(
						verifiedMessage.user_id,
						verifiedMessage.handle,
					);
					response = { status: SuccessStatus, result: isVerified } as SuccessResponse;
					break;

				case AddToHistoryAction:
					const historyMessage = message.data as BlockedUser;
					await AddUserToHistory(historyMessage);
					response = { status: SuccessStatus, result: null } as SuccessResponse;
					break;

				case RemoveFromHistoryAction:
					const removeMessage = message.data as { user_id: string };
					await RemoveUserFromHistory(removeMessage.user_id);
					response = { status: SuccessStatus, result: null } as SuccessResponse;
					break;

				case AddToQueueAction:
					const addToQueueMessage = message.data as BlockUser;
					await AddUserToQueue(addToQueueMessage);
					response = { status: SuccessStatus, result: null } as SuccessResponse;
					break;

				case PopFromQueueAction:
					// no payload with this request
					const user = await PopUserFromQueue();
					response = { status: SuccessStatus, result: user } as SuccessResponse;
					break;

				default:
					console.error(
						logstr,
						refid,
						"got a message that couldn't be handled from sender:",
						sender,
						message,
					);
					response = { status: ErrorStatus, message: 'unknown action' } as ErrorResponse;
			}
		} catch (_e) {
			const e = _e as Error;
			console.error(
				logstr,
				refid,
				'unexpected error caught during',
				message?.action,
				'action',
				e,
			);
			response = {
				status: ErrorStatus,
				message: e.message ?? 'unknown error',
			} as ErrorResponse;
		}
		console.debug(logstr, refid, 'respond:', response);
	})(m, s).finally(() => r(response));
	return true;
});

////////////////////////////////////////////////// EXTERNAL MESSAGE HANDLING //////////////////////////////////////////////////

const [blockActionV1, blockAction, registerAction] = ['BLOCK', 'block_user', 'register'];

api.runtime.onMessageExternal.addListener((m, s, r) => {
	let response: MessageResponse;
	(async (message, sender) => {
		const refid = RefId();
		console.debug(logstr, refid, 'ext recv:', message, sender);
		const integrations = (await api.storage.local.get({ integrations: {} })).integrations as {
			[id: string]: Integration;
		};
		const senderId = sender.id ?? '';
		if (!integrations.hasOwnProperty(senderId)) {
			if (message?.action === registerAction) {
				//External extension wants to register
				const reg_request = message as RegisterRequest;
				integrations[senderId] = {
					name: reg_request.name,
					state: IntegrationStateDisabled,
				};
				// TODO: eliminate html here, cannot generate elements directly as it's not the same document. must be json-serializable
				// api.storage.local.set({
				// 	integrations,
				// 	[EventKey]: {
				// 		type: MessageEvent,
				// 		message: `<p>The extension <b>${
				// 			reg_request.name
				// 		}</b> would like to integrate with BlueBlocker.<br>Visit the <a href="${api.runtime.getURL(
				// 			'/src/pages/integrations/index.html',
				// 		)}" target="_blank">integrations page</a> to complete set up.</p>`,
				// 		options: { html: true },
				// 	},
				// });
				response = {
					status: SuccessStatus,
					result: 'integration registered',
				} as SuccessResponse;
				console.debug(
					logstr,
					refid,
					`registered a new extention: ${reg_request.name} ${senderId}. ext resp:`,
					response,
				);
				return;
			}
			response = { status: ErrorStatus, message: 'extension not allowed' } as ErrorResponse;
			return;
		}
		if (
			integrations[senderId].state === IntegrationStateDisabled ||
			integrations[senderId].state === IntegrationStateSendOnly
		) {
			response = {
				status: ErrorStatus,
				message: 'extension disabled or not allowed to send messages',
			} as ErrorResponse;
			return;
		}

		// messages are ALWAYS expected to be:
		// 	1. objects
		// 	2. contain a string value stored under message.action. should be one defined above
		// other message contents change based on the defined action
		try {
			switch (message?.action) {
				case blockActionV1:
					const blockV1Message = message as {
						user_id: string;
						name: string;
						screen_name: string;
						reason: string;
					};
					const userV1: BlockUser = {
						user_id: blockV1Message.user_id,
						user: {
							name: blockV1Message.name,
							screen_name: blockV1Message.screen_name,
						},
						reason: ReasonExternal,
						external_reason: blockV1Message.reason,
					};
					await AddUserToQueue(userV1).catch(() => AddUserToQueue(userV1));
					response = {
						status: SuccessStatus,
						result: 'user queued for blocking',
					} as SuccessResponse;
					break;

				case blockAction:
					const blockMessage = message.data as BlockUser;
					await AddUserToQueue(blockMessage).catch(() => AddUserToQueue(blockMessage));
					response = {
						status: SuccessStatus,
						result: 'user queued for blocking',
					} as SuccessResponse;
					break;

				default:
					console.error(
						logstr,
						refid,
						"got a message that couldn't be handled from sender:",
						sender,
						message,
					);
					response = { status: ErrorStatus, message: 'unknown action' } as ErrorResponse;
			}
		} catch (_e) {
			const e = _e as Error;
			console.error(
				logstr,
				refid,
				'unexpected error caught during',
				message?.action,
				'action',
				e,
			);
			response = {
				status: ErrorStatus,
				message: e.message ?? 'unknown error',
			} as ErrorResponse;
		}
		console.debug(logstr, refid, 'ext respond:', response);
	})(m, s).finally(() => r(response));
	return true;
});
