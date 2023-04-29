import { DefaultOptions, commafy } from '../shared.js';

// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	chrome.storage.sync.get(DefaultOptions, items => {
		document.getElementById("block-following").checked = items.blockFollowing;
		document.getElementById("block-followers").checked = items.blockFollowers;
		document.getElementById("skip-verified").checked = items.skipVerified;
		document.getElementById("skip-affiliated").checked = items.skipAffiliated;
		document.getElementById("skip-1mplus").checked = items.skip1Mplus;
		document.getElementById("block-nft-avatars").checked = items.blockNftAvatars;
	});
});

const setBlockedUsersCounter = () => {
	chrome.storage.local.get({ BlockCounter: 0 }).then(items => document.getElementById("blocked-users-count").innerText = commafy(items.BlockCounter));
};
setBlockedUsersCounter(); // set it immediately
setInterval(setBlockedUsersCounter, 5000);

document.getElementById("block-following").addEventListener("input", () => {
	chrome.storage.sync.set({
		blockFollowing: document.getElementById("block-following").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-following-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-followers").addEventListener("input", () => {
	chrome.storage.sync.set({
		blockFollowers: document.getElementById("block-followers").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-followers-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-verified").addEventListener("input", () => {
	chrome.storage.sync.set({
		skipVerified: document.getElementById("skip-verified").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-verified-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-affiliated").addEventListener("input", () => {
	chrome.storage.sync.set({
		skipAffiliated: document.getElementById("skip-affiliated").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-affiliated-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-1mplus").addEventListener("input", () => {
	chrome.storage.sync.set({
		skip1Mplus: document.getElementById("skip-1mplus").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-1mplus-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("block-nft-avatars").addEventListener("input", () => {
	chrome.storage.sync.set({
		blockNftAvatars: document.getElementById("block-nft-avatars").checked,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-nft-avatars-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});
