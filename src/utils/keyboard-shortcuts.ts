/**
 * Keyboard Shortcuts System
 *
 * Manages keyboard shortcuts for the YTgify extension.
 * Handles shortcut registration, event listening, and conflict resolution
 * with YouTube's native shortcuts.
 */

interface KeyboardShortcut {
  key: string;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  description: string;
  action: string;
}

interface ShortcutConfig {
  // Basic navigation shortcuts
  preview: KeyboardShortcut;
  save: KeyboardShortcut;
  cancel: KeyboardShortcut;
  // Extension activation shortcuts
  activateGifMode: KeyboardShortcut;
  openLibrary: KeyboardShortcut;
  // Timeline shortcuts
  selectAll: KeyboardShortcut;
  resetSelection: KeyboardShortcut;
}

interface ShortcutHandler {
  action: string;
  handler: (event: KeyboardEvent) => void | Promise<void>;
  priority?: number; // Higher priority handlers are called first
  condition?: () => boolean; // Optional condition to check before executing
}

// Default shortcut configuration
const DEFAULT_SHORTCUTS: ShortcutConfig = {
  preview: {
    key: 'Space',
    description: 'Toggle preview',
    action: 'preview',
  },
  save: {
    key: 'Enter',
    description: 'Save GIF',
    action: 'save',
  },
  cancel: {
    key: 'Escape',
    description: 'Cancel operation',
    action: 'cancel',
  },
  activateGifMode: {
    key: 'g',
    modifiers: { alt: true },
    description: 'Activate GIF mode',
    action: 'activateGifMode',
  },
  openLibrary: {
    key: 'l',
    modifiers: { alt: true },
    description: 'Open GIF library',
    action: 'openLibrary',
  },
  selectAll: {
    key: 'a',
    modifiers: { ctrl: true },
    description: 'Select entire video',
    action: 'selectAll',
  },
  resetSelection: {
    key: 'r',
    modifiers: { ctrl: true },
    description: 'Reset selection',
    action: 'resetSelection',
  },
};

// YouTube's native shortcuts we need to avoid conflicts with
const YOUTUBE_SHORTCUTS = {
  unmodified: new Set([
    'k', // Play/pause
    'j', // Rewind 10s
    'l', // Fast forward 10s
    'm', // Mute
    'f', // Fullscreen
    't', // Theater mode
    'c', // Captions
    'i', // Miniplayer
    'o', // Picture-in-picture
    'p', // Previous video
    'n', // Next video
    '/', // Search
    '?', // Keyboard shortcuts help
    'ArrowLeft', // Rewind 5s
    'ArrowRight', // Fast forward 5s
    'ArrowUp', // Volume up
    'ArrowDown', // Volume down
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9', // Jump to %
    ',',
    '.', // Frame by frame
    '<',
    '>', // Playback speed
  ]),
  withModifiers: new Set([
    'shift+n', // Previous video (alternative)
    'shift+p', // Previous video
    'ctrl+shift+k', // Dark/Light theme toggle
    'alt+left', // Previous page
    'alt+right', // Next page
  ]),
};

export class KeyboardShortcutManager {
  private handlers = new Map<string, ShortcutHandler[]>();
  private currentConfig: ShortcutConfig = DEFAULT_SHORTCUTS;
  private isActive = false;
  private readonly context: 'content' | 'popup';

  constructor(context: 'content' | 'popup' = 'content') {
    this.context = context;
  }

  /**
   * Initialize the keyboard shortcut manager
   */
  async initialize(): Promise<void> {
    // Load user's custom shortcuts from storage
    try {
      const config = await this.loadShortcutConfig();
      if (config) {
        this.currentConfig = { ...DEFAULT_SHORTCUTS, ...config };
      }
    } catch (error) {
      console.warn('Failed to load shortcut config, using defaults:', error);
    }

    this.setupEventListeners();
    this.isActive = true;
  }

