/**
 * Firefox Browser API Adapter
 *
 * Wraps browser.* APIs to conform to the unified BrowserAPI interface.
 * Firefox's WebExtension APIs are already Promise-based.
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

// Firefox's browser.* namespace
declare const browser: {
  runtime: {
    sendMessage: <T, R>(message: T) => Promise<R>;
    getURL: (path: string) => string;
    getManifest: () => ExtensionManifest;
    id: string;
    reload: () => void;
    onMessage: {
      addListener: (callback: (message: unknown, sender: unknown) => Promise<unknown> | boolean | void) => void;
      removeListener: (callback: (message: unknown, sender: unknown) => Promise<unknown> | boolean | void) => void;
    };
    onInstalled: {
      addListener: (callback: (details: { reason: string; previousVersion?: string }) => void) => void;
      removeListener: (callback: (details: { reason: string; previousVersion?: string }) => void) => void;
    };
    onStartup: {
      addListener: (callback: () => void) => void;
      removeListener: (callback: () => void) => void;
    };
    onSuspend: {
      addListener: (callback: () => void) => void;
      removeListener: (callback: () => void) => void;
    };
  };
  tabs: {
    sendMessage: <T, R>(tabId: number, message: T) => Promise<R>;
    query: (options: TabQueryOptions) => Promise<Tab[]>;
    create: (options: TabCreateOptions) => Promise<Tab>;
    update: (tabId: number, options: TabUpdateOptions) => Promise<Tab | undefined>;
  };
  storage: {
    sync: {
      get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      clear: () => Promise<void>;
    };
    local: {
      get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      clear: () => Promise<void>;
    };
    session?: {
      get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      clear: () => Promise<void>;
    };
    onChanged: {
      addListener: (callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void) => void;
      removeListener: (callback: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void) => void;
    };
  };
  downloads: {
    download: (options: DownloadOptions) => Promise<number>;
  };
  commands: {
    onCommand: {
      addListener: (callback: (command: string) => void) => void;
      removeListener: (callback: (command: string) => void) => void;
    };
  };
  management: {
    getSelf: () => Promise<ExtensionInfo>;
    setEnabled: (id: string, enabled: boolean) => Promise<void>;
  };
};

// ============================================================================
// Storage Area Wrapper
// ============================================================================

function createStorageArea(area: typeof browser.storage.sync): StorageArea {
  return {
    get(keys?: string | string[] | null): Promise<Record<string, unknown>> {
      return area.get(keys ?? null);
    },
    set(items: Record<string, unknown>): Promise<void> {
      return area.set(items);
    },
    remove(keys: string | string[]): Promise<void> {
      return area.remove(keys);
    },
    clear(): Promise<void> {
      return area.clear();
    },
  };
}

// ============================================================================
// Runtime Implementation
// ============================================================================

const runtime: BrowserRuntime = {
  // Firefox uses Promise-based APIs that throw errors, no lastError pattern
  lastError: null,

  sendMessage<T = unknown, R = unknown>(message: T): Promise<R> {
    return browser.runtime.sendMessage<T, R>(message);
  },

  getURL(path: string): string {
    return browser.runtime.getURL(path);
  },

  getManifest(): ExtensionManifest {
    return browser.runtime.getManifest();
  },

  getId(): string | undefined {
    return browser.runtime.id;
  },

  reload(): void {
    browser.runtime.reload();
  },

  onMessage: {
    addListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void {
      browser.runtime.onMessage.addListener((message, sender) => {
        // Firefox expects Promise return for async responses
        let syncResponse: R | undefined;

        const sendResponse = (response: R) => {
          syncResponse = response;
        };

        const result = callback(message as T, sender as Parameters<MessageCallback<T, R>>[1], sendResponse);

        if (result instanceof Promise) {
          return result as Promise<unknown>;
        }

        if (result === true && syncResponse !== undefined) {
          return Promise.resolve(syncResponse) as Promise<unknown>;
        }

        return result;
      });
    },
    removeListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void {
      // Firefox requires the exact same function reference
      void callback;
    },
  },

  onInstalled: {
    addListener(callback: InstalledCallback): void {
      browser.runtime.onInstalled.addListener((details) => {
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
      browser.runtime.onStartup.addListener(callback);
    },
    removeListener(callback: VoidCallback): void {
      browser.runtime.onStartup.removeListener(callback);
    },
  },

  onSuspend: {
    addListener(callback: VoidCallback): void {
      browser.runtime.onSuspend.addListener(callback);
    },
    removeListener(callback: VoidCallback): void {
      browser.runtime.onSuspend.removeListener(callback);
    },
  },
};

// ============================================================================
// Tabs Implementation
// ============================================================================

const tabs: BrowserTabs = {
  sendMessage<T = unknown, R = unknown>(tabId: number, message: T): Promise<R> {
    return browser.tabs.sendMessage<T, R>(tabId, message);
  },

  query(options: TabQueryOptions): Promise<Tab[]> {
    return browser.tabs.query(options);
  },

  create(options: TabCreateOptions): Promise<Tab> {
    return browser.tabs.create(options);
  },

  update(tabId: number, options: TabUpdateOptions): Promise<Tab | undefined> {
    return browser.tabs.update(tabId, options);
  },
};

// ============================================================================
// Storage Implementation
// ============================================================================

const storage: BrowserStorage = {
  sync: createStorageArea(browser.storage.sync),
  local: createStorageArea(browser.storage.local),
  session: browser.storage.session ? createStorageArea(browser.storage.session) : null,

  onChanged: {
    addListener(callback: StorageChangeCallback): void {
      browser.storage.onChanged.addListener((changes, areaName) => {
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
    return browser.downloads.download(options);
  },
};

// ============================================================================
// Commands Implementation
// ============================================================================

const commands: BrowserCommands = {
  onCommand: {
    addListener(callback: CommandCallback): void {
      browser.commands.onCommand.addListener(callback);
    },
    removeListener(callback: CommandCallback): void {
      browser.commands.onCommand.removeListener(callback);
    },
  },
};

// ============================================================================
// Management Implementation
// ============================================================================

const management: BrowserManagement = {
  getSelf(): Promise<ExtensionInfo> {
    return browser.management.getSelf();
  },

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return browser.management.setEnabled(id, enabled);
  },
};

// ============================================================================
// Context Detection
// ============================================================================

function isExtensionContext(): boolean {
  return typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
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

  // Check for Firefox extension pages
  if (url.startsWith('moz-extension://')) {
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
