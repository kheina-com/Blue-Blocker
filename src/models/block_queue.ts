import { RefId } from '../utilities';

const criticalPointKey = 'BlockQueueCriticalPoint';
export class BlockQueue {
	storage: typeof chrome.storage.local | typeof browser.storage.local;
	queue: BlockUser[];
	timeout: number | null;

	// queue must be defined with push and shift functions
	constructor(storage: typeof chrome.storage.local | typeof browser.storage.local) {
		this.storage = storage;
		this.queue = [];
		this.timeout = null;
	}
	async getCriticalPoint(refId: number, interval: number = 1000): Promise<boolean> {
		// console.debug(logstr, refId, "attempting to obtain critical point");
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
				await new Promise((r) => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey]?.refId;
			} else {
				// rather than continually try to obtain the critical point, exit
				// if the consumer only queues the next run after successfully finishing the last, this can go back to only sleeping
				// console.debug(logstr, refId, "failed to obtain critical point, sleeping");
				await new Promise((r) => setTimeout(r, sleep));
				sleep = Math.min(sleep ** 2, interval);
			}
		} while (cpRefId !== refId);
		// console.debug(logstr, refId, "obtained critical point");
		return true;
	}
	async releaseCriticalPoint(refId: number) {
		const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
		if (cp?.refId === refId && cp.time > new Date().valueOf()) {
			// critical point belongs to us, so we can safely release it
			// console.debug(logstr, refId, "released critical point");
			await this.storage.set({ [criticalPointKey]: null });
		}
	}
	async sync() {
		const refId = RefId();
		if (!await this.getCriticalPoint(refId)) {
			// we failed to obtain the critical point, so we can't continue
			throw new Error("failed to obtain critical point");
		}
		// sync simply adds the in-memory queue to the stored queue
		const oldQueue = (await this.storage.get({ BlockQueue: [] })).BlockQueue;
		// TODO: do this via user_id only, user objects won't always be equal
		const newQueue: { [user_id: string]: BlockUser } = {};
		for (const user of [...oldQueue, ...this.queue]) {
			newQueue[user.user_id] = user;
		}
		await this.storage.set({ BlockQueue: Array.from(Object.values(newQueue)) });
		this.releaseCriticalPoint(refId);
		this.queue.length = 0;
		this.timeout = null;
	}
	async push(item: BlockUser) {
		this.queue.push(item);
		if (this.timeout) {
			clearTimeout(this.timeout);
		}
		this.timeout = setTimeout(() => this.sync(), 100);
	}
	async shift() {
		const refId = RefId();
		if (!await this.getCriticalPoint(refId)) {
			// we failed to obtain the critical point, so we can't continue
			throw new Error("failed to obtain critical point");
		}
		const items = await this.storage.get({ BlockQueue: [] });
		const item = items.BlockQueue.shift();
		if (item !== undefined) {
			await this.storage.set(items);
		}
		this.releaseCriticalPoint(refId);
		return item;
	}
	async clear() {
		const refId = RefId();
		if (!await this.getCriticalPoint(refId)) {
			// we failed to obtain the critical point, so we can't continue
			throw new Error("failed to obtain critical point");
		}
		const items = await this.storage.get({ BlockQueue: [] });
		if (!items.BlockQueue || items.BlockQueue.length === 0) {
			return;
		}
		await this.storage.set({ BlockQueue: [] });
		this.releaseCriticalPoint(refId);
	}
}
