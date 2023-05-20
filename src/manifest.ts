import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  name: 'Blue Blocker',
  description: 'Blocks all Twitter Blue verified users on twitter.com',
  version: '0.3.0',
  manifest_version: 3,
  icons: {
    '128': 'icon/icon-128.png',
  },
  action: {
    default_popup: 'popup.html',
    default_icon: 'icon/icon.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['*://*.twitter.com/*', '*://twitter.com/*'],
      js: ['src/content/index.ts'],
    },
  ],
  permissions: ['storage'],
  web_accessible_resources: [
    {
      resources: [
        'src/constants.ts',
        'src/utilities.ts',
        'src/shared.ts',
        'src/injected/*',
        'src/parsers/*',
        'src/assets/*',
        'src/models/*',
        'src/popup/*',
      ],
      matches: ['*://*.twitter.com/*', '*://twitter.com/*'],
    },
  ],
});
