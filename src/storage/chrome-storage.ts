import { UserPreferences, StorageEvent, StorageEventListener } from '@/types/storage';

export class ChromeStorageManager {
  private listeners: StorageEventListener[] = [];
  private readonly storageKey = 'userPreferences';

  private readonly defaultPreferences: UserPreferences = {
    // GIF creation settings
    defaultFrameRate: 15,
    defaultQuality: 80,
    maxDuration: 10,
    autoSave: true,
    
    // UI preferences
    theme: 'system',
    showThumbnails: true,
    gridSize: 'medium',
    
    // Storage settings
    maxStorageSize: 500, // MB
    autoCleanup: false,
    cleanupOlderThan: 30 // days
  };

  constructor() {
    this.setupStorageListener();
  }

  private setupStorageListener(): void {
    try {
      if (this.isExtensionContext() && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === 'sync' && changes[this.storageKey]) {
            const newValue = changes[this.storageKey].newValue;
            if (newValue) {
              this.notifyListeners({
                type: 'preferences-updated',
                data: newValue
              });
            }
          }
        });
      }
    } catch (error) {
      console.warn('Failed to setup storage listener:', error);
    }
  }

  private isExtensionContext(): boolean {
    try {
      // Only allow storage access in proper extension context
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             !!chrome.runtime.id && 
             (typeof window === 'undefined' || 
              window.location.protocol === 'chrome-extension:');
    } catch (error) {
      return false;
    }
  }

  async getPreferences(): Promise<UserPreferences> {
    try {
      if (!this.isExtensionContext() || !chrome.storage) {
        // Fallback to localStorage for development/testing or content script context
        const stored = localStorage.getItem(this.storageKey);
        return stored ? { ...this.defaultPreferences, ...JSON.parse(stored) } : this.defaultPreferences;
      }

      const result = await chrome.storage.sync.get(this.storageKey);
      const stored = result[this.storageKey];
      
      if (!stored) {
        // Initialize with defaults
        await this.savePreferences(this.defaultPreferences);
        return this.defaultPreferences;
      }

      // Merge with defaults to handle missing fields in stored data
      return { ...this.defaultPreferences, ...stored };
    } catch (error) {
      console.warn('Failed to load preferences from Chrome Storage, using defaults:', error);
      return this.defaultPreferences;
    }
  }

  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const currentPreferences = await this.getPreferences();
      const updatedPreferences = { ...currentPreferences, ...preferences };

      if (!this.isExtensionContext() || !chrome.storage) {
        // Fallback to localStorage for content script context
        localStorage.setItem(this.storageKey, JSON.stringify(updatedPreferences));
        this.notifyListeners({
          type: 'preferences-updated',
          data: updatedPreferences
        });
        return;
      }

      await chrome.storage.sync.set({
        [this.storageKey]: updatedPreferences
      });

      // Chrome storage listener will handle the notification
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw new Error(`Failed to save preferences: ${error}`);
    }
  }

  async updatePreference<K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ): Promise<void> {
    const update: Partial<UserPreferences> = { [key]: value } as Partial<UserPreferences>;
    await this.savePreferences(update);
  }

  async resetPreferences(): Promise<void> {
    await this.savePreferences(this.defaultPreferences);
  }

  async exportPreferences(): Promise<string> {
    const preferences = await this.getPreferences();
    return JSON.stringify(preferences, null, 2);
  }

  async importPreferences(jsonData: string): Promise<void> {
    try {
      const preferences = JSON.parse(jsonData) as Partial<UserPreferences>;
      
      // Validate the imported data
      const validatedPreferences = this.validatePreferences(preferences);
      await this.savePreferences(validatedPreferences);
    } catch (error) {
      throw new Error(`Invalid preferences data: ${error}`);
    }
  }

  private validatePreferences(preferences: unknown): Partial<UserPreferences> {
    const validated: Partial<UserPreferences> = {};

    if (typeof preferences !== 'object' || preferences === null) {
      return validated;
    }

    const prefs = preferences as Record<string, unknown>;

    // Validate GIF creation settings
    if (typeof prefs.defaultFrameRate === 'number' && prefs.defaultFrameRate > 0 && prefs.defaultFrameRate <= 60) {
      validated.defaultFrameRate = prefs.defaultFrameRate;
    }
    
    if (typeof prefs.defaultQuality === 'number' && prefs.defaultQuality >= 10 && prefs.defaultQuality <= 100) {
      validated.defaultQuality = prefs.defaultQuality;
    }
    
    if (typeof prefs.maxDuration === 'number' && prefs.maxDuration > 0 && prefs.maxDuration <= 60) {
      validated.maxDuration = prefs.maxDuration;
    }
    
    if (typeof prefs.autoSave === 'boolean') {
      validated.autoSave = prefs.autoSave;
    }

    // Validate UI preferences
    if (['light', 'dark', 'system'].includes(prefs.theme as string)) {
      validated.theme = prefs.theme as 'light' | 'dark' | 'system';
    }
    
    if (typeof prefs.showThumbnails === 'boolean') {
      validated.showThumbnails = prefs.showThumbnails;
    }
    
    if (['small', 'medium', 'large'].includes(prefs.gridSize as string)) {
      validated.gridSize = prefs.gridSize as 'small' | 'medium' | 'large';
    }

    // Validate storage settings
    if (typeof prefs.maxStorageSize === 'number' && prefs.maxStorageSize > 0) {
      validated.maxStorageSize = Math.min(prefs.maxStorageSize, 2000); // Max 2GB
    }
    
    if (typeof prefs.autoCleanup === 'boolean') {
      validated.autoCleanup = prefs.autoCleanup;
    }
    
    if (typeof prefs.cleanupOlderThan === 'number' && prefs.cleanupOlderThan > 0) {
      validated.cleanupOlderThan = prefs.cleanupOlderThan;
    }

    return validated;
  }

  addEventListener(listener: StorageEventListener): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: StorageEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Generic storage methods
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Fallback to localStorage for development/testing
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
      }

      const result = await chrome.storage.sync.get(key);
      return result[key] || null;
    } catch (error) {
      console.error('Failed to get from storage:', error);
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Fallback to localStorage for development/testing
        localStorage.setItem(key, JSON.stringify(value));
        return;
      }

      await chrome.storage.sync.set({
        [key]: value
      });
    } catch (error) {
      console.error('Failed to set to storage:', error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        // Fallback to localStorage for development/testing
        localStorage.removeItem(key);
        return;
      }

      await chrome.storage.sync.remove(key);
    } catch (error) {
      console.error('Failed to remove from storage:', error);
      throw error;
    }
  }

  private notifyListeners(event: StorageEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in storage event listener:', error);
      }
    });
  }

  // Utility methods for common preference access
  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    const prefs = await this.getPreferences();
    return prefs.theme;
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await this.updatePreference('theme', theme);
  }

  async getGifSettings(): Promise<{
    frameRate: number;
    quality: number;
    maxDuration: number;
    autoSave: boolean;
  }> {
    const prefs = await this.getPreferences();
    return {
      frameRate: prefs.defaultFrameRate,
      quality: prefs.defaultQuality,
      maxDuration: prefs.maxDuration,
      autoSave: prefs.autoSave
    };
  }
}

// Singleton instance
export const chromeStorageManager = new ChromeStorageManager();