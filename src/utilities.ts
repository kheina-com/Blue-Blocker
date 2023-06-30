import { api, logstr, EventKey, LegacyVerifiedUrl, MessageEvent, IsVerifiedAction, SuccessStatus, ErrorEvent } from "./constants";

export function abbreviate(value: number): string {
	if (value >= 1e10)
	{ return `${Math.round(value / 1e9)}B`; }
	if (value >= 9995e5)
	{ return `${(value / 1e9).toFixed(1)}B`; }
	if (value >= 1e7)
	{ return `${Math.round(value / 1e6)}M`; }
	if (value >= 9995e2)
	{ return `${(value / 1e6).toFixed(1)}M`; }
	if (value >= 1e4)
	{ return `${Math.round(value / 1e3)}K`; }
	if (value >= 1e3)
	{ return `${(value / 1e3).toFixed(1)}K`; }
	return `${value}`;
}

export function commafy(x: number): string {
	// from https://stackoverflow.com/a/2901298
	let parts = x.toString().split('.');
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
	return parts.join('.');
}

// 64bit random number generator. I believe it's not truly 64 bit
// due to floating point bullshit, but it's good enough
const MaxId: number = 0xffffffffffffffff;
export const RefId = (): number => Math.round(Math.random() * MaxId);

const expectedVerifiedUsersCount = 407520;
let db: IDBDatabase;

interface LegacyVerifiedUser {
	user_id: string,
	handle: string,
}

const dbName = "legacy-verified-users";
const dbStore = "verified_users";
const dbVersion = 1;

// populates local storage with legacy verified users for the purpose of avoiding legacy verified
export async function PopulateVerifiedDb() {
	const opts = await api.storage.sync.get({ skipVerified: true })
	if (!opts.skipVerified) {
		console.log(logstr, "skip verified false, not populating db", opts);
		return;
	}

	const DBOpenRequest = indexedDB.open(dbName, dbVersion);

	DBOpenRequest.onerror = DBOpenRequest.onblocked = () => {
		console.error(logstr, "failed to open legacy verified user database:", DBOpenRequest);
	};

	DBOpenRequest.onupgradeneeded = () => {
		console.debug(logstr, "DBOpenRequest.onupgradeneeded:", DBOpenRequest);
		db = DBOpenRequest.result;
		if (db.objectStoreNames.contains(dbStore)) {
			return;
		}

		db.createObjectStore(dbStore, { keyPath: "user_id" });
		console.log(logstr, "created database.");
	};

	DBOpenRequest.onsuccess = async () => {
		console.debug(logstr, "DBOpenRequest.onsuccess:", DBOpenRequest);
		db = DBOpenRequest.result;
		console.log(logstr, "checking verified user database.");

		try {
			await new Promise<void>((resolve, reject) => {
				const transaction = db.transaction([dbStore], "readwrite");
				const store = transaction.objectStore(dbStore);
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
				const transaction = db.transaction([dbStore], "readwrite");
				const store = transaction.objectStore(dbStore);

				store.clear();
				console.log(logstr, "cleared existing db store.");
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
			const transaction = db.transaction([dbStore], "readwrite");
			const store = transaction.objectStore(dbStore);

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
			console.log(logstr, "committed", count, "users to legacy verified db:", transaction);

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
	};

	console.log(logstr, "opening legacy verified user database:", DBOpenRequest);
}

export function CheckDbIsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	return new Promise<boolean>((resolve, reject) => {
		const transaction = db.transaction([dbStore], "readwrite");
		const store = transaction.objectStore(dbStore);
		const req = store.get(user_id);

		req.onerror = reject;
		req.onsuccess = () => {
			const user = req.result as LegacyVerifiedUser;
			resolve(user_id === user?.user_id && handle === user?.handle);
		};
	});
}

export async function IsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	const response = await chrome.runtime.sendMessage(
		{ action: IsVerifiedAction, user_id, handle },
	) as { status: string, result: boolean };

	if (response?.status !== SuccessStatus) {
		const message = "legacy verified db returned non-success status";
		console.error(logstr, message, response);
		throw new Error(message);
	}

	return response.result;
}

export function FormatLegacyName(user: { name: string, screen_name: string }) {
	const legacyName = user?.name;
	const screenName = user?.screen_name;
	return `${legacyName} (@${screenName})`;
}

export function MakeToast(content: string, config: Config, options: { html?: boolean, error?: boolean, elements?: Array<HTMLElement> } = { }) {
	const ele = document.getElementById("injected-blue-block-toasts");
	if (!ele) {
		throw new Error("blue blocker was unable to create or find toasts div.");
	}

	const t = document.createElement("div");
	let popupTimer: number;
	if (options?.error) {
		t.className = "toast error";
		popupTimer = 60e3;
	} else {
		t.className = "toast";
		popupTimer = config.popupTimer * 1000;
	}
	if (options?.html) {
		t.innerHTML = content;
	} else {
		t.innerText = content;
	}

	if (options?.elements) {
		options.elements.forEach(e => t.appendChild(e));
	}
	const close = document.createElement("a");
	close.innerText = "✕";
	close.className = "close";

	const timeout = setTimeout(() => ele.removeChild(t), popupTimer);
	close.onclick = () => {
		ele.removeChild(t);
		clearTimeout(timeout);
	};

	t.appendChild(close);
	ele.appendChild(t);
}
