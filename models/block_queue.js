import { RefId } from "../utilities.js";

const criticalPointKey = "BlockQueueCriticalPoint";
const interval = 1000;
export class BlockQueue {
	// queue must be defined with push and shift functions
	constructor(storage) {
		this.storage = storage;
		this.queue = [];
		this.timeout = null;
		this._refId = RefId(); // assign a (hopefully) unique id to this instance. if we really wanted, we could use the tab id here
	}
	async getCriticalPoint() {
		let cpRefId = null;
		do {
			const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			// cp === null: the critical point is up for grabs
			// cp.refId === this.refId: we have the critical point, so we should update the checkin time
			// cp.refId !== this.refId: we do not have the critical point
			//     cp.refId !== this.refId && cp.time > now: another tab is running the consumer and is active
			//     cp.refId !== this.refId && cp.time <= now: another tab is running the consumer and is inactive
			if (!cp || cp.refId === this._refId || cp.time <= (new Date()).valueOf()) {
				// try to access the critical point
				await this.storage.set({ [criticalPointKey]: { refId: this._refId, time: (new Date()).valueOf() + interval * 1.5 } });
				await new Promise(r => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey].refId;
			}
			else {
				// sleep for a little bit to let the other tab(s) release the critical point
				await new Promise(r => setTimeout(r, 50));
			}
		} while (cpRefId !== this._refId)
	}
	async releaseCriticalPoint() {
		const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
		if (cp?.refId === this._refId && cp.time > (new Date()).valueOf()) {
			// critical point belongs to us, so we can safely release it
			await this.storage.set({ [criticalPointKey]: null });
		}
	}
	async sync() {
		await this.getCriticalPoint();
		// sync simply adds the in-memory queue to the stored queue
		const oldQueue = (await this.storage.get({ BlockQueue: [] })).BlockQueue;
		// TODO: do this via user_id only, user objects won't always be equal
		const newQueue = { };
		for (const user of [...oldQueue, ...this.queue]) {
			newQueue[user.user_id] = user;
		}
		await this.storage.set({ BlockQueue: Array.from(Object.values(newQueue)) });
		this.releaseCriticalPoint();
		this.queue.length = 0;
		this.timeout = null;
	}
	async push(item) {
		this.queue.push(item);
		if (this.timeout) {
			clearTimeout(this.timeout);
		}
		this.timeout = setTimeout(() => this.sync(), 100);
	}
	async shift() {
		await this.getCriticalPoint();
		const items = await this.storage.get({ BlockQueue: [] });
		const item = items.BlockQueue.shift();
		if (item !== undefined) {
			await this.storage.set(items);
		}
		this.releaseCriticalPoint();
		return item;
	}
	async clear() {
		await this.getCriticalPoint();
		const items = await this.storage.get({ BlockQueue: [] });
		if (!items.BlockQueue || items.BlockQueue.length === 0) {
			return;
		}
		await this.storage.set({ BlockQueue: [] });
		this.releaseCriticalPoint();
	}
}
