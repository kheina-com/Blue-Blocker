import { api, DefaultOptions, logstr } from '../constants.js';
import { abbreviate, commafy } from '../utilities.js';
import { QueueLength } from '../background/db.js';
import './style.css';

function checkHandler(
	target: HTMLInputElement,
	config: Config,
	key: string,
	options: {
		optionName?: string;
		callback?: (t: HTMLInputElement, startup: boolean) => void;
		statusText?: string;
	} = {},
) {
	// @ts-ignore
	const value = config[key];
	const optionName = options.optionName ?? target.id + '-option';
	const statusText = options.statusText ?? 'saved';

	target.checked = value;
	const ele = [...document.getElementsByName(target.id)] as HTMLInputElement[];
	ele.forEach(label => {
		if (value) {
			label.classList.add('checked');
		} else {
			label.classList.remove('checked');
		}
	});

	(
		options.callback ??
		(() => {
			document
				.getElementsByName(optionName)
				.forEach(e => (e.style.display = value ? '' : 'none'));
		})
	)(target, true);

	const callback =
		options.callback ??
		(() => {
			updateSavedStatus(target.id + '-status');
			document
				.getElementsByName(optionName)
				.forEach(e => (e.style.display = target.checked ? '' : 'none'));
		});

	target.addEventListener('input', e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync
			.set({
				[key]: target.checked,
			})
			.then(() => console.debug(logstr, 'saved value', target.checked, 'in', `config.${key}`))
			.then(() => callback(target, false))
			.then(() => {
				// update the checkmark last so that it can be used as the saved status indicator as well
				ele.forEach(label => {
					if (target.checked) {
						label.classList.add('checked');
					} else {
						label.classList.remove('checked');
					}
				});
			});
	});
}

function checkHandlerArrayToString(target: HTMLInputElement, config: Config, key: string) {
	// @ts-ignore
	const value: string[] = config[key];
	target.value = value.join(', ');

	let timeout: number | null = null;
	target.addEventListener('input', e => {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(() => updateDisallowedWordsInUsernames(e), 1000);
	});
}

function inputMirror(
	name: string,
	value: any,
	onInput: (e: Event) => void,
	onInputEvent: keyof HTMLElementEventMap = 'input',
) {
	const ele = [...document.getElementsByName(name)] as HTMLInputElement[];
	ele.forEach(input => {
		input.value = value;
		input.addEventListener(onInputEvent, onInput);
		input.addEventListener(onInputEvent === 'input' ? 'change' : 'input', _e => {
			const e = _e.target as HTMLInputElement;
			ele.filter(i => i !== e).forEach(i => (i.value = e.value));
		});
	});
}

function sliderMirror(
	name: string,
	key: 'popupTimer' | 'blockInterval',
	config: Config,
	options: { onInput?: (e: Event, ele: HTMLInputElement[]) => any } = {},
) {
	const ele = [...document.getElementsByName(name)] as HTMLInputElement[];
	ele[0].value = config[key].toString();
	const onInput =
		options?.onInput ??
		((_e: Event) => {
			const target = _e.target as HTMLInputElement;
			ele.forEach(i => (i.value = target.value));
			document
				.getElementsByName(target.name + '-value')
				.forEach(v => (v.textContent = target.value.toString() + 's'));
		});
	onInput({ target: ele[0] } as unknown as Event, ele);
	ele.forEach(input => {
		const value = config[key].toString();
		input.value = value;
		input.addEventListener('input', e =>
			onInput(
				e,
				ele.filter(i => i !== e.target),
			),
		);
		input.addEventListener('change', e => {
			const target = e.target as HTMLInputElement;
			const targetValue = parseInt(target.value);
			const textValue = targetValue.toString() + 's';
			document
				.getElementsByName(target.name + '-value')
				.forEach(e => (e.innerText = textValue));
			api.storage.sync
				.set({
					[key]: targetValue,
				})
				.then(() =>
					console.debug(logstr, 'saved value', targetValue, 'in', `config.${key}`),
				)
				.then(() => updateSavedStatus(target.name + '-status'));
		});
	});
}

function exportSafelist() {
	api.storage.sync.get({ unblocked: {} }).then(items => {
		// the unblocked list needs to be put into a different format for export
		const safelist = items.unblocked as { [k: string]: string | undefined };
		const content =
			'user_id,screen_name\n' +
			Object.entries(safelist)
				.map(i => i[0] + ',' + (i[1] ?? "this user's @ is not stored"))
				.join('\n');
		const e = document.createElement('a');
		e.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
		e.target = '_blank';
		e.download = 'BlueBlockerSafelist.csv';
		e.click();
	});
}

