import { UserPreferences } from '@/types/storage';
import { extensionStateManager } from './state-manager';

export interface PreferenceChangeEvent {
  key: keyof UserPreferences;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

export type PreferenceChangeListener = (event: PreferenceChangeEvent) => void;

export class PreferencesManager {
  private changeListeners: PreferenceChangeListener[] = [];
  private initialized = false;
  private cache: UserPreferences | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamp = 0;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Listen to state manager preference changes
    extensionStateManager.on('preferences-changed', (event) => {
      const newPreferences = event.data as UserPreferences;
      this.handlePreferencesChanged(newPreferences);
    });

    this.initialized = true;
  }

  private handlePreferencesChanged(newPreferences: UserPreferences): void {
    const oldPreferences = this.cache;
    this.cache = newPreferences;
    this.cacheTimestamp = Date.now();

    if (oldPreferences) {
      // Find changed keys and emit change events
      for (const key of Object.keys(newPreferences) as Array<keyof UserPreferences>) {
        if (oldPreferences[key] !== newPreferences[key]) {
          const changeEvent: PreferenceChangeEvent = {
            key,
            oldValue: oldPreferences[key],
            newValue: newPreferences[key],
            timestamp: Date.now()
          };
          
          this.notifyChangeListeners(changeEvent);
        }
      }
    }
  }

  private notifyChangeListeners(event: PreferenceChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in preference change listener:', error);
      }
    });
  }

  private isCacheValid(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL;
  }

  // Preference getters with caching
  async getPreferences(): Promise<UserPreferences> {
    if (this.isCacheValid()) {
      return this.cache!;
    }

    const preferences = await extensionStateManager.getPreferences();
    this.cache = preferences;
    this.cacheTimestamp = Date.now();
    return preferences;
  }

  async getPreference<K extends keyof UserPreferences>(key: K): Promise<UserPreferences[K]> {
    const preferences = await this.getPreferences();
    return preferences[key];
  }

  // Preference setters
  async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    const oldPreferences = await this.getPreferences();
    await extensionStateManager.updatePreference(key, value);
    
    // Update cache immediately
    this.cache = { ...oldPreferences, [key]: value };
    this.cacheTimestamp = Date.now();
  }

  async updatePreferences(updates: Partial<UserPreferences>): Promise<void> {
    const oldPreferences = await this.getPreferences();
    await extensionStateManager.savePreferences(updates);
    
    // Update cache immediately
    this.cache = { ...oldPreferences, ...updates };
    this.cacheTimestamp = Date.now();
  }

  async resetPreferences(): Promise<void> {
    await extensionStateManager.resetPreferences();
    this.cache = null; // Force cache refresh
  }

  // Specialized preference getters
  async getGifCreationDefaults(): Promise<{
    frameRate: number;
    quality: number;
    maxDuration: number;
    autoSave: boolean;
  }> {
    const preferences = await this.getPreferences();
    return {
      frameRate: preferences.defaultFrameRate,
      quality: preferences.defaultQuality,
      maxDuration: preferences.maxDuration,
      autoSave: preferences.autoSave
    };
  }

  async getUIPreferences(): Promise<{
    theme: 'light' | 'dark' | 'system';
    showThumbnails: boolean;
    gridSize: 'small' | 'medium' | 'large';
  }> {
    const preferences = await this.getPreferences();
    return {
      theme: preferences.theme,
      showThumbnails: preferences.showThumbnails,
      gridSize: preferences.gridSize
    };
  }

  async getStoragePreferences(): Promise<{
    maxStorageSize: number;
    autoCleanup: boolean;
    cleanupOlderThan: number;
  }> {
    const preferences = await this.getPreferences();
    return {
      maxStorageSize: preferences.maxStorageSize,
      autoCleanup: preferences.autoCleanup,
      cleanupOlderThan: preferences.cleanupOlderThan
    };
  }

  // Theme-specific methods
  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    return extensionStateManager.getTheme();
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await extensionStateManager.setTheme(theme);
  }

  async resolveTheme(): Promise<'light' | 'dark'> {
    const theme = await this.getTheme();
    
    if (theme === 'system') {
      // Detect system theme
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      // Fallback to light theme
      return 'light';
    }
    
    return theme;
  }

  // Preference validation
  async validateAndUpdatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<boolean> {
    if (!this.isValidPreferenceValue(key, value)) {
      console.warn(`Invalid value for preference ${key}:`, value);
      return false;
    }

    await this.updatePreference(key, value);
    return true;
  }

  private isValidPreferenceValue<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): boolean {
    switch (key) {
      case 'defaultFrameRate':
        return typeof value === 'number' && value > 0 && value <= 60;
      case 'defaultQuality':
        return typeof value === 'number' && value >= 10 && value <= 100;
      case 'maxDuration':
        return typeof value === 'number' && value > 0 && value <= 60;
      case 'autoSave':
        return typeof value === 'boolean';
      case 'theme':
        return ['light', 'dark', 'system'].includes(value as string);
      case 'showThumbnails':
        return typeof value === 'boolean';
      case 'gridSize':
        return ['small', 'medium', 'large'].includes(value as string);
      case 'maxStorageSize':
        return typeof value === 'number' && value > 0 && value <= 2000;
      case 'autoCleanup':
        return typeof value === 'boolean';
      case 'cleanupOlderThan':
        return typeof value === 'number' && value > 0;
      default:
        return true;
    }
  }

  // Event listeners
  addChangeListener(listener: PreferenceChangeListener): void {
    this.changeListeners.push(listener);
  }

  removeChangeListener(listener: PreferenceChangeListener): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  // Utility methods
  async exportPreferences(): Promise<string> {
    const preferences = await this.getPreferences();
    return JSON.stringify(preferences, null, 2);
  }

  async importPreferences(jsonData: string): Promise<void> {
    try {
      const preferences = JSON.parse(jsonData) as Partial<UserPreferences>;
      const validatedPreferences: Partial<UserPreferences> = {};

      // Validate each preference before importing
      for (const [key, value] of Object.entries(preferences)) {
        if (this.isValidPreferenceValue(key as keyof UserPreferences, value)) {
          (validatedPreferences as Record<string, unknown>)[key] = value;
        } else {
          console.warn(`Skipping invalid preference during import: ${key} = ${value}`);
        }
      }

      await this.updatePreferences(validatedPreferences);
    } catch (error) {
      throw new Error(`Failed to import preferences: ${error}`);
    }
  }

  // Cache management
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  async refreshCache(): Promise<void> {
    this.cache = null;
    await this.getPreferences(); // This will refresh the cache
  }

  getCacheInfo(): { cached: boolean; age: number } {
    return {
      cached: this.cache !== null,
      age: this.cache ? Date.now() - this.cacheTimestamp : 0
    };
  }
}

// Singleton instance
export const preferencesManager = new PreferencesManager();