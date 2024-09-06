import { api, logstr } from '../../constants.js';
import { commafy } from '../../utilities.js';
import '../style.css';
import './style.css';

function importSafelist(target: HTMLInputElement) {
	if (!target.files?.length) {
		return;
	}
	const reader = new FileReader();
	let loaded: number = 0;
	let success: boolean;
	reader.addEventListener('load', l => {
		// @ts-ignore
		const payload = l.target.result as string;
		api.storage.sync
			.get({ unblocked: {} })
			.then(items => {
				// so we have plain text files as an accepted type, so lets try both json and csv formats
				try {
					// json
					const userList = JSON.parse(payload) as [
						{ user_id?: string; id?: string; screen_name?: string; name?: string },
					];
					userList.forEach(user => {
						const user_id = user?.user_id ?? user.id;
						if (!user_id) {
							throw new Error(
								'failed to read user, expected at least one of: {user_id, id}.',
							);
						}
						success = true;
						items.unblocked[user_id] =
							user?.screen_name ?? user?.name ?? items.unblocked[user_id] ?? null;
						loaded++;
					});
				} catch (e) {
					console.debug(logstr, 'json failed', e, 'trying csv...');
				}
				try {
					// csv
					console.debug(logstr, 'attempting to read file using csv scheme');
					let headers: Array<string>;
					payload
						.split('\n')
						.map(i => i.trim())
						.forEach(line => {
							if (line.match(/"'/)) {
								throw new Error(
									'failed to read file, csv must not include quotes.',
								);
							}
							if (headers === undefined) {
								headers = line.split(',').map(i => i.trim());
								if (!headers.includes('user_id') && !headers.includes('id')) {
									throw new Error(
										'failed to read file, expected at least one of: {user_id, id}.',
									);
								}
								console.debug(logstr, 'headers:', headers);
								return;
							}
							const user: {
								user_id?: string;
								id?: string;
								screen_name?: string;
								name?: string;
							} = {};
							line.split(',')
								.map(i => i.trim())
								// @ts-ignore just ignore this monstrosity, it makes it easier afterwards
								.forEach((value, index) => (user[headers[index]] = value));
							const user_id = user?.user_id ?? (user.id as string);
							success = true;
							const name = user?.screen_name ?? user?.name;
							switch (name) {
								default:
									// theoretically we'd want to search for any character that can't
									// be in a handle, but just whitespace will do
									if (!name.match(/\s"'/)) {
										items.unblocked[user_id] = name;
										break;
									}
								case null:
								case undefined:
								case '':
								case 'null':
								case 'undefined':
									items.unblocked[user_id] = items.unblocked[user_id] ?? null;
							}
							loaded++;
						});
				} catch (e) {
					console.debug(logstr, 'csv failed.', e);
				}
				if (!success) {
					throw new Error(
						'failed to read file. make sure file is csv or json and contains at least user_id or id for each user.',
					);
				}
				return api.storage.sync.set(items);
			})
			.then(() => {
				const msg = `loaded ${commafy(loaded)} users into safelist`;
				console.log(logstr, msg);
				document.getElementsByName('safelist-status').forEach(s => {
					s.innerText = msg;
				});
			})
			.catch(e =>
				document
					.getElementsByName('safelist-status')
					.forEach(s => (s.innerText = e.message)),
			);
	});
	for (const i of target.files) {
		reader.readAsText(i);
	}
}

function exportSafelist() {
	api.storage.sync.get({ unblocked: {} }).then(items => {
		// the unblocked list needs to be put into a different format for export
		const safelist = items.unblocked as { [k: string]: string | undefined };
		const content =
			'user_id,screen_name\n' +
			Object.entries(safelist)
				.map(i => i[0] + ',' + (i[1] ?? "this user's @ is not stored"))
				.join('\n');
		const e = document.createElement('a');
		e.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
		e.target = '_blank';
		e.download = 'BlueBlockerSafelist.csv';
		e.click();
	});
}

document.addEventListener('DOMContentLoaded', () => {
	const safelistInput = document.getElementById('import-safelist') as HTMLInputElement;
	// safelist logic
	safelistInput.addEventListener('input', e => importSafelist(e.target as HTMLInputElement));
	document
		.getElementsByName('export-safelist')
		.forEach(e => e.addEventListener('click', exportSafelist));
	document.getElementsByName('clear-safelist').forEach(e => {
		e.addEventListener('click', () =>
			api.storage.sync
				.set({ unblocked: {} })
				.then(() =>
					document
						.getElementsByName('safelist-status')
						.forEach(s => (s.innerText = 'cleared safelist.')),
				),
		);
	});
});
