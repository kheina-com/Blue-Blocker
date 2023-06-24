import { RefId } from '../utilities';


const criticalPointKey = 'BlockQueueCriticalPoint';
const interval = 1000;
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
	async getCriticalPoint(refId: number) {
		let cpRefId = null;
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
					[criticalPointKey]: { refId: refId, time: new Date().valueOf() + interval * 1.5 },
				});
				await new Promise((r) => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey].refId;
			} else {
				// sleep for a little bit to let the other tab(s) release the critical point
				await new Promise((r) => setTimeout(r, 50));
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
		// sync simply adds the in-memory queue to the stored queue
		const oldQueue = (await this.storage.get({ BlockQueue: [] })).BlockQueue;
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
		await this.getCriticalPoint(refId);
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
		await this.getCriticalPoint(refId);
		const items = await this.storage.get({ BlockQueue: [] });
		if (!items.BlockQueue || items.BlockQueue.length === 0) {
			return;
		}
		await this.storage.set({ BlockQueue: [] });
		this.releaseCriticalPoint(refId);
	}
}
