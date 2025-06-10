import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { minifyHtml } from './vite-plugins';

import manifest from './src/manifest';

// https://vitejs.dev/config/
export default defineConfig(() => {
	return {
		build: {
			emptyOutDir: true,
			outDir: 'build',
			rollupOptions: {
				input: {
					// all non-popup pages need to be added here
					queue: './src/pages/queue/index.html',
					safelist: './src/pages/safelist/index.html',
					history: './src/pages/history/index.html',
					integrations: './src/pages/integrations/index.html',
					consent: './src/pages/consent/index.html',
				},
				output: {
					chunkFileNames: 'assets/chunk-[hash].js',
				},
			},
		},
		optimizeDeps: {
			include: ['./src/injected/inject.ts'],
		},
		plugins: [crx({ manifest }), minifyHtml()],
	};
});
