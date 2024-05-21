import {
	api,
	logstr,
	EventKey,
	LegacyVerifiedUrl,
	MessageEvent,
	ErrorEvent,
	HistoryStateBlocked,
	HistoryStateUnblocked,
} from '../constants';
import { commafy, QueueId } from '../utilities';

const expectedVerifiedUsersCount = 407520;
let legacyDb: IDBDatabase;
// used so we don't load the db twice
let legacyDbLoaded: boolean = false;

interface LegacyVerifiedUser {
	user_id: string;
	handle: string;
}

const legacyDbName = 'legacy-verified-users';
const legacyDbStore = 'verified_users';
const legacyDbVersion = 1;

// populates local storage with legacy verified users for the purpose of avoiding legacy verified
export async function PopulateVerifiedDb() {
	const opts = await api.storage.sync.get({ skipVerified: true });
	if (!opts.skipVerified) {
		console.log(logstr, 'skip verified false, not populating legacyDb', opts);
		return;
	}

	const DBOpenRequest = indexedDB.open(legacyDbName, legacyDbVersion);

	DBOpenRequest.onerror = DBOpenRequest.onblocked = () => {
		console.error(logstr, 'failed to open legacy verified user database:', DBOpenRequest);
	};

	DBOpenRequest.onupgradeneeded = (e) => {
		console.debug(logstr, 'legacy db onupgradeneeded:', e);
		legacyDb = DBOpenRequest.result;
		if (legacyDb.objectStoreNames.contains(legacyDbStore)) {
			return;
		}

		legacyDb.createObjectStore(legacyDbStore, { keyPath: 'user_id' });
		console.log(logstr, 'created legacy database.');
	};

	DBOpenRequest.onsuccess = async () => {
		console.debug(logstr, 'successfully connected to legacy db');
		legacyDb = DBOpenRequest.result;

		if (legacyDbLoaded) {
			// this function only runs if skipVerified is true. this is here so that if there
			// was a failure elsewhere that we're recovering from, we re-enable the option
			api.storage.sync.set({ skipVerified: true });
			return;
		}
		console.debug(logstr, 'checking verified user database.');

		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = legacyDb.transaction([legacyDbStore], 'readwrite');
				const store = transaction.objectStore(legacyDbStore);
				const req = store.count();

				req.onerror = reject;
				req.onsuccess = () => {
					const count = req.result as number;
					if (count !== expectedVerifiedUsersCount) {
						reject(
							`legacy verified users database (${commafy(
								count,
							)}) did not contain the expected number of users (${commafy(
								expectedVerifiedUsersCount,
							)})`,
						);
					} else {
						console.log(logstr, 'loaded', count, 'legacy verified users');
						resolve();
					}
				};
			});
		} catch (_e) {
			// const e = _e as Error;
			await new Promise<void>((resolve, reject) => {
				const transaction = legacyDb.transaction([legacyDbStore], 'readwrite');
				const store = transaction.objectStore(legacyDbStore);
				const req = store.clear();

				req.onerror = reject;
				req.onsuccess = () => {
					console.debug(logstr, 'cleared existing legacyDb store.');
					resolve();
				};
			});

			(() => {
				const message =
					'downloading legacy verified users database, this may take a few minutes.';
				api.storage.local.set({
					[EventKey]: {
						type: MessageEvent,
						message,
					},
				});
				console.log(logstr, message);
			})();

			let count: number = 0;
			const body = await fetch(LegacyVerifiedUrl).then((r) => r.text());

			let intact: boolean = false;
			const transaction = legacyDb.transaction([legacyDbStore], 'readwrite');
			const store = transaction.objectStore(legacyDbStore);

			for (const line of body.split('\n')) {
				if (line === 'Twitter ID, Screen name, Followers') {
					console.debug(logstr, 'response csv good!');
					intact = true;
					continue;
				} else if (!intact) {
					const message =
						'legacy verified users database was mangled or otherwise unable to be parsed';
					console.error(logstr, message);
					api.storage.local.set({
						[EventKey]: {
							type: ErrorEvent,
							message,
						},
					});
					throw new Error(message);
				}

				await new Promise<void>((resolve, reject) => {
					const [user_id, handle, _] = line.split(',');
					const item: LegacyVerifiedUser = { user_id, handle };
					const req = store.add(item);

					req.onerror = reject;
					req.onsuccess = () => {
						count++;
						if (count % 1000 === 0) {
							console.debug(logstr, 'stored 1,000 legacy verified users');
						}
						resolve();
					};
				});
			}

			transaction.commit();
			console.debug(
				logstr,
				'committed',
				count,
				'users to legacy verified legacyDb:',
				transaction,
			);

			const message = `loaded ${commafy(count)} legacy verified users!`;
			console.log(logstr, message);
			api.storage.local.set({
				[EventKey]: {
					type: MessageEvent,
					message,
				},
			});

			if (count !== expectedVerifiedUsersCount) {
				throw new Error(
					`legacy verified users database (${commafy(
						count,
					)}) did not contain the expected number of users (${commafy(
						expectedVerifiedUsersCount,
					)})`,
				);
			}
		}
		api.storage.sync.set({ skipVerified: true });
		legacyDbLoaded = true;
	};

	console.debug(logstr, 'opening legacy verified user database:', DBOpenRequest);
}

