import { api, logstr, DefaultOptions, ErrorEvent, EventKey, MessageEvent, SoupcanExtensionId } from "../constants.js";
import { abbreviate, commafy } from "../utilities.js";
import "./style.css";

function checkHandler(target: HTMLInputElement, config: Config, key: string, options: { optionName?: string, callback?: (t: HTMLInputElement) => void, statusText?: string } = { }) {
	// @ts-ignore
	const value = config[key];
	const optionName = options.optionName ?? target.id + "-option";
	const statusText = options.statusText ?? "saved";

	target.checked = value;
	const ele = [...document.getElementsByName(target.id)] as HTMLInputElement[];
	ele.forEach(label => {
		if (value) {
			label.classList.add("checked");
		} else {
			label.classList.remove("checked");
		}
	});

	document.getElementsByName(optionName)
	.forEach(e => e.style.display = value ? "" : "none");

	target.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		api.storage.sync.set({
			[key]: target.checked,
		}).then(() => (options.callback ?? (_ => {
			document.getElementsByName(target.id + "-status").forEach(status => {
				status.textContent = statusText;
				setTimeout(() => status.textContent = null, 1000);
			});
			document.getElementsByName(optionName)
			.forEach(e => e.style.display = target.checked ? "" : "none");
		}))(target)).then(() => {
			// update the checkmark last so that it can be used as the saved status indicator
			ele.forEach(label => {
				if (target.checked) {
					label.classList.add("checked");
				} else {
					label.classList.remove("checked");
				}
			});
		});
	});
}

function inputMirror(name: string, value: any, onInput: (e: Event) => void, onInputEvent: keyof HTMLElementEventMap = "input") {
	const ele = [...document.getElementsByName(name)] as HTMLInputElement[];
	ele.forEach(input => {
		input.value = value;
		input.addEventListener(onInputEvent, onInput);
		input.addEventListener(onInputEvent === "input" ? "change" : "input", _e => {
			const e = _e.target as HTMLInputElement;
			ele.filter(i => i !== e).forEach(i => i.value = e.value);
		});
	});
}

function sliderMirror(name: string, key: "popupTimer" | "blockInterval", config: Config) {
	const ele = [...document.getElementsByName(name)] as HTMLInputElement[];
	ele.forEach(input => {
		const value = config[key].toString()
		input.value = value;
		const onInput = (_e: Event) => {
			const e = _e.target as HTMLInputElement;
			ele.filter(i => i !== e).forEach(i => i.value = e.value);
			document.getElementsByName(e.name + "-value")
			.forEach(v => v.textContent = e.value.toString() + "s");
		};
		onInput({ target: input } as unknown as Event);
		input.addEventListener("input", onInput);
		input.addEventListener("change", e => {
			const target = e.target as HTMLInputElement;
			const targetValue = parseInt(target.value);
			const textValue = targetValue.toString() + "s";
			document.getElementsByName(target.name + "-value")
			.forEach(e => e.innerText = textValue);
			api.storage.sync.set({
				[key]: targetValue,
			}).then(() => {
				// Update status to let user know options were saved.
				document.getElementsByName(target.name + "-status").forEach(status => {
					status.textContent = "saved";
					setTimeout(() => status.textContent = null, 1000);
				});
			});
		});
	});
}

function exportSafelist() {
	api.storage.sync.get({ unblocked: { }}).then(items => {
		// the unblocked list needs to be put into a different format for export
		const safelist = items.unblocked as { [k: string]: string | undefined };
		const content = "user_id,screen_name\n" + Object.entries(safelist).map(i => i[0] + "," + (i[1] ?? "this user's @ is not stored")).join("\n");
		const e = document.createElement("a");
		e.href = "data:text/csv;charset=utf-8," + encodeURIComponent(content);
		e.target = "_blank";
		e.download = "BlueBlockerSafelist.csv";
		e.click();
	});
}

// start this immediately so that it's ready when the document loads
const popupPromise = api.storage.local.get({ popupActiveTab: "quick" });