  /**
   * Register a handler for a specific action
   */
  registerHandler(handler: ShortcutHandler): () => void {
    const { action } = handler;

    if (!this.handlers.has(action)) {
      this.handlers.set(action, []);
    }

    const handlers = this.handlers.get(action)!;
    handlers.push(handler);

    // Sort by priority (higher first)
    handlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Return unregister function
    return () => {
      const handlersList = this.handlers.get(action);
      if (handlersList) {
        const index = handlersList.indexOf(handler);
        if (index > -1) {
          handlersList.splice(index, 1);
        }
        if (handlersList.length === 0) {
          this.handlers.delete(action);
        }
      }
    };
  }

  /**
   * Update shortcut configuration
   */
  async updateShortcut(
    action: keyof ShortcutConfig,
    shortcut: Partial<KeyboardShortcut>
  ): Promise<void> {
    const current = this.currentConfig[action];
    const updated = { ...current, ...shortcut };

    // Validate shortcut doesn't conflict with YouTube shortcuts
    if (this.context === 'content' && this.hasYouTubeConflict(updated)) {
      throw new Error(`Shortcut conflicts with YouTube's native shortcuts: ${updated.key}`);
    }

    this.currentConfig[action] = updated;
    await this.saveShortcutConfig();
  }

  /**
   * Get current shortcut configuration
   */
  getConfig(): ShortcutConfig {
    return { ...this.currentConfig };
  }

  /**
   * Reset shortcuts to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.currentConfig = { ...DEFAULT_SHORTCUTS };
    await this.saveShortcutConfig();
  }

  /**
   * Disable shortcut handling temporarily
   */
  disable(): void {
    this.isActive = false;
  }

  /**
   * Enable shortcut handling
   */
  enable(): void {
    this.isActive = true;
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    this.isActive = false;
    document.removeEventListener('keydown', this.handleKeyDown);
    this.handlers.clear();
  }

  /**
   * Check if element should receive keyboard events
   */
  private shouldIgnoreElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();

    // Ignore input elements and contenteditable
    if (['input', 'textarea', 'select'].includes(tagName)) {
      return true;
    }

    if (element.getAttribute('contenteditable') === 'true') {
      return true;
    }

    // Ignore YouTube's player controls and search elements
    if (element.closest('.ytp-chrome-controls')) {
      return true;
    }

    if (element.closest('#masthead-search') || element.closest('#search')) {
      return true;
    }

    if (element.closest('.ytd-searchbox')) {
      return true;
    }

    // Allow shortcuts in our own components
    if (element.closest('[data-gif-maker-shortcut-zone]')) {
      return false;
    }

