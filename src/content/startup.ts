import { api, DefaultOptions } from '../constants';

// https://github.com/crxjs/chrome-extension-tools/issues/576#issuecomment-1312838225
// TODO: see if we can remove this ignore
// @ts-ignore
import inject from '/src/injected/inject?script&module';

const script = document.createElement('script');
script.src = api.runtime.getURL(inject);
script.id = 'injected-blue-block-xhr';
script.type = 'text/javascript';
document.head.prepend(script);

let l = document.createElement('link');
l.href = api.runtime.getURL('src/injected/style.css'); // MUST BE ABSOLUTE PATH
l.rel = 'stylesheet';
(document.head || document.documentElement).appendChild(l);

const toasts = document.createElement('div');
toasts.id = 'injected-blue-block-toasts';
document.body.appendChild(toasts);

api.storage.sync.get(DefaultOptions).then(_config => {
	const config = _config as Config;
	// @ts-ignore
	toasts.classList = '';
	toasts.classList.add(config.toastsLocation);
});

api.storage.sync.onChanged.addListener(items => {
	if (items.hasOwnProperty('toastsLocation')) {
		// @ts-ignore
		toasts.classList = '';
		toasts.classList.add(items.toastsLocation.newValue);
	}
});