// restore state from storage
document.addEventListener("DOMContentLoaded", () => {
	const version = document.getElementById("version") as HTMLElement;
	version.textContent = "v" + api.runtime.getManifest().version;

	const quickTabButton = document.getElementById("button-quick") as HTMLElement;
	const advancedTabButton = document.getElementById("button-advanced") as HTMLElement;

	const quickTabContent = document.getElementById("quick") as HTMLElement;
	const advancedTabContent = document.getElementById("advanced") as HTMLElement;

	let popupActiveTab: string;

	function selectTab(tab: string) {
		const quickTabButtonBorder = quickTabButton.lastChild as HTMLElement;
		const advancedTabButtonBorder = advancedTabButton.lastChild as HTMLElement;

		switch (tab) {
			case "quick":
				document.body.style.overflowY = "hidden";
				quickTabButtonBorder.style.borderBottomWidth = "5px";
				advancedTabButtonBorder.style.borderBottomWidth = "0";

				quickTabContent.style.display = "block";
				advancedTabContent.style.display = "none";
				break;

			case "advanced":
				document.body.style.overflowY = "";
				quickTabButtonBorder.style.borderBottomWidth = "0";
				advancedTabButtonBorder.style.borderBottomWidth = "5px";

				quickTabContent.style.display = "none";
				advancedTabContent.style.display = "block";
				break;

			default:
				throw new Error("invalid tab value. must be one of: 'quick', 'advanced'.");
		}

		popupActiveTab = tab;
		api.storage.local.set({
			popupActiveTab,
		});
	}

	popupPromise.then(items => selectTab(items.popupActiveTab));
	quickTabButton.addEventListener("click", () => selectTab("quick"));
	advancedTabButton.addEventListener("click", () => selectTab("advanced"));

	// checkboxes
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
	const blockPromoted = document.getElementById("block-promoted-tweets") as HTMLInputElement;
	const blockNftAvatars = document.getElementById("block-nft-avatars") as HTMLInputElement;
	const soupcanIntegration = document.getElementById("soupcan-integration") as HTMLInputElement;

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		checkHandler(suspendBlockCollection, config, "suspendedBlockCollection", {
			callback(target) {
				document.getElementsByName(target.id + "-status").forEach(status => {
					status.textContent = target.checked ? "paused" : "resumed";
					setTimeout(() => status.textContent = null, 1000);
				});
				api.action.setIcon({ path: target.checked ? "/icon/icon-128-greyscale.png" : "/icon/icon-128.png" });
			},
		});
		checkHandler(showBlockPopups, config, "showBlockPopups", {
			optionName: "popup-timer-slider",
		});
		checkHandler(muteInsteadOfBlock, config, "mute");
		checkHandler(blockFollowing, config, "blockFollowing");
		checkHandler(blockFollowers, config, "blockFollowers");
		checkHandler(skipVerified, config, "skipVerified");
		checkHandler(skipAffiliated, config, "skipAffiliated");
		checkHandler(skip1Mplus, config, "skip1Mplus", {
			optionName: "skip-follower-count-option",
		});
		checkHandler(blockPromoted, config, "blockPromoted");
		checkHandler(blockNftAvatars, config, "blockNftAvatars");
		checkHandler(soupcanIntegration, config, "soupcanIntegration", {
			optionName: "",  // integration isn't controlled by the toggle, so unset
		});
	
		document.getElementsByName("skip-follower-count-value")
		.forEach(e => e.innerText = abbreviate(config.skipFollowerCount));
		inputMirror("skip-follower-count", config.skipFollowerCount, e => {
			const target = e.target as HTMLInputElement;
			const value = parseInt(target.value);
			const textValue = abbreviate(value);
			document.getElementsByName("skip-follower-count-value")
			.forEach(e => e.innerText = textValue);
			api.storage.sync.set({
				skipFollowerCount: value,
			}).then(() => {
				// Update status to let user know options were saved.
				document.getElementsByName(target.name + "-status").forEach(status => {
					status.textContent = "saved";
					setTimeout(() => status.textContent = null, 1000);
				});
			});
		});

		sliderMirror("block-interval", "blockInterval", config);
		sliderMirror("popup-timer", "popupTimer", config);

		// safelist logic
		// import cannot be done here, only on a standalone page
		document.getElementsByName("export-safelist").forEach(e => e.addEventListener("click", exportSafelist));
		document.getElementsByName("clear-safelist").forEach(e => {
			e.addEventListener("click", () =>
				api.storage.sync.set({ unblocked: { }}).then(() =>
					document.getElementsByName("safelist-status").forEach(s => s.innerText = "cleared safelist.")
				)
			);
		});
	});

	// @ts-ignore
	api.runtime.sendMessage(
		SoupcanExtensionId,
		{ action: "check_twitter_user", screen_name: "elonmusk" },
	).then((r: any) => {
		// we could check if response is the expected shape here, if we really wanted
		if (!r) {
			throw new Error("extension not enabled");
		}
		document.getElementsByName("soupcan-integration-option").forEach(e => e.style.display = "flex");
	}).catch((e: Error) => {
		console.debug(logstr, "soupcan response for @elonmusk:", e);
		document.getElementsByName("soupcan-integration-option").forEach(ele => ele.style.display = "none");
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
});
