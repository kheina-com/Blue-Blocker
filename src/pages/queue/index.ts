import { BlockQueue } from "../../models/block_queue.js";
import { commafy, EscapeHtml, FormatLegacyName, RefId } from "../../utilities.js";
import { api, logstr } from "../../constants.js";
import "./style.css";

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);

// we need to obtain and hold on to the critical point as long as this tab is
// open so that any twitter tabs that are open are unable to block users
const refId = RefId();
const interval = 5000;
setInterval(async () => {
	await queue.getCriticalPoint(refId, interval);
}, 500);

async function unqueueUser(user_id: string, safelist: boolean) {
	// because this page holds onto the critical point, we can modify the queue
	// without worrying about if it'll affect another tab
	if (safelist) {
		api.storage.sync.get({ unblocked: { } }).then(items => {
			items.unblocked[String(user_id)] = null;
			api.storage.sync.set(items);
		});
	}

	const items = await api.storage.local.get({ BlockQueue: [] });

	for (let i = 0; i < items.BlockQueue.length; i++) {
		if (items.BlockQueue[i].user_id === user_id) {
			items.BlockQueue.splice(i, 1);
			break;
		}
	}

	await api.storage.local.set(items);
}

function loadQueue() {
	// interval doesn't run immediately, so do that here
	queue.getCriticalPoint(refId)
	.then(() => api.storage.local.get({ BlockQueue: [] }))
	.then(items => {
		const cue = items.BlockQueue as BlockUser[];
		const queueDiv = document.getElementById("block-queue") as HTMLElement;

		if (cue.length === 0) {
			queueDiv.textContent = "your block queue is empty";
			return;
		}

		queueDiv.innerHTML = "";

		cue.forEach(item => {
			const { user, user_id } = item;
			const div = document.createElement("div");

			// required for users enqueued before 0.3.0
			if (user.hasOwnProperty("legacy")) {
				// @ts-ignore
				for (const [key, value] of Object.entries(user.legacy)) {
					// @ts-ignore
					user[key] = value;
				}
			}

			const p = document.createElement("p");
			const screen_name = EscapeHtml(user.screen_name);  // this shouldn't really do anything, but can't be too careful
			p.innerHTML = `${EscapeHtml(user.name)} (<a href="https://twitter.com/${screen_name}" target="_blank">@${screen_name}</a>)`;
			div.appendChild(p);

			const remove = document.createElement("button");
			remove.onclick = () => {
				div.removeChild(remove);
				unqueueUser(user_id, false).then(() => {
					queueDiv.removeChild(div);
				});
				console.log(logstr, `removed ${FormatLegacyName(user)} from queue`);
			};
			remove.textContent = "remove";
			div.appendChild(remove);

			const never = document.createElement("button");
			never.onclick = () => {
				div.removeChild(never);
				unqueueUser(user_id, true).then(() => {
					queueDiv.removeChild(div);
				});
				console.log(logstr, `removed and safelisted ${FormatLegacyName(user)} from queue`);
			};
			never.textContent = "never block";
			div.appendChild(never);

			queueDiv.appendChild(div);
		});
	});
}
loadQueue();

document.addEventListener("DOMContentLoaded", () => {
	const importButton = document.getElementById("import-button") as HTMLElement;
	const importArrow = document.getElementById("import-arrow") as HTMLElement;
	const importBlock = document.getElementById("importer") as HTMLElement;

	importButton.addEventListener("click", e => {
		switch (importArrow.innerText) {
			case "▾":
				importBlock.style.display = "block";
				importArrow.innerText = "▴";
				break;
			case "▴":
				importBlock.style.display = "";
				importArrow.innerText = "▾";
				break;
			default:
				// what?
		}
	});

	const input = document.getElementById("block-import") as HTMLInputElement;
	const importLabel = document.getElementById("block-import-label") as HTMLElement;
	const inputStatus = importLabel.firstElementChild as HTMLElement;
	let timeout: number | null = null;

	function onInput(files: FileList | null | undefined) {
		if (timeout) {
			clearTimeout(timeout);
		}

		if (!files?.length) {
			return;
		}

		const reader = new FileReader();
		let loaded: number = 0;
		let failures: number = 0;
		reader.addEventListener("load", l => {
			inputStatus.innerText = "importing...";
			// @ts-ignore
			const payload = l.target.result as string;
			api.storage.local.get({ BlockQueue: [] }).then(items => {
				const queue: { [u: string]: BlockUser } = { };
				for (const user of items.BlockQueue as BlockUser[]) {
					queue[user.user_id] = user;
				}

				const userList = JSON.parse(payload) as BlockUser[];
				userList.forEach(user => {
					// explicitly check to make sure all fields are populated
					if (
						user?.user_id === undefined ||
						user?.user?.name === undefined ||
						user?.user?.screen_name === undefined ||
						user?.reason === undefined
					) {
						console.error(logstr, "user object could not be processed:", user);
						failures++;
						return;
					}

					queue[user.user_id] = user;
					loaded++;
				});

				return api.storage.local.set({ BlockQueue: Array.from(Object.values(queue)) });
			}).then(() => {
				console.log(logstr, "successfully loaded", loaded, "users into queue. failures:", failures);
				inputStatus.innerText = `loaded ${commafy(loaded)} users into queue (${commafy(failures)} failures)`;
				loadQueue();
			}).catch(e => {
				console.error(logstr, e);
				inputStatus.innerText = e.message;
			}).finally(() => {
				timeout = setTimeout(() => {
					inputStatus.innerText = "Click or Drag to Import File";
					timeout = null;
				}, 10e3);
			});
		});
		for (const i of files) {
			reader.readAsText(i);
		}
	}

	input.addEventListener("input", e => {
		const target = e.target as HTMLInputElement;
		onInput(target.files)
	});
	importLabel.addEventListener("dragenter", e => e.preventDefault());
	importLabel.addEventListener("dragover", e => e.preventDefault());
	importLabel.addEventListener("drop", e => {
		e.preventDefault();
		onInput(e?.dataTransfer?.files);
	});
});
