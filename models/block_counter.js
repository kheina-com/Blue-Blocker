import { RefId } from "../utilities.js";

const criticalPointKey = "BlockCounterCriticalPoint";
const interval = 1000;
export class BlockCounter {
	// this class provides functionality to update and maintain a counter on badge text in an accurate way via async functions
	constructor(storage) {
		this.storage = storage;
		this.value = 0;
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
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey]?.refId;
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
		const items = await this.storage.get({ BlockCounter: 0 });
		items.BlockCounter += this.value;
		this.value = 0;
		await this.storage.set(items);
		this.releaseCriticalPoint();
	}
	async increment(value = 1) {
		this.value += value;
		if (this.timeout) {
			clearTimeout(this.timeout);
		}
		this.timeout = setTimeout(() => this.sync(), 100);
	}
}
