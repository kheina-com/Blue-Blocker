import { api, logstr,  DefaultOptions, SoupcanExtensionId } from '../constants.js';
import { abbreviate, commafy } from '../utilities.js';
import './style.css';

// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	const version = document.getElementById("version") as HTMLElement;
	version.textContent = "v" + api.runtime.getManifest().version;

	const blockedUsersCount = document.getElementById("blocked-users-count") as HTMLElement;
	const blockedUserQueueLength = document.getElementById("blocked-user-queue-length") as HTMLElement;
	const suspendBlockCollection = document.getElementById("suspend-block-collection") as HTMLInputElement;
	const showBlockPopups = document.getElementById("show-block-popups") as HTMLInputElement;
	const muteInsteadOfBlock = document.getElementById("mute-instead-of-block") as HTMLInputElement;
	const blockFollowing = document.getElementById("block-following") as HTMLInputElement;
	const blockFollowers = document.getElementById("block-followers") as HTMLInputElement;
	const skipVerified = document.getElementById("skip-verified") as HTMLInputElement;
	const skipAffiliated = document.getElementById("skip-affiliated") as HTMLInputElement;
	const skip1Mplus = document.getElementById("skip-1mplus") as HTMLInputElement;
	const skipFollowerCount = document.getElementById("skip-follower-count") as HTMLInputElement;
	const skipFollowerCountOption = document.getElementById("skip-follower-count-option") as HTMLElement;
	const skipFollowerCountValue = document.getElementById("skip-follower-count-value") as HTMLElement;
	const blockNftAvatars = document.getElementById("block-nft-avatars") as HTMLInputElement;
	const blockInterval = document.getElementById("block-interval") as HTMLInputElement;
	const blockIntervalValue = document.getElementById("block-interval-value") as HTMLInputElement;
	const popupTimerOption = document.getElementById("popup-timer-slider") as HTMLElement;
	const popupTimer = document.getElementById("popup-timer") as HTMLInputElement;
	const popupTimerValue = document.getElementById("popup-timer-value") as HTMLElement;

	const soupcanIntegrationOption = document.getElementById("soupcan-integration-option") as HTMLElement;
	const soupcanIntegration = document.getElementById("soupcan-integration") as HTMLInputElement;

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		suspendBlockCollection.checked = config.suspendedBlockCollection;
		showBlockPopups.checked = config.showBlockPopups;
		muteInsteadOfBlock.checked = config.mute;
		blockFollowing.checked = config.blockFollowing;
		blockFollowers.checked = config.blockFollowers;
		skipVerified.checked = config.skipVerified;
		skipAffiliated.checked = config.skipAffiliated;
		skip1Mplus.checked = config.skip1Mplus;
		skipFollowerCount.value = config.skipFollowerCount.toString();
		skipFollowerCountOption.style.display = config.skip1Mplus ? "" : "none";
		skipFollowerCountValue.textContent = abbreviate(config.skipFollowerCount);
		blockNftAvatars.checked = config.blockNftAvatars;
		soupcanIntegration.checked = config.soupcanIntegration;

		blockInterval.value = config.blockInterval.toString();
		blockIntervalValue.textContent = config.blockInterval.toString() + "s";

		popupTimerOption.style.display = config.showBlockPopups ? "" : "none";
		popupTimer.value = config.popupTimer.toString();
		popupTimerValue.textContent = config.popupTimer.toString() + "s";
	});

	api.management.get(SoupcanExtensionId).then(e => {
		console.log(e);
		soupcanIntegrationOption.style.display = "";
	}).catch(e => {
		console.log(e);
		soupcanIntegrationOption.style.display = "none";
	});

	// set the block value immediately
	api.storage.local.get({ BlockCounter: 0, BlockQueue: [] }).then(items => {
		blockedUsersCount.textContent = commafy(items.BlockCounter);
		blockedUserQueueLength.textContent = commafy(items.BlockQueue.length);
	});
	api.storage.local.onChanged.addListener(items => {
		if (items.hasOwnProperty("BlockCounter")) {
			blockedUsersCount.textContent = commafy(items.BlockCounter.newValue);
		}
		if (items.hasOwnProperty("BlockQueue")) {
			blockedUserQueueLength.textContent = commafy(items.BlockQueue.newValue.length);
		}
		// if we want to add other values, add them here
	});

	suspendBlockCollection.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			suspendedBlockCollection: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("suspend-block-collection-status") as HTMLElement;
			status.textContent = target.checked ? "paused" : "resumed";
			api.action.setIcon({ path: target.checked ? "/icon/icon-128-greyscale.png" : "/icon/icon-128.png" });
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	showBlockPopups.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			showBlockPopups: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			popupTimerOption.style.display = target.checked ? "" : "none";
			const status = document.getElementById("show-block-popups-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	muteInsteadOfBlock.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			mute: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("mute-instead-of-block-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	blockFollowing.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			blockFollowing: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("block-following-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	blockFollowers.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			blockFollowers: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("block-followers-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	skipVerified.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			skipVerified: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("skip-verified-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	skipAffiliated.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			skipAffiliated: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("skip-affiliated-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	skip1Mplus.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			skip1Mplus: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("skip-1mplus-status") as HTMLElement;
			status.textContent = "saved";
			skipFollowerCountOption.style.display = target.checked ? "" : "none";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	skipFollowerCount.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		const value = parseInt(target.value);
		skipFollowerCountValue.textContent = abbreviate(value);
		api.storage.sync.set({
			skipFollowerCount: value,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("skip-follower-count-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	blockNftAvatars.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			blockNftAvatars: target.checked,
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("block-nft-avatars-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	soupcanIntegration.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			soupcanIntegration: target.checked,
		}).then(() => {
			console.log(logstr, "set soupcanIntegration to", target.checked);
			// Update status to let user know options were saved.
			const status = document.getElementById("soupcan-integration-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	blockInterval.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		blockIntervalValue.textContent = target.value.toString() + "s";
	});

	blockInterval.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			blockInterval: parseInt(target.value),
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("block-interval-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});

	popupTimer.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		popupTimerValue.textContent = target.value.toString() + "s";
	});

	popupTimer.addEventListener("change", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			popupTimer: parseInt(target.value),
		}).then(() => {
			// Update status to let user know options were saved.
			const status = document.getElementById("popup-timer-status") as HTMLElement;
			status.textContent = "saved";
			setTimeout(() => status.textContent = null, 1000);
		});
	});
});
