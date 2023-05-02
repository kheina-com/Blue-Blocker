export class BlockQueue {
	// queue must be defined with push and shift functions
	constructor(storage) {
		this.storage = storage;
		this.queue = [];
		this.timeout = null;
	}
	async sync() {
		// sync simply adds the in-memory queue to the stored queue
		const items = await this.storage.get({ BlockQueue: [] });
		items.BlockQueue.push(...this.queue);
		await this.storage.set(items);
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
		// shift halts any modifications to the local storage queue, removes an item, and saves it, and restarts sync
		if (this.timeout) {
			clearTimeout(this.timeout);
		}
		const items = await this.storage.get({ BlockQueue: [] });
		const item = items.BlockQueue.shift();
		if (item !== undefined) {
			await this.storage.set(items);
		}
		this.timeout = setTimeout(() => this.sync(), 100);
		return item;
	}
}