export function CheckDbIsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	// @ts-ignore  // typescript is wrong here, this cannot return idb due to final throws
	return new Promise<boolean>((resolve, reject) => {
		const transaction = legacyDb.transaction([legacyDbStore], 'readonly');
		transaction.onabort = transaction.onerror = reject;
		const store = transaction.objectStore(legacyDbStore);
		const req = store.get(user_id);

		req.onerror = reject;
		req.onsuccess = () => {
			const user = req.result as LegacyVerifiedUser;
			resolve(user_id === user?.user_id && handle === user?.handle);
		};
	}).catch((e) => {
		// if the db has already been loaded, we can safely reconnect
		if (legacyDbLoaded) {
			return PopulateVerifiedDb().finally(() => {
				throw e; // re-throw error
			});
		}
		throw e; // re-throw error
	});
}

let db: IDBDatabase;

const dbName = 'blue-blocker-db';
export const historyDbStore = 'blocked_users';
export const queueDbStore = 'block_queue';
const dbVersion = 2;
// used so we don't load the db twice
let dbLoaded: boolean = false;

export function ConnectDb(): Promise<IDBDatabase> {
	// why use a promise instead of a normal async? so that we can resolve or reject on db connect
	return new Promise<IDBDatabase>((resolve, reject) => {
		// this logic should also be much easier because we don't need to populate anything (thank god)
		const DBOpenRequest = indexedDB.open(dbName, dbVersion);
		DBOpenRequest.onerror = DBOpenRequest.onblocked = () => {
			console.error(logstr, 'failed to connect database:', DBOpenRequest);
			return reject();
		};

		DBOpenRequest.onupgradeneeded = (e) => {
			console.debug(logstr, 'upgrading db:', e);
			db = DBOpenRequest.result;

			if (!db.objectStoreNames.contains(historyDbStore)) {
				const store = db.createObjectStore(historyDbStore, { keyPath: 'user_id' });
				store.createIndex('user.name', 'user.name', { unique: false });
				store.createIndex('user.screen_name', 'user.screen_name', { unique: false });
				store.createIndex('time', 'time', { unique: false });
				console.log(logstr, 'created history database.');
			}

			if (!db.objectStoreNames.contains(queueDbStore)) {
				const store = db.createObjectStore(queueDbStore, { keyPath: 'user_id' });
				store.createIndex('user_id', 'user_id', { unique: true });
				store.createIndex('queue', 'queue', { unique: false });
				console.log(logstr, 'created queue database.');
			}
		};

		DBOpenRequest.onsuccess = async () => {
			db = DBOpenRequest.result;
			if (dbLoaded) {
				return resolve(db);
			}
			dbLoaded = true;

			const items = await api.storage.local.get({ BlockQueue: [] });
			if (items?.BlockQueue?.length !== undefined && items?.BlockQueue?.length > 0) {
				const transaction = db.transaction([queueDbStore], 'readwrite');
				transaction.onabort = transaction.onerror = reject;
				const store = transaction.objectStore(queueDbStore);

				items.BlockQueue.forEach((item: BlockUser) => {
					// required for users enqueued before 0.3.0
					if (item.user.hasOwnProperty('legacy')) {
						// @ts-ignore
						item.user.name = item.user.legacy.name;
						// @ts-ignore
						item.user.screen_name = item.user.legacy.screen_name;
						// @ts-ignore
						delete item.user.legacy;
					}

					const user: QueueUser = {
						user_id: item.user_id,
						user: {
							name: item.user.name,
							screen_name: item.user.screen_name,
						},
						reason: item.reason,
						queue: QueueId(),
					};
					// TODO: add error handling here
					store.add(user);
				});

				api.storage.local.set({ BlockQueue: null });
				transaction.commit();
				console.debug(
					logstr,
					'imported',
					items.BlockQueue.length,
					'users from local storage queue',
				);
			}

			console.log(logstr, 'successfully connected to db');
			return resolve(db);
		};
	});
}

export function AddUserToHistory(user: BlockedUser): Promise<void> {
	// @ts-ignore  // typescript is wrong here, this cannot return idb due to final throw
	return new Promise<void>((resolve, reject) => {
		const transaction = db.transaction([historyDbStore], 'readwrite');
		transaction.onabort = transaction.onerror = reject;
		transaction.oncomplete = () => resolve();

		const store = transaction.objectStore(historyDbStore);
		store.add(user);

		transaction.commit();
	}).catch((e) =>
		// attempt to reconnect to the db
		ConnectDb().finally(() => {
			throw e; // re-throw error to retry
		}),
	);
}

