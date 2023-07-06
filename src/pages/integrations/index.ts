import { RefId } from "../../utilities.js";
import { IntegrationStateDisabled, IntegrationStateReceiveOnly, IntegrationStateSendAndReceive, IntegrationStateSendOnly, api, logstr } from "../../constants.js";
import "../style.css";
import "./style.css";

interface Integration {
	id: string,
	name: string,
	state: number,
}

document.addEventListener("DOMContentLoaded", () => {
	const integrationsDiv = document.getElementById("integrations") as HTMLElement;
	const i: { [n: string]: Integration } = { };

	function add(integration: Integration): void {
		const refid = RefId().toString();

		i[refid] = {
			id: integration.id,
			name: integration.name,
			state: integration.state,
		};

		const div = document.createElement("div");
		div.id = refid;

		const select = document.createElement("select");
		select.addEventListener("change", e => {
			const input = e.target as HTMLSelectElement;
			i[refid].state = parseInt(input.value);
		});

		const optionDisabled = document.createElement("option");
		optionDisabled.value = IntegrationStateDisabled.toString();
		optionDisabled.innerText = "disabled";
		select.appendChild(optionDisabled);

		const optionRecvOnly = document.createElement("option");
		optionRecvOnly.value = IntegrationStateReceiveOnly.toString();
		optionRecvOnly.innerText = "receive only";
		select.appendChild(optionRecvOnly);

		const optionSendOnly = document.createElement("option");
		optionSendOnly.value = IntegrationStateSendOnly.toString();
		optionSendOnly.innerText = "send only";
		select.appendChild(optionSendOnly);

		const optionSendRecv = document.createElement("option");
		optionSendRecv.value = IntegrationStateSendAndReceive.toString();
		optionSendRecv.innerText = "send and receive";
		select.appendChild(optionSendRecv);

		select.value = integration.state.toString();
		div.appendChild(select);

		const extId = document.createElement("input");
		extId.value = integration.id;
		extId.placeholder = "external extension id";
		extId.autocomplete = "off";
		extId.addEventListener("change", e => {
			const input = e.target as HTMLInputElement;
			i[refid].id = input.value;
		});
		div.appendChild(extId);

		const extName = document.createElement("input");
		extName.value = integration.name;
		extName.placeholder = "extension name";
		extName.autocomplete = "off";
		extName.addEventListener("change", e => {
			const input = e.target as HTMLInputElement;
			i[refid].name = input.value;
		});
		div.appendChild(extName);

		const remove = document.createElement("button");
		remove.innerText = "Remove";
		remove.addEventListener("click", e => {
			delete i[refid];
			integrationsDiv.removeChild(div);
		});
		div.appendChild(remove);

		integrationsDiv.appendChild(div);
	}

	api.storage.local.get({ integrations: { } })
	.then(items => items.integrations as { [id: string]: { name: string, state: number } })
	.then(integrations => {
		console.debug(logstr, "loaded integrations:", integrations);
		const addButton = document.getElementById("add-button") as HTMLButtonElement;
		const saveButton = document.getElementById("save-button") as HTMLButtonElement;
		const saveStatus = document.getElementById("save-status") as HTMLButtonElement;

		addButton.addEventListener("click", e => add({ id: "", name: "", state: IntegrationStateDisabled }));
		let saveTimeout: number | null = null;
		saveButton.addEventListener("click", e => {
			console.debug(logstr, "saving integrations:", i);
			if (saveTimeout !== null) {
				clearTimeout(saveTimeout);
			}

			const integrations: { [id: string]: { name: string, state: number } } = { };
			for (const integration of Object.values(i)) {
				integrations[integration.id] = {
					name: integration.name,
					state: integration.state,
				};
			}
			api.storage.local.set({ integrations }).then(() => {
				console.debug(logstr, "saved integrations:", integrations);
				saveStatus.innerText = "saved!";
				saveTimeout = setTimeout(() => saveStatus.innerText = "", 1000);
			});
		});

		integrationsDiv.innerHTML = "";

		if (Object.entries(integrations).length === 0) {
			return add({ id: "", name: "", state: IntegrationStateDisabled });
		}

		for (const [extensionId, integration] of Object.entries(integrations)) {
			add({
				id: extensionId,
				name: integration.name,
				state: integration.state,
			});
		}
	});
});
