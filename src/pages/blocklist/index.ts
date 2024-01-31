import { ConnectDb, historyDbStore } from '../../background/db';
import { api, logstr, EventKey, ReasonImported, ListImportEvent } from '../../constants';
import { EscapeHtml, commafy } from '../../utilities';

export function exportBlockList() {
	ConnectDb().then((db) => {
		// Pause queue consumer
		api.storage.sync.set({ ['suspendedBlockCollection']: true });
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
		})
			.then((users) => {
				const userInfo = users.map((item) => {
					return {
						user_id: item.user_id,
						screen_name: EscapeHtml(item.user.screen_name),
					};
				});
				const blob = new Blob([JSON.stringify(userInfo, undefined, 2)], {
					type: 'application/json',
				});
				const e = document.createElement('a');
				e.href = URL.createObjectURL(blob);
				e.target = '_blank';
				e.download = 'BlueBlockerBlockList.json';
				e.click();
			})
			.catch((_e) => {
				console.error(`${logstr} ${_e}`);
			})
			.finally(() => {
				//Resume queue consumer
				api.storage.sync.set({ ['suspendedBlockCollection']: false });
			});
	});
}

function createPromiseArray(callback: Function, ...inputs: File[]) {
	let result: Promise<BlockUser[]>[] = [];
	for (const input of inputs) {
		result.push(callback(input));
	}
	return result;
}

async function fileProcess(file: File) {
	const reader = new FileReader();
	let success: boolean;
	const listName = file.name.trim().replace(/\.\w*$/g, '');
	const p: Promise<BlockUser[]> = new Promise((resolve, reject) => {
		reader.addEventListener('load', (l) => {
			// @ts-ignore
			const payload = l.target.result as string;
			// Normalized names
			let blockList: BlockUser[] = [];
			try {
				// json
				const userList = JSON.parse(payload) as {
					user_id?: string;
					id?: string;
					screen_name?: string;
					name?: string;
				}[];
				userList.forEach((user) => {
					const id = user?.user_id ?? user.id;
					const screenName = user?.screen_name ?? user.name ?? '';
					if (id === undefined) {
						return;
					}
					success = true;
					// In a perfect world we could pull the display name out of the API but im lazy :(
					blockList.push({
						user_id: id,
						user: { screen_name: screenName, name: '' },
						reason: ReasonImported,
						external_reason: listName,
					});
				});
			} catch (e) {
				console.debug(logstr, 'json failed', e, 'trying csv...');
				try {
					// csv
					console.debug(logstr, 'attempting to read file using csv scheme');
					let headers: Array<string>;
					payload
						.split('\n')
						.map((i) => i.trim())
						.forEach((line) => {
							if (line.match(/"'/)) {
								reject('failed to read file, csv must not include quotes.');
							}
							if (headers === undefined) {
								headers = line.split(',').map((i) => i.trim());
								if (!headers.includes('user_id') && !headers.includes('id')) {
									reject(
										'failed to read file, expected at least one of: {user_id, id}.',
									);
								}
								console.debug(logstr, 'headers:', headers);
								return;
							}
							const temp: {
								user_id?: string;
								id?: string;
								screen_name?: string;
								name?: string;
							} = {};

							line.split(',')
								.map((i) => i.trim())
								// @ts-ignore aaaaaaaaaaaaaaaaaaaaa
								.forEach((value, index) => (temp[headers[index]] = value));

							const id = temp?.user_id ?? temp.id;
							if (id === undefined) {
								return reject('user ID missing');
							}
							const screenName = temp?.screen_name ?? temp?.name ?? '';
							blockList.push({
								user_id: id,
								user: { screen_name: screenName, name: '' },
								reason: ReasonImported,
								external_reason: listName,
							});
						});
				} catch (e) {
					console.debug(logstr, 'csv failed.', e);
				}
			}
			if (!success) {
				reject(
					'failed to read file. make sure file is csv or json and contains at least user_id or id for each user.',
				);
			}
			api.storage.sync.get({ blockLists: {} }).then((items) => {
				items.blockLists[listName] = { size: blockList.length, date: new Date() };
				api.storage.sync.set(items);
			});
			resolve(blockList);
		});
	});
	reader.readAsText(file);
	return p;
}

const defaultInputText = 'Click or Drag to Import File';
async function importBlockList(files: FileList | undefined | null) {
	if (!files?.length) {
		return;
	}
	const statusElements = document.getElementsByName('blocklist-status');

	Promise.allSettled(createPromiseArray(fileProcess, ...files))
		.then(async (results) => {
			const tmp = (await api.storage.local.get({ BlockQueue: [] })).BlockQueue as BlockUser[];
			const oldL = tmp.length;
			const queue: { [k: string]: BlockUser } = {};
			tmp.forEach((v) => (queue[v.user_id] = v));
			const safelist = (await api.storage.sync.get({ unblocked: [] })).unblocked as {
				[k: string]: string | null;
			};

			for (const result of results) {
				if (result.status == 'rejected') {
					continue;
				}
				for (const user of result.value) {
					if (!safelist?.[user.user_id]) {
						continue;
					}
					queue[user.user_id] = user;
				}
			}
			const write = Array.from(Object.values(queue));
			api.storage.local.set({ BlockQueue: write });
			const newL = write.length;
			const msg = `loaded ${commafy(newL - oldL)} into queue`;
			console.log(logstr, msg);
			statusElements.forEach((e) => (e.innerText = msg));
		})
		.catch((e) => {
			console.error(logstr, e);
		})
		.finally(() => {
			setTimeout(() => {
				statusElements.forEach((e) => {
					e.innerText = 'Click or Drag to Import File';
				});
			}, 10e3);
		});
}

const now = new Date();
function addListEntry(target: HTMLDivElement, name: string, val: { size: number; date: Date }) {
	const div = document.createElement('div');

	const p1 = document.createElement('p');
	p1.innerText = `List: ${name}`;
	div.appendChild(p1);

	const p2 = document.createElement('p');
	p2.innerText = `Includes ${commafy(val.size)} accounts`;
	div.appendChild(p2);

	const p3 = document.createElement('p');
	const time = new Date(val.date);
	const timeString = `${time.toLocaleTimeString('en')} on ${time
		.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
		.replace(`, ${now.getFullYear()}`, '')}`;
	p3.innerText = `Last updated: ${timeString}`;
	div.appendChild(p3);

	target.appendChild(div);
}

document.addEventListener('DOMContentLoaded', () => {
	const blockListInput = document.getElementById('import-blocklist') as HTMLInputElement,
		importLabel = document.getElementById('import-blocklist-label') as HTMLElement;
	blockListInput.addEventListener('input', (e) => {
		const target = e.target as HTMLInputElement;
		importBlockList(target.files as FileList);
	});
	importLabel.addEventListener('dragenter', (e) => e.preventDefault());
	importLabel.addEventListener('dragover', (e) => e.preventDefault());
	importLabel.addEventListener('drop', (e) => {
		e.preventDefault();
		importBlockList(e?.dataTransfer?.files);
	});

	document
		.getElementsByName('export-blocklist')
		.forEach((e) => e.addEventListener('click', exportBlockList));
	api.storage.sync.get({ blockLists: {} }).then((items) => {
		const lists = items.blockLists as { [k: string]: { size: number; date: Date } };
		const box = document.getElementById('current-blocklists') as HTMLDivElement;
		box.innerText = '';
		for (const [key, val] of Object.entries(lists)) {
			addListEntry(box, key, val);
		}
	});
});
