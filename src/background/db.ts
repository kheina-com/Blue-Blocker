import { api, logstr, EventKey, LegacyVerifiedUrl, MessageEvent, ErrorEvent } from "../constants";
import { commafy } from "../utilities";

const expectedVerifiedUsersCount = 407520;
let legacyDb: IDBDatabase;
// used so we don't load the db twice
let legacyDbLoaded: boolean = false;

interface LegacyVerifiedUser {
	user_id: string,
	handle: string,
}

const legacyDbName = "legacy-verified-users";
const legacyDbStore = "verified_users";
const legacyDbVersion = 1;

// populates local storage with legacy verified users for the purpose of avoiding legacy verified
export async function PopulateVerifiedDb() {
	const opts = await api.storage.sync.get({ skipVerified: true });
	if (!opts.skipVerified) {
		console.log(logstr, "skip verified false, not populating legacyDb", opts);
		return;
	}

	const DBOpenRequest = indexedDB.open(legacyDbName, legacyDbVersion);

	DBOpenRequest.onerror = DBOpenRequest.onblocked = () => {
		console.error(logstr, "failed to open legacy verified user database:", DBOpenRequest);
	};

	DBOpenRequest.onupgradeneeded = () => {
		console.debug(logstr, "DBOpenRequest.onupgradeneeded:", DBOpenRequest);
		legacyDb = DBOpenRequest.result;
		if (legacyDb.objectStoreNames.contains(legacyDbStore)) {
			return;
		}

		legacyDb.createObjectStore(legacyDbStore, { keyPath: "user_id" });
		console.log(logstr, "created database.");
	};

	DBOpenRequest.onsuccess = async () => {
		console.debug(logstr, "DBOpenRequest.onsuccess:", DBOpenRequest);
		legacyDb = DBOpenRequest.result;

		if (legacyDbLoaded) {
			// this function only runs if skipVerified is true. this is here so that if there
			// was a failure elsewhere that we're recovering from, we re-enable the option
			api.storage.sync.set({ skipVerified: true });
			return;
		}
		console.log(logstr, "checking verified user database.");

		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = legacyDb.transaction([legacyDbStore], "readwrite");
				const store = transaction.objectStore(legacyDbStore);
				const req = store.count();

				req.onerror = reject;
				req.onsuccess = () => {
					const count = req.result as number;
					if (count !== expectedVerifiedUsersCount) {
						reject(`legacy verified users database (${commafy(count)}) did not contain the expected number of users (${commafy(expectedVerifiedUsersCount)})`);
					} else {
						console.log(logstr, "loaded", count, "legacy verified users");
						resolve();
					}
				};
			});
		}
		catch (_e) {
			const e = _e as Error;
			(() => {
				const transaction = legacyDb.transaction([legacyDbStore], "readwrite");
				const store = transaction.objectStore(legacyDbStore);

				store.clear();
				console.log(logstr, "cleared existing legacyDb store.");
			})();

			(() => {
				const message = "downloading legacy verified users database, this may take a few minutes.";
				api.storage.local.set({
					[EventKey]: {
						type: MessageEvent,
						message,
					},
				});
				console.log(logstr, message);
			})();

			let count: number = 0;
			const body = await fetch(LegacyVerifiedUrl)
				.then(r => r.text());

			let intact: boolean = false;
			const transaction = legacyDb.transaction([legacyDbStore], "readwrite");
			const store = transaction.objectStore(legacyDbStore);

			for (const line of body.split("\n")) {
				if (line === "Twitter ID, Screen name, Followers") {
					console.log(logstr, "response csv good!");
					intact = true;
					continue;
				}
				else if (!intact) {
					const message = "legacy verified users database was mangled or otherwise unable to be parsed";
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
					const [user_id, handle, _] = line.split(",");
					const item: LegacyVerifiedUser = { user_id, handle };
					const req = store.add(item);

					req.onerror = reject;
					req.onsuccess = () => {
						count++;
						if (count % 1000 === 0) {
							console.debug(logstr, "stored 1,000 legacy verified users");
						}
						resolve();
					};
				});
			}

			transaction.commit();
			console.log(logstr, "committed", count, "users to legacy verified legacyDb:", transaction);

			const message = `loaded ${commafy(count)} legacy verified users!`;
			console.log(logstr, message);
			api.storage.local.set({
				[EventKey]: {
					type: MessageEvent,
					message,
				},
			});

			if (count !== expectedVerifiedUsersCount) {
				throw new Error(`legacy verified users database (${commafy(count)}) did not contain the expected number of users (${commafy(expectedVerifiedUsersCount)})`);
			}
		}
		legacyDbLoaded = true;
	};

	console.log(logstr, "opening legacy verified user database:", DBOpenRequest);
}

export function CheckDbIsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	return new Promise<boolean>((resolve, reject) => {
		const transaction = legacyDb.transaction([legacyDbStore], "readwrite");
		const store = transaction.objectStore(legacyDbStore);
		const req = store.get(user_id);

		req.onerror = reject;
		req.onsuccess = () => {
			const user = req.result as LegacyVerifiedUser;
			resolve(user_id === user?.user_id && handle === user?.handle);
		};
	}).catch(e => {
		// if the db has already been loaded, we can safely reconnect
		if (legacyDbLoaded) {
			PopulateVerifiedDb();
		}
		throw e;  // re-throw error
	});
}
