import { commafy, EscapeHtml, RefId } from '../../utilities.js';
import {
	api,
	logstr,
	HistoryStateBlocked,
	ReasonMap,
	ReasonExternal,
	HistoryStateUnblocked,
	HistoryStateGone,
} from '../../constants.js';
import { ConnectDb, historyDbStore } from '../../background/db.js';
import { BlockCounter } from '../../models/block_counter';
import '../style.css';
import './style.css';

const blockCounter = new BlockCounter(api.storage.local);
const refid = RefId();

// grab block counter critical point to compare counters safely
blockCounter
	.getCriticalPoint(refid)
	.then(ConnectDb)
	.then((db) => {
		return new Promise<BlockedUser[]>((resolve, reject) => {
			const transaction = db.transaction([historyDbStore], 'readonly');
			transaction.onabort = transaction.onerror = reject;
			const store = transaction.objectStore(historyDbStore);
			const index = store.index('time');
			const req = index.getAll();

			req.onerror = reject;
			req.onsuccess = () => {
				const users = req.result as BlockedUser[];
				resolve(users);
			};
		}).then((users) => {
			const queueDiv = document.getElementById('block-history') as HTMLElement;

			queueDiv.innerHTML = '';
			let blockedCount: number = 0;

			const reasons: { [r: number]: number } = {};
			users.reverse().forEach((item) => {
				if (!reasons.hasOwnProperty(item.reason)) {
					reasons[item.reason] = 0;
				}

				const div = document.createElement('div');
				const p = document.createElement('p');
				const screen_name = EscapeHtml(item.user.screen_name);
				p.innerHTML = `${EscapeHtml(
					item.user.name,
				)} (<a href="https://twitter.com/${screen_name}" target="_blank">@${screen_name}</a>)`;
				div.appendChild(p);

				const p2 = document.createElement('p');
				const reason = item?.external_reason ?? ReasonMap[item.reason];
				p2.innerText = 'reason: ' + reason;
				div.appendChild(p2);

				const p3 = document.createElement('p');
				let state: string;
				switch (item.state) {
					case HistoryStateBlocked:
						state = 'blocked';
						blockedCount++;
						reasons[item.reason]++;
						break;

					case HistoryStateUnblocked:
						state = 'unblocked';
						blockedCount++;
						reasons[item.reason]++;
						break;

					case HistoryStateGone:
						state = 'user no longer exists';
						break;

					default:
						state = 'unreadable state';
				}
				p3.innerText = 'current state: ' + state;
				div.appendChild(p3);

				const p4 = document.createElement('p');
				const time = new Date(item.time);
				const datetime =
					time
						.toLocaleDateString('en', {
							year: 'numeric',
							month: 'short',
							day: 'numeric',
						})
						.replace(`, ${new Date().getFullYear()}`, '') +
					', ' +
					time.toLocaleTimeString().toLowerCase();
				p4.innerText = state + ' on ' + datetime;
				div.appendChild(p4);

				queueDiv.appendChild(div);
			});

			document
				.getElementsByName('blocked-users-count')
				.forEach((e) => (e.innerText = commafy(blockedCount)));

			blockCounter
				.getCriticalPoint(refid)
				.then(() => blockCounter.storage.get({ BlockCounter: 0 }))
				.then((items) => items.BlockCounter as number)
				.then((count) => {
					if (blockedCount === count) {
						return;
					}

					const blockCounterCurrentValue = document.getElementById(
						'block-counter-current-value',
					) as HTMLElement;
					blockCounterCurrentValue.innerText = commafy(count);

					const resetCounter = document.getElementById('reset-counter') as HTMLElement;
					const a = resetCounter.firstElementChild as HTMLElement;
					a.addEventListener('click', () => {
						const refid = RefId();
						blockCounter
							.getCriticalPoint(refid)
							.then(() => blockCounter.storage.set({ BlockCounter: blockedCount }))
							.then(() => {
								console.log(logstr, 'reset block counter to', blockedCount);
								resetCounter.style.display = '';
							})
							.finally(() => blockCounter.releaseCriticalPoint(refid));
					});

					resetCounter.style.display = 'block';
				})
				.finally(() => blockCounter.releaseCriticalPoint(refid));

			if (users.length === 0) {
				queueDiv.textContent = 'your block history is empty';
				return;
			}

			const detailedCounts = document.getElementById('detailed-counts') as HTMLElement;
			const reasonMap = {
				[ReasonExternal]: 'external extension',
				...ReasonMap,
			};
			detailedCounts.innerText =
				'(' +
				Object.entries(reasons)
					.map((item) => reasonMap[parseInt(item[0])] + ': ' + commafy(item[1]))
					.join(', ') +
				')';
		});
	});
