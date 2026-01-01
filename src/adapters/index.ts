/**
 * Browser API Adapter Index
 *
 * This module exports the appropriate browser adapter based on build configuration.
 *
 * Build-time resolution (recommended):
 *   Configure your bundler to alias '@/adapters' to the target-specific adapter:
 *
 *   // webpack.config.js
 *   resolve: {
 *     alias: {
 *       '@/adapters$': path.resolve(__dirname, `src/adapters/${target}.ts`)
 *     }
 *   }
 *
 *   // esbuild
 *   alias: {
 *     '@/adapters': `./src/adapters/${target}.ts`
 *   }
 *
 * Runtime detection (fallback):
 *   If no build-time alias is configured, this module attempts runtime detection.
 *   This is less efficient but works for development/testing.
 */

// Re-export types
export type {
  BrowserAPI,
  BrowserAPIAdapter,
  BrowserRuntime,
  BrowserTabs,
  BrowserStorage,
  BrowserDownloads,
  BrowserCommands,
  BrowserManagement,
  StorageArea,
  MessageSender,
  Tab,
  TabQueryOptions,
  TabCreateOptions,
  TabUpdateOptions,
  DownloadOptions,
  StorageChange,
  StorageChanges,
  StorageAreaName,
  ExtensionManifest,
  InstalledDetails,
  ExtensionInfo,
  MessageCallback,
  StorageChangeCallback,
  CommandCallback,
  InstalledCallback,
  VoidCallback,
} from './browser-api';

// Build target detection
// This will be replaced at build time via define/replace plugin:
//   BROWSER_TARGET: 'chrome' | 'firefox' | 'safari'
declare const BROWSER_TARGET: 'chrome' | 'firefox' | 'safari' | undefined;

// Runtime browser detection (fallback when BROWSER_TARGET not defined)
function detectBrowser(): 'chrome' | 'firefox' | 'safari' {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) {
      return 'firefox';
    }
    if (ua.includes('safari') && !ua.includes('chrome')) {
      return 'safari';
    }
  }
  return 'chrome';
}

// Get the target browser
function getTarget(): 'chrome' | 'firefox' | 'safari' {
  if (typeof BROWSER_TARGET !== 'undefined') {
    return BROWSER_TARGET;
  }
  return detectBrowser();
}

// Dynamic import based on target
// Note: For production, use build-time aliasing instead
import type { BrowserAPI } from './browser-api';

let _browserAPI: BrowserAPI | null = null;

/**
 * Get the browser API adapter.
 * Prefer using the static import from the target-specific module.
 */
export async function getBrowserAPI(): Promise<BrowserAPI> {
  if (_browserAPI) {
    return _browserAPI;
  }

  const target = getTarget();

  switch (target) {
    case 'firefox': {
      const { browserAPI } = await import('./firefox');
      _browserAPI = browserAPI;
      break;
    }
    case 'safari': {
      const { browserAPI } = await import('./safari');
      _browserAPI = browserAPI;
      break;
    }
    case 'chrome':
    default: {
      const { browserAPI } = await import('./chrome');
      _browserAPI = browserAPI;
      break;
    }
  }

  return _browserAPI;
}

// For synchronous access (requires bundler alias to work correctly)
// This export will be tree-shaken and replaced by the bundler alias
export { browserAPI } from './chrome';
