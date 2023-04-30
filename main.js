(async () => {
	const src = (chrome || browser).runtime.getURL('./script.js');
	const _ = await import(src);
})();
