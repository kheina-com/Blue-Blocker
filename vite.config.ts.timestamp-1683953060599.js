// vite.config.ts
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";

// src/manifest.ts
import { defineManifest } from "@crxjs/vite-plugin";
var manifest_default = defineManifest({
  name: "Blue Blocker",
  description: "Blocks all Twitter Blue verified users on twitter.com",
  version: "1.0.0",
  manifest_version: 3,
  icons: {
    "128": "img/icon-128.png"
  },
  action: {
    default_popup: "popup.html",
    default_icon: "img/icon.png"
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  content_scripts: [
    {
      matches: ["*://*.twitter.com/*", "*://twitter.com/*"],
      js: ["src/content/index.ts"]
    }
  ],
  permissions: ["storage"],
  web_accessible_resources: [
    {
      resources: [
        "src/constants.ts",
        "src/utilities.ts",
        "src/shared.ts",
        "src/injected/*",
        "src/parsers/*",
        "src/assets/*",
        "src/models/*"
      ],
      matches: ["*://*.twitter.com/*", "*://twitter.com/*"]
    }
  ]
});

// vite.config.ts
var vite_config_default = defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: "build",
      rollupOptions: {
        output: {
          chunkFileNames: "assets/chunk-[hash].js"
        }
      }
    },
    plugins: [crx({ manifest: manifest_default })]
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic3JjL21hbmlmZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB7IGNyeCB9IGZyb20gJ0Bjcnhqcy92aXRlLXBsdWdpbic7XG5cbmltcG9ydCBtYW5pZmVzdCBmcm9tICcuL3NyYy9tYW5pZmVzdCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIHJldHVybiB7XG4gICAgYnVpbGQ6IHtcbiAgICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxuICAgICAgb3V0RGlyOiAnYnVpbGQnLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9jaHVuay1baGFzaF0uanMnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgcGx1Z2luczogW2NyeCh7IG1hbmlmZXN0IH0pXSxcbiAgfTtcbn0pO1xuIiwgImltcG9ydCB7IGRlZmluZU1hbmlmZXN0IH0gZnJvbSAnQGNyeGpzL3ZpdGUtcGx1Z2luJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lTWFuaWZlc3Qoe1xuICBuYW1lOiAnQmx1ZSBCbG9ja2VyJyxcbiAgZGVzY3JpcHRpb246ICdCbG9ja3MgYWxsIFR3aXR0ZXIgQmx1ZSB2ZXJpZmllZCB1c2VycyBvbiB0d2l0dGVyLmNvbScsXG4gIHZlcnNpb246ICcxLjAuMCcsXG4gIG1hbmlmZXN0X3ZlcnNpb246IDMsXG4gIGljb25zOiB7XG4gICAgJzEyOCc6ICdpbWcvaWNvbi0xMjgucG5nJyxcbiAgfSxcbiAgYWN0aW9uOiB7XG4gICAgZGVmYXVsdF9wb3B1cDogJ3BvcHVwLmh0bWwnLFxuICAgIGRlZmF1bHRfaWNvbjogJ2ltZy9pY29uLnBuZycsXG4gIH0sXG4gIGJhY2tncm91bmQ6IHtcbiAgICBzZXJ2aWNlX3dvcmtlcjogJ3NyYy9iYWNrZ3JvdW5kL2luZGV4LnRzJyxcbiAgICB0eXBlOiAnbW9kdWxlJyxcbiAgfSxcbiAgY29udGVudF9zY3JpcHRzOiBbXG4gICAge1xuICAgICAgbWF0Y2hlczogWycqOi8vKi50d2l0dGVyLmNvbS8qJywgJyo6Ly90d2l0dGVyLmNvbS8qJ10sXG4gICAgICBqczogWydzcmMvY29udGVudC9pbmRleC50cyddLFxuICAgIH0sXG4gIF0sXG4gIHBlcm1pc3Npb25zOiBbJ3N0b3JhZ2UnXSxcbiAgd2ViX2FjY2Vzc2libGVfcmVzb3VyY2VzOiBbXG4gICAge1xuICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICdzcmMvY29uc3RhbnRzLnRzJyxcbiAgICAgICAgJ3NyYy91dGlsaXRpZXMudHMnLFxuICAgICAgICAnc3JjL3NoYXJlZC50cycsXG4gICAgICAgICdzcmMvaW5qZWN0ZWQvKicsXG4gICAgICAgICdzcmMvcGFyc2Vycy8qJyxcbiAgICAgICAgJ3NyYy9hc3NldHMvKicsXG4gICAgICAgICdzcmMvbW9kZWxzLyonLFxuICAgICAgXSxcbiAgICAgIG1hdGNoZXM6IFsnKjovLyoudHdpdHRlci5jb20vKicsICcqOi8vdHdpdHRlci5jb20vKiddLFxuICAgIH0sXG4gIF0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFdBQVc7OztBQ0RwQixTQUFTLHNCQUFzQjtBQUUvQixJQUFPLG1CQUFRLGVBQWU7QUFBQSxFQUM1QixNQUFNO0FBQUEsRUFDTixhQUFhO0FBQUEsRUFDYixTQUFTO0FBQUEsRUFDVCxrQkFBa0I7QUFBQSxFQUNsQixPQUFPO0FBQUEsSUFDTCxPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sZUFBZTtBQUFBLElBQ2YsY0FBYztBQUFBLEVBQ2hCO0FBQUEsRUFDQSxZQUFZO0FBQUEsSUFDVixnQkFBZ0I7QUFBQSxJQUNoQixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsaUJBQWlCO0FBQUEsSUFDZjtBQUFBLE1BQ0UsU0FBUyxDQUFDLHVCQUF1QixtQkFBbUI7QUFBQSxNQUNwRCxJQUFJLENBQUMsc0JBQXNCO0FBQUEsSUFDN0I7QUFBQSxFQUNGO0FBQUEsRUFDQSxhQUFhLENBQUMsU0FBUztBQUFBLEVBQ3ZCLDBCQUEwQjtBQUFBLElBQ3hCO0FBQUEsTUFDRSxXQUFXO0FBQUEsUUFDVDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVMsQ0FBQyx1QkFBdUIsbUJBQW1CO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQ0YsQ0FBQzs7O0FEakNELElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQ3hDLFNBQU87QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNMLGFBQWE7QUFBQSxNQUNiLFFBQVE7QUFBQSxNQUNSLGVBQWU7QUFBQSxRQUNiLFFBQVE7QUFBQSxVQUNOLGdCQUFnQjtBQUFBLFFBQ2xCO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxJQUVBLFNBQVMsQ0FBQyxJQUFJLEVBQUUsMkJBQVMsQ0FBQyxDQUFDO0FBQUEsRUFDN0I7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
