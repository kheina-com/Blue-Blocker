import { commafy, FormatLegacyName, UsernameElement } from '../../utilities';
import { api, logstr } from '../../constants';
import { AddUserToQueue, ConnectDb, queueDbStore, WholeQueue } from '../../background/db';
import '../style.css';
import './style.css';

async function unqueueUser(user_id: string, screen_name: string, safelist: boolean) {
	// because this page holds onto the critical point, we can modify the queue
	// without worrying about if it'll affect another tab
	if (safelist) {
		api.storage.sync.get({ unblocked: {} }).then(items => {
			items.unblocked[String(user_id)] = screen_name;
			api.storage.sync.set(items);
		});
	}

	ConnectDb()
		.then(db => {
			return new Promise<void>((resolve, reject) => {
				const transaction = db.transaction([queueDbStore], 'readwrite');
				transaction.onabort = transaction.onerror = reject;
				const store = transaction.objectStore(queueDbStore);
				store.delete(user_id);
				transaction.commit();
				transaction.oncomplete = () => resolve();
			});
		})
		.catch(e => {
			console.error(logstr, 'could not remove user from queue:', e);
		});
}

function loadQueue() {
	WholeQueue().then(cue => {
		const queueDiv = document.getElementById('block-queue') as HTMLElement;

		if (cue.length === 0) {
			queueDiv.textContent = 'your block queue is empty';
			return;
		} else if (cue.length >= 10e3) {
			const dbLimitReached = document.getElementById('db-limit-reached') as HTMLElement;
			dbLimitReached.style.display = 'block';
		}

		queueDiv.innerText = '';

		cue.forEach(item => {
			const { user, user_id } = item;
			const div = document.createElement('div');

			const p = UsernameElement(item.user.name, item.user.screen_name);
			div.appendChild(p);

			const remove = document.createElement('button');
			remove.onclick = () => {
				div.removeChild(remove);
				unqueueUser(user_id, user.screen_name, false).then(() => {
					console.log(logstr, `removed ${FormatLegacyName(user)} from queue`);
					queueDiv.removeChild(div);
				});
			};
			remove.textContent = 'remove';
			div.appendChild(remove);

			const never = document.createElement('button');
			never.onclick = () => {
				div.removeChild(never);
				unqueueUser(user_id, user.screen_name, true).then(() => {
					console.log(
						logstr,
						`removed and safelisted ${FormatLegacyName(user)} from queue`,
					);
					queueDiv.removeChild(div);
				});
			};
			never.textContent = 'never block';
			div.appendChild(never);

			queueDiv.appendChild(div);
		});
	});
}
loadQueue();

document.addEventListener('DOMContentLoaded', () => {
	const importButton = document.getElementById('import-button') as HTMLElement;
	const importArrow = document.getElementById('import-arrow') as HTMLElement;
	const importBlock = document.getElementById('importer') as HTMLElement;

	importButton.addEventListener('click', e => {
		switch (importArrow.innerText) {
			case '▾':
				importBlock.style.display = 'block';
				importArrow.innerText = '▴';
				break;
			case '▴':
				importBlock.style.display = '';
				importArrow.innerText = '▾';
				break;
			default:
			// what?
		}
	});

	const defaultInputText = 'Click or Drag to Import File';
	const input = document.getElementById('block-import') as HTMLInputElement;
	const importLabel = document.getElementById('block-import-label') as HTMLElement;
	const inputStatus = importLabel.firstElementChild as HTMLElement;
	inputStatus.innerText = defaultInputText;
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
		let safelisted: number = 0;
		reader.addEventListener('load', l => {
			inputStatus.innerText = 'importing...';
			// @ts-ignore
			const payload = l.target.result as string;
			api.storage.sync
				.get({ unblocked: {} })
				.then(items => items.unblocked as { [k: string]: string | null })
				.then(safelist => {
					return new Promise<void>(async resolve => {
						const userList = JSON.parse(payload) as BlockUser[];
						for (const user of userList) {
							try {
								// explicitly check to make sure all fields are populated
								if (
									user?.user_id === undefined ||
									user?.user?.name === undefined ||
									user?.user?.screen_name === undefined ||
									user?.reason === undefined
								) {
									throw new Error('user object could not be processed:');
								}

								if (safelist.hasOwnProperty(user.user_id)) {
									safelisted++;
									continue;
								}

								await AddUserToQueue(user);
								loaded++;
							} catch (_e) {
								const e = _e as Error;
								console.error(logstr, e.message, user, e);
								failures++;
								return;
							}
						}
						resolve();
					})
						.then(() => {
							console.log(
								logstr,
								'successfully loaded',
								loaded,
								'users into queue. failures:',
								failures,
							);
							inputStatus.innerText = `loaded ${commafy(
								loaded,
							)} users into queue (${commafy(failures)} failures)`;
							loadQueue();
						})
						.catch(e => {
							console.error(logstr, e);
							inputStatus.innerText = e.message;
						})
						.finally(() => {
							timeout = setTimeout(() => {
								inputStatus.innerText = 'Click or Drag to Import File';
								timeout = null;
							}, 10e3);
						});
				});
		});
		for (const i of files) {
			reader.readAsText(i);
		}
	}

	input.addEventListener('input', e => {
		const target = e.target as HTMLInputElement;
		onInput(target.files);
	});
	importLabel.addEventListener('dragenter', e => e.preventDefault());
	importLabel.addEventListener('dragover', e => e.preventDefault());
	importLabel.addEventListener('drop', e => {
		e.preventDefault();
		onInput(e?.dataTransfer?.files);
	});
});
