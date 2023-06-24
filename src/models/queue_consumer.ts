import { RefId } from '../utilities';

const criticalPointKey = 'QueueConsumerCriticalPoint';
// this class provides to make sure there is only one consumer running per browser instance.
// this should hold true for multiple windows and multiple tabs all running the same code.
export class QueueConsumer {
	storage: typeof chrome.storage.local | typeof browser.storage.local;
	func: any;
	interval: any;
	private _timeout: number | null;
	private _interval: number | null;
	private _func_timeout: number | null;
	/*
		storage: the storage type used to sync tabs. likely chrome.storage.local
		func: the function used to consume from the queue
		interval_func: async function to retrieve cadence with which func should run. accepts storage as first arg
	*/
	constructor(
		storage: typeof chrome.storage.local | typeof browser.storage.local,
		func: Function,
		interval_func: Function,
	) {
		// idk
		this.storage = storage;
		this.func = func;
		this.interval = interval_func;
		this._timeout = null;
		this._interval = null;
		this._func_timeout = null;
	}
	async getCriticalPoint(refId: number) {
		let cpRefId = null;
		do {
			this._interval = await this.interval(this.storage);
			const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			// cp === null: the critical point is up for grabs
			// cp.refId === this.refId: we have the critical point, so we should update the checkin time
			// cp.refId !== this.refId: we do not have the critical point
			// 	cp.refId !== this.refId && cp.time > now: another tab is running the consumer and is active
			// 	cp.refId !== this.refId && cp.time <= now: another tab is running the consumer and is inactive
			if (!cp || cp.refId === refId || cp.time <= new Date().valueOf()) {
				// try to access the critical point
				await this.storage.set({
					[criticalPointKey]: {
						refId,
						time: new Date().valueOf() + (this._interval || 0) * 1.5,
					},
				});
				await new Promise((r) => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey].refId;
			} else {
				return false;
			}
		} while (cpRefId !== refId);
		return true;
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
		if (this._interval) {
			this._timeout = setTimeout(() => this.sync(), this._interval);
		}
		if (await this.getCriticalPoint(refId)) {
			// we got and/or already had the critical point
			if (this._interval) {
				this._func_timeout = setTimeout(this.func, this._interval);
			}
		} else if (this._func_timeout) {
			clearTimeout(this._func_timeout);
			this._func_timeout = null;
		}
	}
	start() {
		if (this._timeout) {
			// we're already running
			return;
		}
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
	}
}