export function RemoveUserFromHistory(user_id: string): Promise<void> {
	// @ts-ignore  // typescript is wrong here, this cannot return idb due to final throw
	return new Promise<void>(async (resolve, reject) => {
		try {
			const transaction = db.transaction([historyDbStore], 'readwrite');
			transaction.onabort = transaction.onerror = reject;
			transaction.oncomplete = () => resolve();

			const store = transaction.objectStore(historyDbStore);
			const user = await new Promise<BlockedUser>((res, rej) => {
				const req = store.get(user_id);
				req.onerror = rej;
				req.onsuccess = () => {
					const user = req.result as BlockedUser;
					res(user);
				};
			}).catch((e) => {
				throw e;
			});

			user.state = HistoryStateUnblocked;
			user.time = new Date();
			store.put(user);

			transaction.commit();
		} catch (e) {
			reject(e);
		}
	}).catch((e) =>
		// attempt to reconnect to the db
		ConnectDb().finally(() => {
			throw e; // re-throw error to retry
		}),
	);
}

interface QueueUser {
	queue: number;
	user_id: string;
	user: { name: string; screen_name: string };
	reason: number;
	external_reason?: string;
}

export function AddUserToQueue(blockUser: BlockUser): Promise<void> {
	const user: QueueUser = {
		user_id: blockUser.user_id,
		user: {
			name: blockUser.user.name,
			screen_name: blockUser.user.screen_name,
		},
		reason: blockUser.reason,
		queue: QueueId(),
	};

	if (blockUser.external_reason) {
		user.external_reason = blockUser.external_reason;
	}

	// @ts-ignore  // typescript is wrong here, this cannot return idb due to final throw
	return new Promise<void>((resolve, reject) => {
		const transaction = db.transaction([queueDbStore], 'readwrite');
		transaction.onabort = transaction.onerror = reject;

		const store = transaction.objectStore(queueDbStore);
		store.add(user);
		transaction.oncomplete = () => resolve();
		transaction.commit();
	}).catch((e) => {
		if (e?.target?.error?.name !== 'ConstraintError') {
			// attempt to reconnect to the db
			return ConnectDb().finally(() => {
				throw e; // re-throw error to retry
			});
		}
	});
}

export function PopUserFromQueue(): Promise<BlockUser | null> {
	// @ts-ignore  // typescript is wrong here, this cannot return idb due to final throw
	return new Promise<BlockUser | null>(async (resolve, reject) => {
		const transaction = db.transaction([queueDbStore], 'readwrite');
		transaction.onabort = transaction.onerror = reject;
		const store = transaction.objectStore(queueDbStore);
		const index = store.index('queue');

		const result = await new Promise<QueueUser | undefined>((res, rej) => {
			const req = index.get(IDBKeyRange.bound(Number.MIN_VALUE, Number.MAX_VALUE));
			req.onerror = rej;
			req.onsuccess = () => {
				res(req.result as QueueUser);
			};
		});

		if (result === undefined) {
			return resolve(null);
		}

		const user: BlockUser = {
			user_id: result.user_id,
			user: {
				name: result.user.name,
				screen_name: result.user.screen_name,
			},
			reason: result.reason,
		};

		if (result.external_reason) {
			user.external_reason = result.external_reason;
		}

		store.delete(user.user_id);
		transaction.commit();
		transaction.oncomplete = () => resolve(user);
	}).catch((e) =>
		// attempt to reconnect to the db
		ConnectDb().finally(() => {
			throw e; // re-throw error to retry
		}),
	);
}

export function WholeQueue(): Promise<BlockUser[]> {
	return ConnectDb()
		.then((qdb) => {
			return new Promise<BlockUser[]>((resolve, reject) => {
				const transaction = qdb.transaction([queueDbStore], 'readonly');
				transaction.onabort = transaction.onerror = reject;
				const store = transaction.objectStore(queueDbStore);
				const index = store.index('queue');
				const req = index.getAll(
					IDBKeyRange.bound(Number.MIN_VALUE, Number.MAX_VALUE),
					10000,
				);

				req.onerror = reject;
				req.onsuccess = () => {
					const users = req.result as BlockUser[];
					resolve(users);
				};
			});
		})
		.catch(() => api.storage.local.get({ BlockQueue: [] }).then((items) => items?.BlockQueue));
}

export function QueueLength(): Promise<number> {
	return ConnectDb()
		.then((qdb) => {
			return new Promise<number>((resolve, reject) => {
				const transaction = qdb.transaction([queueDbStore], 'readonly');
				transaction.onabort = transaction.onerror = reject;
				const store = transaction.objectStore(queueDbStore);
				const req = store.count();

				req.onerror = reject;
				req.onsuccess = () => {
					const users = req.result as number;
					resolve(users);
				};
			});
		})
		.catch(() =>
			api.storage.local.get({ BlockQueue: [] }).then((items) => items?.BlockQueue?.length),
		);
}
