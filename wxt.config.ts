import { defineConfig } from 'wxt';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // No srcDir - entrypoints at root level

  // Configure Vite to handle path aliases from tsconfig.json
  vite: () => ({
    plugins: [tsconfigPaths()],
  }),

  manifest: ({ mode, browser }) => ({
    name: 'YTgify',
    version: '1.0.8',
    description: 'Turn your favorite YouTube moments into shareable GIFs.',
    permissions: ['storage', 'tabs', 'activeTab', 'downloads'],
    // Environment-based host permissions
    host_permissions: mode === 'development'
      ? ['https://*.youtube.com/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*']
      : ['https://*.youtube.com/*'],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+G',
          mac: 'Command+Shift+G'
        },
        description: 'Open GIF creation wizard'
      }
    },
    // Web accessible resources for worker and assets
    web_accessible_resources: [{
      matches: ['*://*.youtube.com/*'],
      resources: ['gif.worker.js', '*.css', '*.wasm']
    }],
    // Browser-specific adjustments
    ...(browser === 'firefox' ? {
      // Firefox-specific entries if needed
    } : {})
  }),
  runner: {
    startUrls: ['https://youtube.com']
  }
});
