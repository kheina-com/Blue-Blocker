import { ClearCache, DefaultOptions, SetBlockQueue, SetOptions, HandleInstructionsResponse, HandleHomeTimeline } from '../shared.js';

class BlockQueue {
	// queue must be defined with push and shift functions
	constructor() {
		this.queue = [];
		this.timeout = null;
	}
	async sync() {
		// sync simply adds the in-memory queue to the stored queue
		const items = await browser.storage.local.get({ BlockQueue: [] });
		items.BlockQueue.push(...this.queue);
		await browser.storage.local.set(items);
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
		const items = await browser.storage.local.get({ BlockQueue: [] });
		const item = items.BlockQueue.shift();
		if (item !== undefined) {
			await browser.storage.local.set(items);
		}
		this.timeout = setTimeout(() => this.sync(), 100);
		return item;
	}
}
SetBlockQueue(new BlockQueue());


document.addEventListener("blue-blocker-event", function (e) {
	ClearCache();

	// retrieve option
	browser.storage.sync.get(DefaultOptions).then(items => {
		SetOptions(items);
		const body = JSON.parse(e.detail.body);

		switch (e.detail.parsedUrl[1]) {
			case "HomeLatestTimeline":
			case "HomeTimeline":
			case "UserTweets":
			case "TweetDetail":
				return HandleInstructionsResponse(e, body);
			case "timeline/home.json":
				return HandleHomeTimeline(e, body);
			default:
				console.error("found an unexpected url that we don't know how to handle:", e.detail.url);
		}
	});
});
