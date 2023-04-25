import { DefaultOptions } from '../shared.js';

// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	browser.storage.sync.get(DefaultOptions).then(items => {
		document.getElementById("block-following").checked = items.blockFollowing;
		document.getElementById("block-affiliated").checked = items.blockAffiliated;
		document.getElementById("skip-verified").checked = items.skipVerified;
		document.getElementById("block-nft-avatars").checked = items.blockNftAvatars;
	});
});

document.getElementById("block-following").addEventListener("input", () => {
	browser.storage.sync.set({
		blockFollowing: document.getElementById("block-following").checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-following-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-affiliated").addEventListener("input", () => {
	browser.storage.sync.set({
		blockAffiliated: document.getElementById("block-affiliated").checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-affiliated-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-verified").addEventListener("input", () => {
	browser.storage.sync.set({
		skipVerified: document.getElementById("skip-verified").checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-verified-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-nft-avatars").addEventListener("input", () => {
	browser.storage.sync.set({
		blockNftAvatars: document.getElementById("block-nft-avatars").checked,
	}).then(() => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-nft-avatars-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});
