import { RefId } from '../../utilities';
import {
	api,
	logstr,
	IntegrationStateDisabled,
	IntegrationStateReceiveOnly,
	IntegrationStateSendAndReceive,
	IntegrationStateSendOnly,
	SoupcanExtensionId,
} from '../../constants';
import '../style.css';
import './style.css';

interface Integration {
	id: string;
	name: string;
	state: number;
}

const [ExtensionStateNone, ExtensionStateDisabled, ExtensionStateEnabled] = [0, 1, 2];

document.addEventListener('DOMContentLoaded', () => {
	const integrationsDiv = document.getElementById('integrations') as HTMLElement;
	const i: { [n: string]: Integration; } = {};

	function add(integration: Integration): void {
		const refid = RefId().toString();

		i[refid] = {
			id: integration.id,
			name: integration.name,
			state: integration.state,
		};

		const div = document.createElement('div');
		div.id = integration.id || 'placeholder';

		const logupdate = () => console.debug(logstr, 'updated integration', refid, i[refid]);

		const select = document.createElement('select');
		select.addEventListener('change', e => {
			const input = e.target as HTMLSelectElement;
			i[refid].state = parseInt(input.value);
			logupdate();
		});

		const optionDisabled = document.createElement('option');
		optionDisabled.value = IntegrationStateDisabled.toString();
		optionDisabled.innerText = 'disabled';
		select.appendChild(optionDisabled);

		const optionRecvOnly = document.createElement('option');
		optionRecvOnly.value = IntegrationStateReceiveOnly.toString();
		optionRecvOnly.innerText = 'receive only';
		select.appendChild(optionRecvOnly);

		const optionSendOnly = document.createElement('option');
		optionSendOnly.value = IntegrationStateSendOnly.toString();
		optionSendOnly.innerText = 'send only';
		select.appendChild(optionSendOnly);

		const optionSendRecv = document.createElement('option');
		optionSendRecv.value = IntegrationStateSendAndReceive.toString();
		optionSendRecv.innerText = 'send and receive';
		select.appendChild(optionSendRecv);

		select.value = integration.state.toString();
		div.appendChild(select);

		const extId = document.createElement('input');
		extId.value = integration.id;
		extId.placeholder = 'external extension id';
		extId.autocomplete = 'off';
		extId.addEventListener('input', e => {
			const input = e.target as HTMLInputElement;
			i[refid].id = input.value;
			div.id = input.value;
			logupdate();
		});
		div.appendChild(extId);

		const extName = document.createElement('input');
		extName.value = integration.name;
		extName.placeholder = 'extension name';
		extName.autocomplete = 'off';
		extName.addEventListener('input', e => {
			const input = e.target as HTMLInputElement;
			i[refid].name = input.value;
			logupdate();
		});
		div.appendChild(extName);

		const remove = document.createElement('button');
		remove.innerText = 'Remove';
		remove.addEventListener('click', e => {
			const deleted = i[refid];
			delete i[refid];
			integrationsDiv.removeChild(div);
			console.debug(logstr, 'deleted integration', refid, deleted, i);
		});
		div.appendChild(remove);

		integrationsDiv.appendChild(div);
	}

	integrationsDiv.innerText = '';
	let soupcanState: number = ExtensionStateNone;

	// soupcan doesn't work with the new integration system for now
	// document.addEventListener('soupcan-event', () => {
	// 	if (soupcanState === ExtensionStateEnabled) {
	// 		// we don't need a placeholder if we're going to put soupcan in, so remove it
	// 		const placeholder = document.getElementById('placeholder');
	// 		if (placeholder) {
	// 			// the only button in here should be the remove button
	// 			placeholder.getElementsByTagName('button')[0].click();
	// 		}
	// 		add({
	// 			id: SoupcanExtensionId,
	// 			name: 'soupcan',
	// 			state: IntegrationStateDisabled,
	// 		});
	// 	}
	// });

	api.storage.local
		.get({ integrations: {} })
		.then(items => items.integrations as { [id: string]: { name: string; state: number; }; })
		.then(integrations => {
			console.debug(logstr, 'loaded integrations:', integrations);
			const addButton = document.getElementById('add-button') as HTMLButtonElement;
			const saveButton = document.getElementById('save-button') as HTMLButtonElement;
			const saveStatus = document.getElementById('save-status') as HTMLButtonElement;

			// it's important that this runs *after* getting local storage back
			if (!integrations.hasOwnProperty(SoupcanExtensionId)) {
				api.runtime
					.sendMessage(SoupcanExtensionId, {
						action: 'check_twitter_user',
						screen_name: 'elonmusk',
					})
					.then((r: any) => {
						// we could check if response is the expected shape here, if we really wanted
						if (!r) {
							soupcanState = ExtensionStateDisabled;
							throw new Error('extension not enabled');
						}
						soupcanState = ExtensionStateEnabled;
					})
					.catch(e => console.debug(logstr, 'soupcan error:', e, soupcanState))
					.finally(() =>
						// @ts-ignore
						document.dispatchEvent(new CustomEvent('soupcan-event')),
					);
			}

			addButton.addEventListener('click', e =>
				add({ id: '', name: '', state: IntegrationStateDisabled }),
			);
			let saveTimeout: number | null = null;
			saveButton.addEventListener('click', e => {
				console.debug(logstr, 'saving integrations:', i);
				if (saveTimeout !== null) {
					clearTimeout(saveTimeout);
				}

				const integrations: { [id: string]: { name: string; state: number; }; } = {};
				for (const integration of Object.values(i)) {
					integrations[integration.id] = {
						name: integration.name,
						state: integration.state,
					};
				}
				api.storage.local.set({ integrations }).then(() => {
					console.debug(logstr, 'saved integrations:', integrations);
					saveStatus.innerText = 'saved!';
					saveTimeout = setTimeout(() => (saveStatus.innerText = ''), 1000);
				});
			});

			for (const [extensionId, integration] of Object.entries(integrations)) {
				add({
					id: extensionId,
					name: integration.name,
					state: integration.state,
				});
			}

			if (Object.entries(i).length === 0) {
				add({ id: '', name: '', state: IntegrationStateDisabled });
			}
		});
});
