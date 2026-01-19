import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
	name: 'Blue Blocker',
	description: 'Blocks all Twitter Blue verified users on twitter.com',
	version: '0.4.18',
	manifest_version: 3,
	icons: {
		'128': 'icon/icon-128.png',
	},
	action: {
		default_popup: 'src/popup/index.html',
		default_icon: 'icon/icon-128.png',
	},
	background: {
		service_worker: 'src/background/index.ts',
		type: 'module',
	},
	content_scripts: [
		{
			matches: ['*://*.twitter.com/*', '*://twitter.com/*', '*://*.x.com/*', '*://x.com/*'],
			js: ['src/content/index.ts'],
		},
	],
	permissions: ['storage', 'unlimitedStorage'],
	web_accessible_resources: [
		{
			resources: [
				// only files that are accessed from web pages need to be listed here. ie: injected files and assets
				'src/injected/*',
				'icon/*',
				'pages/consent/*',
			],
			matches: ['*://*.twitter.com/*', '*://twitter.com/*', '*://*.x.com/*', '*://x.com/*'],
		},
	],
});
