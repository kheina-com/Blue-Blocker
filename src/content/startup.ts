import { api, DefaultOptions } from "../constants";

// https://github.com/crxjs/chrome-extension-tools/issues/576#issuecomment-1312838225
// TODO: see if we can remove this ignore
// @ts-ignore
import inject from "/src/injected/inject?script&module";
const script = document.createElement("script");
script.src = api.runtime.getURL(inject);
script.id = "injected-blue-block-xhr";
script.type = "text/javascript";
document.head.prepend(script);

(async () => {
	let success: boolean = false;

	function listener(e: CustomEvent<BlueBlockerBound>) {
		success = e.detail.success;
	}
	document.addEventListener("blue-blocker-bound", listener);

	do {
		const script = document.createElement("script");
		script.src = chrome.runtime.getURL(inject);
		script.type = "text/javascript";
		document.head.prepend(script);
	} while (!await new Promise<boolean>(r => setTimeout(() => r(success), 1000)))

	document.removeEventListener("blue-blocker-bound", listener);
})();

(async () => {
	const cssUrl = api.runtime.getURL("src/injected/style.css"); // MUST BE ABSOLUTE PATH

	do {
		const l = document.createElement("link");
		l.href = cssUrl
		l.rel = "stylesheet";
		document.head.appendChild(l);
		await new Promise((r) => setTimeout(r, 1000));
	} while (!document.querySelector(`link[href='${cssUrl}']`))
})();

(async () => {
	const toastsId = "injected-blue-block-toasts";
	let toasts: HTMLElement;

	do {
		toasts = document.createElement("div");
		toasts.id = toastsId;
		document.body.appendChild(toasts);
		await new Promise((r) => setTimeout(r, 1000));
	} while (!document.getElementById(toastsId))

	api.storage.sync.get(DefaultOptions).then(_config => {
		const config = _config as Config;
		// @ts-ignore
		toasts.classList = "";
		toasts.classList.add(config.toastsLocation);
	});

	api.storage.sync.onChanged.addListener(items => {
		if (items.hasOwnProperty("toastsLocation")) {
			// @ts-ignore
			toasts.classList = "";
			toasts.classList.add(items.toastsLocation.newValue);
		}
	});
})();
