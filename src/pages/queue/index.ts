import { BlockQueue } from "../../models/block_queue.js";
import { FormatLegacyName, RefId } from "../../utilities.js";
import { api, logstr } from "../../constants.js";
import "./style.css";

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);

// we need to obtain and hold on to the critical point as long as this tab is
// open so that any twitter tabs that are open are unable to block users
const refId = RefId();
setInterval(async () => {
	await queue.getCriticalPoint(refId);
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

// interval doesn't run immediately, so do that here
queue.getCriticalPoint(refId)
.then(() => api.storage.local.get({ BlockQueue: [] }))
.then(items => {
	const queue = items.BlockQueue as BlockUser[];
	const queueDiv = document.getElementById("block-queue") as HTMLElement;

	if (queue.length === 0) {
		queueDiv.textContent = "your block queue is empty";
		return;
	}

	queueDiv.innerHTML = "";

	queue.forEach(item => {
		const { user, user_id } = item;
		const div = document.createElement("div");

		const p = document.createElement("p");
		p.innerHTML = `${user.name} (<a href="https://twitter.com/${user.screen_name}" target="_blank">@${user.screen_name}</a>)`;
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