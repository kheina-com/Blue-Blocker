(async () => {
	const src = browser.runtime.getURL('./firefox/script.js');
	const _ = await import(src);
})();