function updateDisallowedWordsInUsernames(changeEvent: Event) {
	const target = changeEvent.target as HTMLInputElement;
	let wordList = target.value.split(',');
	wordList = wordList
		.map(word =>
			// trim white space
			word
				.trim()
				//remove double spaces
				.replace(/ {2,}/g, ' '),
		)
		.filter(w => w);
	api.storage.sync
		.set({ disallowedWords: wordList })
		.then(() => console.debug(logstr, 'saved value', wordList, 'in config.disallowedWords'))
		.then(() => updateSavedStatus('blockstrings-status'));
}

// start this immediately so that it's ready when the document loads
const popupPromise = api.storage.local.get({ popupActiveTab: 'general' });

function updateSavedStatus(name: string, savedText = 'saved') {
	// Update status to let user know options were saved.
	document.getElementsByName(name).forEach(status => {
		status.textContent = savedText;
		setTimeout(() => (status.textContent = null), 1000);
	});
}

// restore state from storage
document.addEventListener('DOMContentLoaded', () => {
	const version = document.getElementById('version') as HTMLElement;
	version.textContent = 'v' + api.runtime.getManifest().version;

	const tabs: {
		[k: string]: { button: HTMLAnchorElement; content: HTMLDivElement; scroll: boolean };
	} = {};

	let popupActiveTab: string;

	function selectTab(tab: string) {
		if (tab === popupActiveTab) {
			return;
		}

		if (!tabs.hasOwnProperty(tab)) {
			if (tab != 'quick' && tab != 'advanced') {
				throw new Error(
					'invalid tab value. must be one of: ' +
					Object.values(tabs)
						.map(x => `'${x}'`)
						.join(', ') +
					'.',
				);
			}
			// Gracefully migrate users to new tabs
			tab = 'general';
		}

		tabs[tab].content.style.display = 'block';
		tabs[tab].button.style.flexGrow = '1000';

		const tabButtonBorder = tabs[tab].button.getElementsByTagName('div')[0] as HTMLElement;
		tabButtonBorder.style.borderBottomWidth = '5px';

		if (tabs[tab].scroll) {
			document.body.style.overflowY = '';
		} else {
			document.body.style.overflowY = 'hidden';
		}

		if (popupActiveTab) {
			tabs[popupActiveTab].content.style.display = 'none';
			tabs[popupActiveTab].button.style.flexGrow = '';

			const tabButtonBorder = tabs[popupActiveTab].button.getElementsByTagName(
				'div',
			)[0] as HTMLElement;
			tabButtonBorder.style.borderBottomWidth = '0';
		}

		popupActiveTab = tab;
		api.storage.local.set({
			popupActiveTab,
		});
	}

	function registerTab(tab: string, options: { buttonId?: string; scroll?: boolean } = {}) {
		const button = document.getElementById(
			options.buttonId ?? 'button-' + tab,
		) as HTMLAnchorElement;

		const content = document.getElementById(tab) as HTMLDivElement;
		content.style.display = 'none';
		tabs[tab] = {
			button,
			content,
			scroll: options.scroll ?? false,
		};

		button.addEventListener('click', () => selectTab(tab));
		console.debug(logstr, 'registered tab', tab, tabs[tab]);
	}

	registerTab('general');
	registerTab('verified');
	registerTab('moderation');
	registerTab('appearance');
	popupPromise
		.then(items =>
			// change old installation tabs to general tab on first startup
			tabs.hasOwnProperty(items.popupActiveTab) ? items : { popupActiveTab: 'general' },
		)
		.then(items => selectTab(items.popupActiveTab));

	// checkboxes
	const blockedUsersCount = document.getElementById('blocked-users-count') as HTMLElement;
	const blockedUserQueueLength = document.getElementById(
		'blocked-user-queue-length',
	) as HTMLElement;
	const suspendBlockCollection = document.getElementById(
		'suspend-block-collection',
	) as HTMLInputElement;
	const showBlockPopups = document.getElementById('show-block-popups') as HTMLInputElement;
	const muteInsteadOfBlock = document.getElementById('mute-instead-of-block') as HTMLInputElement;
	const blockFollowing = document.getElementById('block-following') as HTMLInputElement;
	const blockFollowers = document.getElementById('block-followers') as HTMLInputElement;
	const skipFollowingQrts = document.getElementById('skip-following-qrts') as HTMLInputElement;
	const skipVerified = document.getElementById('skip-verified') as HTMLInputElement;
	const skipAffiliated = document.getElementById('skip-affiliated') as HTMLInputElement;
	const skip1Mplus = document.getElementById('skip-1mplus') as HTMLInputElement;
	const blockPromoted = document.getElementById('block-promoted-tweets') as HTMLInputElement;
	const blockForUse = document.getElementById('block-for-use') as HTMLInputElement;
	const skipCheckmark = document.getElementById('skip-checkmark') as HTMLInputElement;
	const disallowedWordsCheckmark = document.getElementById('blockstrings') as HTMLInputElement;
	const disallowedWordsInput = document.getElementById('blockstrings-input') as HTMLInputElement;
	const silenceNotifications = document.getElementById('silence-notifications') as HTMLInputElement;

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		checkHandler(suspendBlockCollection, config, 'suspendedBlockCollection', {
			callback(target: HTMLInputElement, startup: boolean) {
				if (!startup) {
					updateSavedStatus(target.id + '-status', target.checked ? 'paused' : 'resumed');
				}
				api.action.setIcon({
					path: target.checked ? '/icon/icon-128-greyscale.png' : '/icon/icon-128.png',
				});
			},
		});
		checkHandler(showBlockPopups, config, 'showBlockPopups');
		checkHandler(muteInsteadOfBlock, config, 'mute');
		checkHandler(blockFollowing, config, 'blockFollowing');
		checkHandler(blockFollowers, config, 'blockFollowers');
		checkHandler(skipFollowingQrts, config, 'skipFollowingQrts');
		checkHandler(skipVerified, config, 'skipVerified');
		checkHandler(skipAffiliated, config, 'skipAffiliated');
		checkHandler(skip1Mplus, config, 'skip1Mplus', {
			optionName: 'skip-follower-count-option',
		});
		checkHandler(blockPromoted, config, 'blockPromoted');
		checkHandler(blockForUse, config, 'blockForUse');
		checkHandler(skipCheckmark, config, 'skipBlueCheckmark', {
			callback(target: HTMLInputElement, startup: boolean) {
				if (!startup) {
					updateSavedStatus(target.id + '-status');
				}
				document
					.getElementsByName(target.id + '-option')
					.forEach(e => (e.style.display = target.checked ? '' : 'none'));
				document
					.querySelectorAll<HTMLElement>('[data-bb-skip-checkmark]')
					.forEach(e => (e.style.display = target.checked ? 'none' : ''));
			},
		});
		checkHandler(disallowedWordsCheckmark, config, 'blockDisallowedWords');
		checkHandler(silenceNotifications, config, 'silenceNotifications');
		checkHandlerArrayToString(disallowedWordsInput, config, 'disallowedWords');

		document
			.getElementsByName('skip-follower-count-value')
			.forEach(e => (e.innerText = abbreviate(config.skipFollowerCount)));
		inputMirror('skip-follower-count', config.skipFollowerCount, e => {
			const target = e.target as HTMLInputElement;
			const value = parseInt(target.value);
			const textValue = abbreviate(value);
			document
				.getElementsByName('skip-follower-count-value')
				.forEach(e => (e.innerText = textValue));
			api.storage.sync
				.set({
					skipFollowerCount: value,
				})
				.then(() =>
					console.debug(logstr, 'saved value', value, 'in config.skipFollowerCount'),
				)
				.then(() => updateSavedStatus(target.name + '-status'));
		});

		inputMirror('toasts-location', config.toastsLocation, e => {
			const target = e.target as HTMLInputElement;
			api.storage.sync
				.set({
					toastsLocation: target.value,
				})
				.then(() =>
					console.debug(logstr, 'saved value', target.value, 'in config.toastsLocation'),
				)
				.then(() => updateSavedStatus(target.name + '-status'));
		});

		sliderMirror('popup-timer', 'popupTimer', config);
		sliderMirror('block-interval', 'blockInterval', config, {
			onInput(e, ele) {
				const target = e.target as HTMLInputElement;
				const targetValue = parseInt(target.value);
				ele.forEach(i => (i.value = target.value));
				document
					.getElementsByName('variance')
					.forEach(e => (e.innerText = '±' + (targetValue / 10).toFixed(1) + 's'));
				document
					.getElementsByName(target.name + '-value')
					.forEach(v => (v.textContent = target.value.toString() + 's'));
			},
		});

		// safelist logic
		// import cannot be done here, only on a standalone page
		document
			.getElementsByName('export-safelist')
			.forEach(e => e.addEventListener('click', exportSafelist));
		document.getElementsByName('clear-safelist').forEach(e => {
			e.addEventListener('click', () =>
				api.storage.sync
					.set({ unblocked: {} })
					.then(() =>
						document
							.getElementsByName('safelist-status')
							.forEach(s => (s.innerText = 'cleared safelist.')),
					),
			);
		});
	});

	// set the block value immediately
	api.storage.local.get({ BlockCounter: 0 }).then(items => {
		blockedUsersCount.textContent = commafy(items.BlockCounter);
	});
	api.storage.local.onChanged.addListener(items => {
		if (items.hasOwnProperty('BlockCounter')) {
			blockedUsersCount.textContent = commafy(items.BlockCounter.newValue);
			QueueLength().then(count => {
				blockedUserQueueLength.textContent = commafy(count);
			});
		}
		if (items.hasOwnProperty('BlockQueue')) {
			blockedUserQueueLength.textContent = commafy(items.BlockQueue.newValue.length);
		}
		// if we want to add other values, add them here
	});

	QueueLength().then(count => {
		blockedUserQueueLength.textContent = commafy(count);
	});
});
