import { BlockQueue } from "../models/block_queue.js";
import { FormatLegacyName } from "../utilities.js";
import { api, logstr } from "../constants.js";

// Define constants that shouldn't be exported to the rest of the addon
const queue = new BlockQueue(api.storage.local);

// we need to obtain and hold on to the critical point as long as this tab is
// open so that any twitter tabs that are open are unable to block users
setInterval(async () => {
	await queue.getCriticalPoint()
}, 500);

async function unqueueUser(user_id) {
	// because this page holds onto the critical point, we can modify the queue
	// without worrying about if it'll affect another tab
	api.storage.sync.get({ unblocked: { } }).then(items => {
		items.unblocked[String(user_id)] = null;
		api.storage.sync.set(items);
	});

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
queue.getCriticalPoint()
.then(() => api.storage.local.get({ BlockQueue: [] }))
.then(items => {
	const queueDiv = document.getElementById("block-queue");

	if (items.BlockQueue.length === 0) {
		queueDiv.textContent = "your block queue is empty";
		return;
	}

	queueDiv.innerHTML = null;

	items.BlockQueue.forEach(item => {
		const { user, user_id } = item;
		const div = document.createElement("div");

		const p = document.createElement("p");
		p.innerHTML = `${user.legacy.name} (<a href="https://twitter.com/${user.legacy.screen_name}" target="_blank">@${user.legacy.screen_name}</a>)`;
		div.appendChild(p);

		const b = document.createElement("button");
		b.onclick = () => {
			div.removeChild(b);
			unqueueUser(user_id).then(() => {
				queueDiv.removeChild(div);
			});
			console.log(logstr, `removed ${FormatLegacyName(user)} from queue`);
		};
		b.textContent = "remove";
		div.appendChild(b);

		queueDiv.appendChild(div);
	});
});
