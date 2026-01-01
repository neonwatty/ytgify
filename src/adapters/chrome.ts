/**
 * Chrome Browser API Adapter
 *
 * Wraps chrome.* APIs to conform to the unified BrowserAPI interface.
 * Converts callback-based APIs to Promises and handles chrome.runtime.lastError.
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
  MessageSender,
} from './browser-api';

// ============================================================================
// Helper: Promisify chrome callback APIs with lastError handling
// ============================================================================

function promisify<T>(
  fn: (callback: (result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
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
    return chrome.runtime.lastError ?? null;
  },

  sendMessage<T = unknown, R = unknown>(message: T): Promise<R> {
    return promisify((cb) => chrome.runtime.sendMessage(message, cb as (response: R) => void));
  },

  getURL(path: string): string {
    return chrome.runtime.getURL(path);
  },

  getManifest(): ExtensionManifest {
    return chrome.runtime.getManifest() as ExtensionManifest;
  },

  getId(): string | undefined {
    return chrome.runtime.id;
  },

  reload(): void {
    chrome.runtime.reload();
  },

  onMessage: {
    addListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void {
      chrome.runtime.onMessage.addListener(
        callback as (
          message: unknown,
          sender: chrome.runtime.MessageSender,
          sendResponse: (response?: unknown) => void
        ) => boolean | void
      );
    },
    removeListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void {
      chrome.runtime.onMessage.removeListener(
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
      chrome.runtime.onInstalled.addListener((details) => {
        callback({
          reason: details.reason as InstalledCallback extends (d: infer D) => void
            ? D extends { reason: infer R }
              ? R
              : never
            : never,
          previousVersion: details.previousVersion,
        });
      });
    },
    removeListener(callback: InstalledCallback): void {
      // Chrome doesn't support removing onInstalled listeners easily
      // This is a no-op for compatibility
      void callback;
    },
  },

  onStartup: {
    addListener(callback: VoidCallback): void {
      chrome.runtime.onStartup.addListener(callback);
    },
    removeListener(callback: VoidCallback): void {
      chrome.runtime.onStartup.removeListener(callback);
    },
  },

  onSuspend: {
    addListener(callback: VoidCallback): void {
      chrome.runtime.onSuspend.addListener(callback);
    },
    removeListener(callback: VoidCallback): void {
      chrome.runtime.onSuspend.removeListener(callback);
    },
  },
};

// ============================================================================
// Tabs Implementation
// ============================================================================

const tabs: BrowserTabs = {
  sendMessage<T = unknown, R = unknown>(tabId: number, message: T): Promise<R> {
    return promisify((cb) =>
      chrome.tabs.sendMessage(tabId, message, cb as (response: R) => void)
    );
  },

  query(options: TabQueryOptions): Promise<Tab[]> {
    return promisify((cb) => chrome.tabs.query(options, cb));
  },

  create(options: TabCreateOptions): Promise<Tab> {
    return promisify((cb) => chrome.tabs.create(options, cb));
  },

  update(tabId: number, options: TabUpdateOptions): Promise<Tab | undefined> {
    return promisify((cb) => chrome.tabs.update(tabId, options, cb));
  },
};

// ============================================================================
// Storage Implementation
// ============================================================================

const storage: BrowserStorage = {
  sync: createStorageArea(chrome.storage.sync),
  local: createStorageArea(chrome.storage.local),
  session: chrome.storage.session ? createStorageArea(chrome.storage.session) : null,

  onChanged: {
    addListener(callback: StorageChangeCallback): void {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        callback(changes, areaName as 'sync' | 'local' | 'session');
      });
    },
    removeListener(callback: StorageChangeCallback): void {
      // Chrome's removeListener requires the exact same function reference
      // This is a limitation - callers must keep their own reference
      void callback;
    },
  },
};

// ============================================================================
// Downloads Implementation
// ============================================================================

const downloads: BrowserDownloads = {
  download(options: DownloadOptions): Promise<number> {
    return promisify((cb) => chrome.downloads.download(options, cb));
  },
};

// ============================================================================
// Commands Implementation
// ============================================================================

const commands: BrowserCommands = {
  onCommand: {
    addListener(callback: CommandCallback): void {
      chrome.commands.onCommand.addListener(callback);
    },
    removeListener(callback: CommandCallback): void {
      chrome.commands.onCommand.removeListener(callback);
    },
  },
};

// ============================================================================
// Management Implementation
// ============================================================================

const management: BrowserManagement = {
  getSelf(): Promise<ExtensionInfo> {
    return promisify((cb) => chrome.management.getSelf(cb)) as Promise<ExtensionInfo>;
  },

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return promisify((cb) => chrome.management.setEnabled(id, enabled, cb));
  },
};

// ============================================================================
// Context Detection
// ============================================================================

function isExtensionContext(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    !!chrome.runtime.id
  );
}

function getContext(): 'background' | 'content' | 'popup' | 'unknown' {
  if (!isExtensionContext()) {
    return 'unknown';
  }

  // Check if we're in a service worker (background)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'background';
  }

  const url = window.location.href;

  // Check for extension pages
  if (url.startsWith('chrome-extension://')) {
    if (url.includes('popup.html')) {
      return 'popup';
    }
    return 'background';
  }

  // If we're on a regular webpage with extension context, we're a content script
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