    return false;
  }

  /**
   * Setup keyboard event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener('keydown', this.handleKeyDown, true);
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isActive) return;

    // Ignore events from input elements (unless in our components)
    if (this.shouldIgnoreElement(event.target as Element)) {
      return;
    }

    // Find matching shortcut
    const matchedAction = this.findMatchingShortcut(event);
    if (!matchedAction) return;

    // Execute handlers for the matched action
    const handlers = this.handlers.get(matchedAction);
    if (!handlers || handlers.length === 0) return;

    // Check conditions and execute handlers
    for (const handler of handlers) {
      if (handler.condition && !handler.condition()) {
        continue;
      }

      try {
        const result = handler.handler(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`Error executing shortcut handler for ${matchedAction}:`, error);
          });
        }

        // If handler doesn't explicitly not prevent default, we prevent it
        if (!event.defaultPrevented) {
          event.preventDefault();
          event.stopPropagation();
        }

        break; // Only execute the highest priority handler
      } catch (error) {
        console.error(`Error executing shortcut handler for ${matchedAction}:`, error);
      }
    }
  };

  /**
   * Find the action that matches the current key event
   */
  private findMatchingShortcut(event: KeyboardEvent): string | null {
    for (const [, shortcut] of Object.entries(this.currentConfig)) {
      if (this.matchesShortcut(event, shortcut)) {
        return shortcut.action;
      }
    }
    return null;
  }

  /**
   * Check if the event matches a shortcut
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    // Check main key
    if (event.code !== shortcut.key && event.key !== shortcut.key) {
      return false;
    }

    const modifiers = shortcut.modifiers || {};

    // Check modifiers
    if (Boolean(modifiers.ctrl) !== event.ctrlKey) return false;
    if (Boolean(modifiers.alt) !== event.altKey) return false;
    if (Boolean(modifiers.shift) !== event.shiftKey) return false;
    if (Boolean(modifiers.meta) !== event.metaKey) return false;

    return true;
  }

  /**
   * Check if shortcut conflicts with YouTube's native shortcuts
   */
  private hasYouTubeConflict(shortcut: KeyboardShortcut): boolean {
    const hasModifiers =
      shortcut.modifiers &&
      (shortcut.modifiers.ctrl ||
        shortcut.modifiers.alt ||
        shortcut.modifiers.shift ||
        shortcut.modifiers.meta);

    if (hasModifiers) {
      // Check modified shortcuts
      const modifierString = this.formatShortcutForConflictCheck(shortcut).toLowerCase();
      return YOUTUBE_SHORTCUTS.withModifiers.has(modifierString);
    }

    // Check unmodified shortcuts
    return YOUTUBE_SHORTCUTS.unmodified.has(shortcut.key);
  }

  /**
   * Format shortcut for conflict checking (consistent format)
   */
  private formatShortcutForConflictCheck(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];

    if (shortcut.modifiers?.ctrl) parts.push('ctrl');
    if (shortcut.modifiers?.alt) parts.push('alt');
    if (shortcut.modifiers?.shift) parts.push('shift');
    if (shortcut.modifiers?.meta) parts.push('meta');

    parts.push(shortcut.key.toLowerCase());

    return parts.join('+');
  }

  /**
   * Load shortcut configuration from storage
   */
  private async loadShortcutConfig(): Promise<Partial<ShortcutConfig> | null> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.sync.get(['keyboardShortcuts']);
      return result.keyboardShortcuts || null;
    }

    // Fallback to localStorage for popup context
    const stored = localStorage.getItem('gif-maker-shortcuts');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Save shortcut configuration to storage
   */
  private async saveShortcutConfig(): Promise<void> {
    const config = this.currentConfig;

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.sync.set({ keyboardShortcuts: config });
    } else {
      // Fallback to localStorage for popup context
      localStorage.setItem('gif-maker-shortcuts', JSON.stringify(config));
    }
  }
}

// Export a default instance for the content script
const _keyboardShortcuts = new KeyboardShortcutManager('content');

// Utility functions for shortcut display
function _formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers?.ctrl) parts.push('Ctrl');
  if (shortcut.modifiers?.alt) parts.push('Alt');
  if (shortcut.modifiers?.shift) parts.push('Shift');
  if (shortcut.modifiers?.meta) parts.push('Cmd');

  parts.push(shortcut.key);

  return parts.join(' + ');
}

function _parseShortcutString(shortcutString: string): Partial<KeyboardShortcut> {
  if (!shortcutString || shortcutString.trim() === '') {
    return {};
  }

  const parts = shortcutString
    .split(' + ')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {};
  }

  const key = parts[parts.length - 1];

  if (!key || key.length === 0) {
    return {};
  }

  const modifiers: KeyboardShortcut['modifiers'] = {};

  for (const part of parts.slice(0, -1)) {
    switch (part.toLowerCase()) {
      case 'ctrl':
        modifiers.ctrl = true;
        break;
      case 'alt':
        modifiers.alt = true;
        break;
      case 'shift':
        modifiers.shift = true;
        break;
      case 'cmd':
      case 'meta':
        modifiers.meta = true;
        break;
    }
  }

  return { key, modifiers: Object.keys(modifiers).length > 0 ? modifiers : undefined };
}
