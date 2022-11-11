// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	chrome.storage.sync.get({
		// by default, spare the people we follow from getting blocked
		blockFollowing: false,
		skipVerified: true,
	}, items => {
		document.getElementById("block-following").checked = items.blockFollowing;
		document.getElementById("skip-verified").checked = items.skipVerified;
	});
});

document.getElementById("block-following").addEventListener("input", () => {
	const blockFollowing = document.getElementById("block-following").checked;

	chrome.storage.sync.set({
		blockFollowing,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("block-following-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});

document.getElementById("skip-verified").addEventListener("input", () => {
	const skipVerified = document.getElementById("skip-verified").checked;

	chrome.storage.sync.set({
		skipVerified,
	}, () => {
		// Update status to let user know options were saved.
		const status = document.getElementById("skip-verified-status");
		status.textContent = "saved";
		setTimeout(() => status.textContent = null, 1000);
	});
});
