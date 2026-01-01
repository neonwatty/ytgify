/**
 * Safari Browser API Adapter
 *
 * Safari supports both chrome.* and browser.* namespaces.
 * This adapter uses browser.* for consistency with modern WebExtension APIs.
 *
 * Safari-specific considerations:
 * - Safari 15.4+ supports Manifest V3
 * - Safari 16.4+ supports storage.session and OffscreenCanvas
 * - Some APIs may have subtle behavioral differences
 */

import type {
  BrowserAPI,
  BrowserRuntime,
  BrowserTabs,
  BrowserStorage,
  BrowserDownloads,
  BrowserCommands,
  BrowserManagement,
  StorageArea,
  MessageCallback,
  StorageChangeCallback,
  CommandCallback,
  InstalledCallback,
  VoidCallback,
  TabQueryOptions,
  TabCreateOptions,
  TabUpdateOptions,
  DownloadOptions,
  Tab,
  ExtensionManifest,
  ExtensionInfo,
} from './browser-api';

// Safari supports the browser.* namespace (WebExtension standard)
// Falls back to chrome.* if browser.* is not available
declare const browser: typeof chrome | undefined;

// Get the appropriate namespace
function getAPI(): typeof chrome {
  if (typeof browser !== 'undefined') {
    return browser as unknown as typeof chrome;
  }
  return chrome;
}

const api = getAPI();

// ============================================================================
// Helper: Promisify APIs (Safari may use callbacks or promises depending on version)
// ============================================================================

function promisify<T>(
  fn: (callback: (result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      fn((result) => {
        if (api.runtime.lastError) {
          reject(new Error(api.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ============================================================================
// Storage Area Wrapper
// ============================================================================

function createStorageArea(area: chrome.storage.StorageArea): StorageArea {
  return {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
      return promisify((cb) => area.get(keys ?? null, cb));
    },
    set(items: Record<string, unknown>): Promise<void> {
      return promisify((cb) => area.set(items, cb));
    },
    remove(keys: string | string[]): Promise<void> {
      return promisify((cb) => area.remove(keys, cb));
    },
    clear(): Promise<void> {
      return promisify((cb) => area.clear(cb));
    },
  };
}

// ============================================================================
// Runtime Implementation
// ============================================================================

const runtime: BrowserRuntime = {
  get lastError() {
    return api.runtime.lastError ?? null;
  },

  sendMessage<T = unknown, R = unknown>(message: T): Promise<R> {
    return promisify((cb) => api.runtime.sendMessage(message, cb as (response: R) => void));
  },

  getURL(path: string): string {
    return api.runtime.getURL(path);
  },

  getManifest(): ExtensionManifest {
    return api.runtime.getManifest() as ExtensionManifest;
  },

  getId(): string | undefined {
    return api.runtime.id;
  },

  reload(): void {
    api.runtime.reload();
  },

  onMessage: {
    addListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void {
      api.runtime.onMessage.addListener(
        callback as (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      );
    },
    removeListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void {
      api.runtime.onMessage.removeListener(
        callback as (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      );
    },
  },

  onInstalled: {
    addListener(callback: InstalledCallback): void {
      api.runtime.onInstalled.addListener((details) => {
        callback({
          reason: details.reason as 'install' | 'update' | 'browser_update' | 'shared_module_update',
          previousVersion: details.previousVersion,
        });
      });
    },
    removeListener(callback: InstalledCallback): void {
      void callback;
    },
  },

  onStartup: {
    addListener(callback: VoidCallback): void {
      api.runtime.onStartup.addListener(callback);
    },
    removeListener(callback: VoidCallback): void {
      api.runtime.onStartup.removeListener(callback);
    },
  },

  onSuspend: {
    addListener(callback: VoidCallback): void {
      api.runtime.onSuspend.addListener(callback);
    },
    removeListener(callback: VoidCallback): void {
      api.runtime.onSuspend.removeListener(callback);
    },
  },
};

// ============================================================================
// Tabs Implementation
// ============================================================================

const tabs: BrowserTabs = {
  sendMessage<T = unknown, R = unknown>(tabId: number, message: T): Promise<R> {
    return promisify((cb) =>
      api.tabs.sendMessage(tabId, message, cb as (response: R) => void)
    );
  },

  query(options: TabQueryOptions): Promise<Tab[]> {
    return promisify((cb) => api.tabs.query(options, cb));
  },

  create(options: TabCreateOptions): Promise<Tab> {
    return promisify((cb) => api.tabs.create(options, cb));
  },

  update(tabId: number, options: TabUpdateOptions): Promise<Tab | undefined> {
    return promisify((cb) => api.tabs.update(tabId, options, cb));
  },
};

// ============================================================================
// Storage Implementation
// ============================================================================

const storage: BrowserStorage = {
  sync: createStorageArea(api.storage.sync),
  local: createStorageArea(api.storage.local),
  // Safari 16.4+ supports session storage
  session: api.storage.session ? createStorageArea(api.storage.session) : null,

  onChanged: {
    addListener(callback: StorageChangeCallback): void {
      api.storage.onChanged.addListener((changes, areaName) => {
        callback(changes, areaName as 'sync' | 'local' | 'session');
      });
    },
    removeListener(callback: StorageChangeCallback): void {
      void callback;
    },
  },
};

// ============================================================================
// Downloads Implementation
// ============================================================================

const downloads: BrowserDownloads = {
  download(options: DownloadOptions): Promise<number> {
    return promisify((cb) => api.downloads.download(options, cb));
  },
};

// ============================================================================
// Commands Implementation
// ============================================================================

const commands: BrowserCommands = {
  onCommand: {
    addListener(callback: CommandCallback): void {
      api.commands.onCommand.addListener(callback);
    },
    removeListener(callback: CommandCallback): void {
      api.commands.onCommand.removeListener(callback);
    },
  },
};

// ============================================================================
// Management Implementation
// ============================================================================

const management: BrowserManagement = {
  getSelf(): Promise<ExtensionInfo> {
    return promisify((cb) => api.management.getSelf(cb)) as Promise<ExtensionInfo>;
  },

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return promisify((cb) => api.management.setEnabled(id, enabled, cb));
  },
};

// ============================================================================
// Context Detection
// ============================================================================

function isExtensionContext(): boolean {
  const activeAPI = getAPI();
  return (
    typeof activeAPI !== 'undefined' &&
    typeof activeAPI.runtime !== 'undefined' &&
    !!activeAPI.runtime.id
  );
}

function getContext(): 'background' | 'content' | 'popup' | 'unknown' {
  if (!isExtensionContext()) {
    return 'unknown';
  }

  // Check for service worker / background script
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'background';
  }

  const url = window.location.href;

  // Check for Safari extension pages
  if (url.startsWith('safari-web-extension://')) {
    if (url.includes('popup.html')) {
      return 'popup';
    }
    return 'background';
  }

  // Content script context
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return 'content';
  }

  return 'unknown';
}

// ============================================================================
// Export Browser API
// ============================================================================

export const browserAPI: BrowserAPI = {
  runtime,
  tabs,
  storage,
  downloads,
  commands,
  management,
  isExtensionContext,
  getContext,
};

export default browserAPI;
