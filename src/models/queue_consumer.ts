import { logstr } from '../constants';
import { RefId } from '../utilities';

const criticalPointKey = 'QueueConsumerCriticalPoint';
// this class provides to make sure there is only one consumer running per browser instance.
// this should hold true for multiple windows and multiple tabs all running the same code.
export class QueueConsumer {
	storage: typeof chrome.storage.local | typeof browser.storage.local;
	func: () => Promise<void>;
	interval: (storage: typeof chrome.storage.local | typeof browser.storage.local) => Promise<number>;
	private _timeout: number | null;
	private _interval: number;
	private _func_timeout: number | null;
	private _refId: number;
	/**
		storage: the storage type used to sync tabs. likely chrome.storage.local
		func: async function used to consume from the queue. reject stops consumer, resolve queues next run
		interval_func: async function to retrieve cadence with which func should run. accepts storage as first arg
	*/
	constructor(
		storage: typeof chrome.storage.local | typeof browser.storage.local,
		func: () => Promise<any>,
		interval_func: (storage: typeof chrome.storage.local | typeof browser.storage.local) => Promise<number>,
	) {
		// idk
		this.storage = storage;
		this.func = func;
		this.interval = interval_func;
		this._timeout = null;
		this._interval = 100;
		this._func_timeout = null;
		this._refId = RefId();  // consumer is assigned to a tab, so keep it in the class
	}
	async getCriticalPoint(): Promise<boolean> {
		// console.debug(logstr, this._refId, "attempting to obtain critical point");
		let cpRefId = null;
		do {
			this._interval = await this.interval(this.storage);
			const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			// cp === null: the critical point is up for grabs
			// cp.refId === this.refId: we have the critical point, so we should update the checkin time
			// cp.refId !== this.refId: we do not have the critical point
			// 	cp.refId !== this.refId && cp.time > now: another tab is running the consumer and is active
			// 	cp.refId !== this.refId && cp.time <= now: another tab is running the consumer and is inactive
			if (!cp || cp.refId === this._refId || cp.time <= new Date().valueOf()) {
				// try to access the critical point
				await this.storage.set({
					[criticalPointKey]: {
						refId: this._refId,
						time: new Date().valueOf() + (this._interval || 0) * 1.5,
					},
				});
				await new Promise((r) => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey].refId;
			} else {
				// console.debug(logstr, this._refId, "failed to obtain critical point");
				return false;
			}
		} while (cpRefId !== this._refId);
		// console.debug(logstr, this._refId, "obtained critical point");
		return true;
	}
	async releaseCriticalPoint() {
		const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
		if (cp?.refId === this._refId && cp.time > new Date().valueOf()) {
			// critical point belongs to us, so we can safely release it
			// console.debug(logstr, this._refId, "released critical point");
			await this.storage.set({ [criticalPointKey]: null });
		}
	}
	entropy(): number {
		const variance = this._interval * 0.1;  // 0.1 = 10% entropy
		return Math.random() * variance * 2 - variance;
	}
	async sync() {
		// console.debug(logstr, this._refId, "syncing. _interval:", this._interval, "_timeout:", this._timeout, "_func_timeout:", this._func_timeout);
		if (await this.getCriticalPoint()) {
			// we got and/or already had the critical point
			// if we just got it, func will be null and we can schedule it
			// if we already had it, it already finished or its waiting on queue
			if (this._func_timeout === null) {
				this._func_timeout = setTimeout(() => this.func().then(() => { this._func_timeout = null; this.sync(); }).catch(() => this.stop()), this._interval + this.entropy());
			}
			this._timeout = null;  // set timeout to null, just for the running check in start
		} else {
			// we couldn't get the critical point, so cancel func if its scheduled, then set timeout to check again
			if (this._func_timeout) {
				clearTimeout(this._func_timeout);
				this._func_timeout = null;
			}
			this._timeout = setTimeout(() => this.sync(), this._interval);
		}
		// console.debug(logstr, this._refId, "finished syncing. _interval:", this._interval, "_timeout:", this._timeout, "_func_timeout:", this._func_timeout);
	}
	start() {
		if (this._timeout || this._func_timeout) {
			// we're already running
			return;
		}
		console.debug(logstr, "queue consumer started");
		this.sync();
	}
	stop() {
		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = null;
		}
		if (this._func_timeout) {
			clearTimeout(this._func_timeout);
			this._func_timeout = null;
		}
		this.releaseCriticalPoint();
		console.debug(logstr, "queue consumer stopped");
	}
}
