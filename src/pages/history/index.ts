import { commafy, FormatLegacyName, RefId } from "../../utilities.js";
import { api, logstr, HistoryStateBlocked, HistoryStateUnblocked, ReasonMap } from "../../constants.js";
import { BlockedUser, ConnectHistoryDb, historyDbStore } from "../../background/db.js";
import { BlockCounter } from "../../models/block_counter";
import "./style.css";

const blockCounter = new BlockCounter(api.storage.local);

ConnectHistoryDb().then(db => {
	new Promise<Array<BlockedUser>>((resolve, reject) => {
		const transaction = db.transaction([historyDbStore], "readonly");
		transaction.onabort = transaction.onerror = reject;
		const store = transaction.objectStore(historyDbStore);
		const req = store.getAll();

		req.onerror = reject;
		req.onsuccess = () => {
			const users = req.result as BlockedUser[];
			resolve(users);
		};
	}).then(users => {
		const queueDiv = document.getElementById("block-history") as HTMLElement;

		if (users.length === 0) {
			queueDiv.textContent = "your block queue is empty";
			return;
		}

		queueDiv.innerHTML = "";

		(() => {
			const blockedUsersCount = document.getElementById("blocked-users-count") as HTMLElement;
			blockedUsersCount.innerText = commafy(users.length);

			const refid = RefId();
			blockCounter.getCriticalPoint(refid)
			.then(() => blockCounter.storage.get({ BlockCounter: 0 }))
			.then(items => items.BlockCounter as number)
			.then((count) => {
				if (users.length === count) {
					return;
				}

				const resetCounter = document.getElementById("reset-counter") as HTMLElement;
				const a = resetCounter.lastElementChild as HTMLElement;
				a.addEventListener("click", () => {
					const refid = RefId();
					blockCounter.getCriticalPoint(refid)
					.then(() =>
						blockCounter.storage.set({ BlockCounter: users.length })
					).then(() =>
						resetCounter.style.display = ""
					).finally(() =>
						blockCounter.releaseCriticalPoint(refid)
					);
				});

				resetCounter.style.display = "block";
			}).finally(() =>
				blockCounter.releaseCriticalPoint(refid)
			);
		})();

		users.forEach(item => {
			const div = document.createElement("div");
			const p = document.createElement("p");
			p.innerHTML = `${item.user.name} (<a href="https://twitter.com/${item.user.screen_name}" target="_blank">@${item.user.screen_name}</a>)`;
			div.appendChild(p);

			const p2 = document.createElement("p");
			const reason = item?.external_reason ?? ReasonMap[item.reason];
			p2.innerText = "reason: " + reason;
			div.appendChild(p2);

			const p3 = document.createElement("p");
			const state = item.state === HistoryStateBlocked ? "blocked" : "unblocked";
			p3.innerText = "current state: " + state;
			div.appendChild(p3);

			queueDiv.appendChild(div);
		});
	});
});
