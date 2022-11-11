(async () => {
	const src = chrome.runtime.getURL('./script.js');
	const _ = await import(src);
})();
