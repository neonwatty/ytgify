/**
 * Browser API Adapter Interface
 *
 * Provides a unified interface for browser extension APIs across Chrome, Firefox, and Safari.
 * All methods return Promises (no callback-based APIs exposed).
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface MessageSender {
  tab?: Tab;
  frameId?: number;
  id?: string;
  url?: string;
  origin?: string;
}

export interface Tab {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  windowId?: number;
  index?: number;
}

export interface TabQueryOptions {
  active?: boolean;
  currentWindow?: boolean;
  url?: string | string[];
  windowId?: number;
}

export interface TabCreateOptions {
  url?: string;
  active?: boolean;
  windowId?: number;
  index?: number;
}

export interface TabUpdateOptions {
  url?: string;
  active?: boolean;
  muted?: boolean;
  pinned?: boolean;
}

export interface DownloadOptions {
  url: string;
  filename?: string;
  saveAs?: boolean;
  conflictAction?: 'uniquify' | 'overwrite' | 'prompt';
}

export interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

export interface StorageChanges {
  [key: string]: StorageChange;
}

export type StorageAreaName = 'sync' | 'local' | 'session';

export interface StorageArea {
  get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface ExtensionManifest {
  version: string;
  name: string;
  manifest_version: number;
  [key: string]: unknown;
}

export interface InstalledDetails {
  reason: 'install' | 'update' | 'browser_update' | 'shared_module_update';
  previousVersion?: string;
}

export interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

export type MessageCallback<T = unknown, R = unknown> = (
  message: T,
  sender: MessageSender,
  sendResponse: (response: R) => void
) => boolean | void | Promise<R> | Promise<boolean>;

export type StorageChangeCallback = (
  changes: StorageChanges,
  areaName: StorageAreaName
) => void;

export type CommandCallback = (command: string) => void;

export type InstalledCallback = (details: InstalledDetails) => void;

export type VoidCallback = () => void;

// ============================================================================
// Browser API Interface
// ============================================================================

export interface RuntimeLastError {
  message?: string;
}

export interface BrowserRuntime {
  /** Last error from Chrome API (null for Promise-based browsers) */
  lastError: RuntimeLastError | null | undefined;

  /** Send a message to the extension (background/popup) */
  sendMessage<T = unknown, R = unknown>(message: T): Promise<R>;

  /** Get the full URL for an extension resource */
  getURL(path: string): string;

  /** Get the extension manifest */
  getManifest(): ExtensionManifest;

  /** Get the extension ID */
  getId(): string | undefined;

  /** Reload the extension */
  reload(): void;

  /** Add a message listener */
  onMessage: {
    addListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void;
    removeListener<T = unknown, R = unknown>(callback: MessageCallback<T, R>): void;
  };

  /** Fired when the extension is first installed or updated */
  onInstalled: {
    addListener(callback: InstalledCallback): void;
    removeListener(callback: InstalledCallback): void;
  };

  /** Fired when the browser starts up */
  onStartup: {
    addListener(callback: VoidCallback): void;
    removeListener(callback: VoidCallback): void;
  };

  /** Fired when the extension is about to be suspended (service worker) */
  onSuspend: {
    addListener(callback: VoidCallback): void;
    removeListener(callback: VoidCallback): void;
  };
}

export interface BrowserTabs {
  /** Send a message to a specific tab's content script */
  sendMessage<T = unknown, R = unknown>(tabId: number, message: T): Promise<R>;

  /** Query for tabs matching criteria */
  query(options: TabQueryOptions): Promise<Tab[]>;

  /** Create a new tab */
  create(options: TabCreateOptions): Promise<Tab>;

  /** Update a tab's properties */
  update(tabId: number, options: TabUpdateOptions): Promise<Tab | undefined>;
}

export interface BrowserStorage {
  /** Synced storage (syncs across devices) */
  sync: StorageArea;

  /** Local storage (device-only) */
  local: StorageArea;

  /** Session storage (cleared on browser close, service worker only) */
  session: StorageArea | null;

  /** Listen for storage changes */
  onChanged: {
    addListener(callback: StorageChangeCallback): void;
    removeListener(callback: StorageChangeCallback): void;
  };
}

export interface BrowserDownloads {
  /** Download a file */
  download(options: DownloadOptions): Promise<number>;
}

export interface BrowserCommands {
  /** Listen for keyboard command events */
  onCommand: {
    addListener(callback: CommandCallback): void;
    removeListener(callback: CommandCallback): void;
  };
}

export interface BrowserManagement {
  /** Get info about this extension */
  getSelf(): Promise<ExtensionInfo>;

  /** Enable or disable an extension */
  setEnabled(id: string, enabled: boolean): Promise<void>;
}

// ============================================================================
// Main Browser API Interface
// ============================================================================

export interface BrowserAPI {
  runtime: BrowserRuntime;
  tabs: BrowserTabs;
  storage: BrowserStorage;
  downloads: BrowserDownloads;
  commands: BrowserCommands;
  management: BrowserManagement;

  /** Check if running in extension context */
  isExtensionContext(): boolean;

  /** Get current context type */
  getContext(): 'background' | 'content' | 'popup' | 'unknown';
}

// ============================================================================
// Export type for adapter implementations
// ============================================================================

export type BrowserAPIAdapter = BrowserAPI;
