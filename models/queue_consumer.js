import { RefId } from "../utilities.js";
import { logstr } from "../constants.js";

const criticalPointKey = "QueueConsumerCriticalPoint";
// this class provides to make sure there is only one consumer running per browser instance.
// this should hold true for multiple windows and multiple tabs all running the same code.
export class QueueConsumer {
	/*
		storage: the storage type used to sync tabs. likely chrome.storage.local
		func: the function used to consume from the queue
		interval_func: async function to retrieve cadence with which func should run. accepts storage as first arg
	*/
	constructor(storage, func, interval_func) {
		// idk
		this.storage = storage;
		this.func = func;
		this.interval = interval_func;
		this._timeout = null;
		this._interval = null;
		this._func_timeout = null;
		this._refId = RefId(); // assign a (hopefully) unique id to this instance. if we really wanted, we could use the tab id here
	}
	async getCriticalPoint() {
		let cpRefId = null;
		do {
			this._interval = await this.interval(this.storage);
			const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
			// cp === null: the critical point is up for grabs
			// cp.refId === this.refId: we have the critical point, so we should update the checkin time
			// cp.refId !== this.refId: we do not have the critical point
			//     cp.refId !== this.refId && cp.time > now: another tab is running the consumer and is active
			//     cp.refId !== this.refId && cp.time <= now: another tab is running the consumer and is inactive
			if (!cp || cp.refId === this._refId || cp.time <= (new Date()).valueOf()) {
				// try to access the critical point
				await this.storage.set({ [criticalPointKey]: { refId: this._refId, time: (new Date()).valueOf() + this._interval * 1.5 } });
				await new Promise(r => setTimeout(r, 10)); // wait a second to make sure any other sets have resolved
				cpRefId = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey].refId;
			}
			else {
				return false;
			}
		} while (cpRefId !== this._refId)
		return true;
	}
	async releaseCriticalPoint() {
		const cp = (await this.storage.get({ [criticalPointKey]: null }))[criticalPointKey];
		if (cp?.refId === this._refId && cp.time > (new Date()).valueOf()) {
			// critical point belongs to us, so we can safely release it
			await this.storage.set({ [criticalPointKey]: null });
		}
	}
	async sync() {
		this._timeout = setTimeout(() => this.sync(), this._interval);
		if (await this.getCriticalPoint()) {
			// we got and/or already had the critical point
			this._func_timeout = setTimeout(this.func, this._interval);
		}
		else if (this._func_timeout) {
			console.debug(logstr, "stopped consumer", this._refId, "because a different consumer is started running");
			clearTimeout(this._func_timeout);
			this._func_timeout = null;
		}
		else {
			console.debug(logstr, "did not consume with", this._refId, "because a different consumer is already running");
		}
	}
	start() {
		if (this._timeout) {
			console.debug(logstr, "did not start consumer", this._refId, "because it is already running");
			// we're already running
			return;
		}
		else {
			console.debug(logstr, "started consumer", this._refId);
		}
		this.sync();
	}
	stop() {
		let debug = false;
		if (this._timeout) {
			clearTimeout(this._timeout);
			this._timeout = null;
			debug = true;
		}
		if (this._func_timeout) {
			clearTimeout(this._func_timeout);
			this._func_timeout = null;
			debug = true;
		}

		if (debug) {
			console.debug(logstr, "halted consumer", this._refId);
		}
		this.releaseCriticalPoint();
	}
}
