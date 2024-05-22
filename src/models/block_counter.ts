import { RefId } from '../utilities';

const criticalPointKey = 'BlockCounterCriticalPoint';
const interval = 1000;
export class BlockCounter {
	storage: typeof chrome.storage.local | typeof browser.storage.local;
	value: number;
	timeout: number | null;

	// this class provides functionality to update and maintain a counter on badge text in an accurate way via async functions
	constructor(storage: typeof chrome.storage.local | typeof browser.storage.local) {
		this.storage = storage;
		this.value = 0;
		this.timeout = null;
	}
	async getCriticalPoint(refId: number) {
		let cpRefId: number | null = null;
		let sleep: number = 50;
		do {
			const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			// cp === null: the critical point is up for grabs
			// cp.refId === this.refId: we have the critical point, so we should update the checkin time
			// cp.refId !== this.refId: we do not have the critical point
			// 	cp.refId !== this.refId && cp.time > now: another tab is running the consumer and is active
			// 	cp.refId !== this.refId && cp.time <= now: another tab is running the consumer and is inactive
			if (!cp || cp.refId === refId || cp.time <= new Date().valueOf()) {
				// try to access the critical point
				await this.storage.set({
					[criticalPointKey]: { refId, time: new Date().valueOf() + interval * 1.5 },
				});
				await new Promise(r => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey]
					?.refId;
			} else {
				// sleep for a little bit to let the other tab(s) release the critical point
				await new Promise(r => setTimeout(r, sleep));
				sleep = Math.min(sleep ** 2, interval);
			}
		} while (cpRefId !== refId);
	}
	async releaseCriticalPoint(refId: number) {
		const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
		if (cp?.refId === refId && cp.time > new Date().valueOf()) {
			// critical point belongs to us, so we can safely release it
			await this.storage.set({ [criticalPointKey]: null });
		}
	}
	async sync() {
		const refId = RefId();
		await this.getCriticalPoint(refId);
		const items = await this.storage.get({ BlockCounter: 0 });
		items.BlockCounter += this.value;
		this.value = 0;
		await this.storage.set(items);
		this.releaseCriticalPoint(refId);
	}
	async increment(value: number = 1) {
		this.value += value;
		if (this.timeout) {
			clearTimeout(this.timeout);
		}
		this.timeout = setTimeout(() => this.sync(), 100);
	}
}
