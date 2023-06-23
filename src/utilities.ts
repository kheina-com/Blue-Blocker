import { api, logstr, EventKey, LegacyVerifiedUrl, MessageEvent } from "./constants";

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

// populates local storage with legacy verified users for the purpose of avoiding legacy verified
export async function PopulateVerifiedDb() {
	const loaded = await api.storage.local.get({ __legacy_db_loaded__: false });
	if (loaded.__legacy_db_loaded__) {
		console.log(logstr, "legacy db already loaded.", loaded);
		return;
	}

	api.storage.local.set({
		[EventKey]: {
			type: MessageEvent,
			message: "downloading legacy verified users database.",
		},
	});
	console.log(logstr, "downloading legacy verified users database.");
	const items: { [k: string]: { user_id: string, handle: string } | boolean } = { __legacy_db_loaded__: true };
	let count: number = 0;
	const expected = 407521;

	fetch(LegacyVerifiedUrl)
		.then(r => r.text())
		.then(body => {
			let intact: boolean = false;

			body.split("\n").forEach(line => {
				if (line === "Twitter ID, Screen name, Followers") {
					intact = true;
					return;
				}
				else if (!intact) {
					// error
				}

				const [user_id, handle, _] = line.split(",");
				const item = { user_id, handle };
				const key = `user_id:${user_id}`;

				items[key] = item;
				count++;
			});
		})
		.then(() => api.storage.local.set(items))
		.then(() => {
			const message = `loaded ${commafy(count)} legacy verified users`;
			console.log(logstr, message);
			api.storage.local.set({
				[EventKey]: {
					type: MessageEvent,
					message,
				},
			});
		});
}

export async function IsUserLegacyVerified(user_id: string, handle: string): Promise<boolean> {
	const key = `user_id:${user_id}`;
	const items = await api.storage.local.get({ __legacy_db_loaded__: false, [key]: null });

	if (!items.__legacy_db_loaded__) {
		return false;
		// TODO: THROW ERROR
	}

	const user = items[key];
	return (user_id === user?.user_id && handle === user?.handle)
}

export function FormatLegacyName(user: BlueBlockerUser) {
	const legacyName = user.legacy?.name;
	const screenName = user.legacy?.screen_name;
	return `${legacyName} (@${screenName})`;
}