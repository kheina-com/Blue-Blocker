import { api, DefaultOptions, commafy } from '../shared.js';

// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	api.storage.sync.get(DefaultOptions, items => {
		document.getElementById("block-following").checked = items.blockFollowing;
		document.getElementById("block-followers").checked = items.blockFollowers;
		document.getElementById("skip-verified").checked = items.skipVerified;
		document.getElementById("skip-affiliated").checked = items.skipAffiliated;
		document.getElementById("skip-1mplus").checked = items.skip1Mplus;
		document.getElementById("block-nft-avatars").checked = items.blockNftAvatars;
	});
});

try {
	let _ = api === browser;
}
catch (ReferenceError) {
	// browser is undefined, therefore we're running on chrome
	document.body.style = "font-size: 1.1rem";
}

// set the block value immediately
api.storage.local.get({ BlockCounter: 0, BlockQueue: [] }).then(items => {
	document.getElementById("blocked-users-count").innerText = commafy(items.BlockCounter);
	document.getElementById("blocked-user-queue-length").innerText = commafy(items.BlockQueue.length);
});
api.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty('BlockCounter')) {
		document.getElementById("blocked-users-count").innerText = commafy(items.BlockCounter.newValue);
	}
	if (items.hasOwnProperty('BlockQueue')) {
		document.getElementById("blocked-user-queue-length").innerText = commafy(items.BlockQueue.newValue.length);
	}
	// if we want to add other values, add them here
});

document.getElementById("block-following").addEventListener("input", () => {
	api.storage.sync.set({
		blockFollowing: document.getElementById("block-following").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-following-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-followers").addEventListener("input", () => {
	api.storage.sync.set({
		blockFollowers: document.getElementById("block-followers").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-followers-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-verified").addEventListener("input", () => {
	api.storage.sync.set({
		skipVerified: document.getElementById("skip-verified").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-verified-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-affiliated").addEventListener("input", () => {
	api.storage.sync.set({
		skipAffiliated: document.getElementById("skip-affiliated").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-affiliated-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-1mplus").addEventListener("input", () => {
	api.storage.sync.set({
		skip1Mplus: document.getElementById("skip-1mplus").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-1mplus-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-nft-avatars").addEventListener("input", () => {
	api.storage.sync.set({
		blockNftAvatars: document.getElementById("block-nft-avatars").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-nft-avatars-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});
