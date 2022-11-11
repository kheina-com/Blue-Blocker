(async () => {
	const src = chrome.runtime.getURL('./chrome/script.js');
	const _ = await import(src);
})();
