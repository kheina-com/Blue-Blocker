// This is the main binding run by the extension. The purpose of this file
// is exclusively to run script.js as a module so we can do normal
// programmery things within js like imports and such. this is not possible
// unless the file is treated as a module.

(async () => {
	// this is required so we can do imports and normal module things
	const src = (chrome || browser).runtime.getURL('./script.js');
	const _ = await import(src);
})();
