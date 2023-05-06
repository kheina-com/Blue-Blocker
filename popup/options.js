import { api, DefaultOptions } from '../constants.js';
import { commafy } from '../utilities.js';

// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	api.storage.sync.get(DefaultOptions).then(items => {
		document.getElementById("suspend-block-collection").checked = items.suspendedBlockCollection;
		document.getElementById("show-block-popups").checked = items.showBlockPopups;
		document.getElementById("mute-instead-of-block").checked = items.mute;
		document.getElementById("block-following").checked = items.blockFollowing;
		document.getElementById("block-followers").checked = items.blockFollowers;
		document.getElementById("skip-verified").checked = items.skipVerified;
		document.getElementById("skip-affiliated").checked = items.skipAffiliated;
		document.getElementById("skip-1mplus").checked = items.skip1Mplus;
		document.getElementById("block-nft-avatars").checked = items.blockNftAvatars;
		document.getElementById("block-interval").value = items.blockInterval;
		document.getElementById("block-interval-value").innerText = items.blockInterval.toString() + "s";
	});
});

// set the block value immediately
api.storage.local.get({ BlockCounter: 0, BlockQueue: [] }).then(items => {
	document.getElementById("blocked-users-count").innerText = commafy(items.BlockCounter);
	document.getElementById("blocked-user-queue-length").innerText = commafy(items.BlockQueue.length);
});
api.storage.local.onChanged.addListener(items => {
	if (items.hasOwnProperty("BlockCounter")) {
		document.getElementById("blocked-users-count").innerText = commafy(items.BlockCounter.newValue);
	}
	if (items.hasOwnProperty("BlockQueue")) {
		document.getElementById("blocked-user-queue-length").innerText = commafy(items.BlockQueue.newValue.length);
	}
	// if we want to add other values, add them here
});

document.getElementById("version").innerText = "v" + api.runtime.getManifest().version;

document.getElementById("suspend-block-collection").addEventListener("input", e => {
	api.storage.sync.set({
		suspendedBlockCollection: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("suspend-block-collection-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("show-block-popups").addEventListener("input", e => {
	api.storage.sync.set({
		showBlockPopups: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("show-block-popups-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("mute-instead-of-block").addEventListener("input", e => {
	api.storage.sync.set({
		mute: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("mute-instead-of-block-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-following").addEventListener("input", e => {
	api.storage.sync.set({
		blockFollowing: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-following-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-followers").addEventListener("input", e => {
	api.storage.sync.set({
		blockFollowers: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-followers-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-verified").addEventListener("input", e => {
	api.storage.sync.set({
		skipVerified: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-verified-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-affiliated").addEventListener("input", e => {
	api.storage.sync.set({
		skipAffiliated: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-affiliated-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-1mplus").addEventListener("input", e => {
	api.storage.sync.set({
		skip1Mplus: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-1mplus-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-nft-avatars").addEventListener("input", e => {
	api.storage.sync.set({
		blockNftAvatars: e.target.checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-nft-avatars-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

const blockIntervalValueElement = document.getElementById("block-interval-value");
document.getElementById("block-interval").addEventListener("input", e => {
	blockIntervalValueElement.innerText = e.target.value.toString() + "s";
});

document.getElementById("block-interval").addEventListener("change", e => {
	api.storage.sync.set({
		blockInterval: parseInt(e.target.value),
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-interval-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});
