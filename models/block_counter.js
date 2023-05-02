import { RefId } from "../utilities.js";

const criticalPointKey = "blockCounterCriticalPoint";
export class BlockCounter {
	// this class provides functionality to update and maintain a counter on badge text in an accurate way via async functions
	constructor(storage) {
		this.storage = storage;
		this.value = 0;
		this.timeout = null;

		// we need to make sure the critical point is empty on launch. this has a very low chance of causing conflict between tabs, but
		// prevents the possibility of a bunch of bugs caused by issues in retrieving the critical point. ideally we wouldn't have this
		this.releaseCriticalPoint();
	}
	async getCriticalPoint() {
		const refId = RefId();
		let value = null;
		do {
			value = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			if (!value) {
				// try to access the critical point
				await this.storage.set({ [criticalPointKey]: refId });
				await new Promise(r => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				value = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			}
			else {
				// sleep for a little bit to let the other tab(s) release the critical point
				await new Promise(r => setTimeout(r, 50));
			}
		} while (value !== refId)
	}
	async releaseCriticalPoint() {
		// this should only be called AFTER getCriticalPoint
		await this.storage.set({ [criticalPointKey]: null });
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
