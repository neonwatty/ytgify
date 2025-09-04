import { GifData, GifMetadata, UserPreferences, StorageQuota, StorageEventListener } from '@/types/storage';
import { gifDatabase } from './database';
import { chromeStorageManager } from './chrome-storage';
import { quotaManager } from './quota-manager';
import { settingsCache } from './settings-cache';

export class StorageManager {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await gifDatabase.initialize();
      await settingsCache.initialize();
      quotaManager.startMonitoring();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw error;
    }
  }

  // GIF Storage Methods (IndexedDB)
  async saveGif(gif: GifData): Promise<void> {
    this.ensureInitialized();
    return gifDatabase.saveGif(gif);
  }

  async getGif(id: string): Promise<GifData | null> {
    this.ensureInitialized();
    return gifDatabase.getGif(id);
  }

  async getAllGifs(): Promise<GifMetadata[]> {
    this.ensureInitialized();
    return gifDatabase.getAllGifs();
  }

  async searchGifs(query: string): Promise<GifMetadata[]> {
    this.ensureInitialized();
    return gifDatabase.searchGifs(query);
  }

  async getGifsByTag(tag: string): Promise<GifMetadata[]> {
    this.ensureInitialized();
    return gifDatabase.getGifsByTag(tag);
  }

  async deleteGif(id: string): Promise<void> {
    this.ensureInitialized();
    return gifDatabase.deleteGif(id);
  }

  async getStorageQuota(): Promise<StorageQuota> {
    this.ensureInitialized();
    return gifDatabase.getStorageQuota();
  }

  async cleanupOldGifs(olderThanDays?: number): Promise<number> {
    this.ensureInitialized();
    const preferences = await this.getPreferences();
    const daysToKeep = olderThanDays ?? preferences.cleanupOlderThan;
    return gifDatabase.cleanup(daysToKeep);
  }

  // Preferences Storage Methods (Chrome Storage)
  async getPreferences(): Promise<UserPreferences> {
    return chromeStorageManager.getPreferences();
  }

  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    return chromeStorageManager.savePreferences(preferences);
  }

  async updatePreference<K extends keyof UserPreferences>(
    key: K, 
    value: UserPreferences[K]
  ): Promise<void> {
    return chromeStorageManager.updatePreference(key, value);
  }

  async resetPreferences(): Promise<void> {
    return chromeStorageManager.resetPreferences();
  }

  async exportPreferences(): Promise<string> {
    return chromeStorageManager.exportPreferences();
  }

  async importPreferences(jsonData: string): Promise<void> {
    return chromeStorageManager.importPreferences(jsonData);
  }

  // Convenience methods for common preferences
  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    return chromeStorageManager.getTheme();
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    return chromeStorageManager.setTheme(theme);
  }

  async getGifSettings(): Promise<{
    frameRate: number;
    quality: number;
    maxDuration: number;
    autoSave: boolean;
  }> {
    return chromeStorageManager.getGifSettings();
  }

  // Re-editing functionality
  async canReEditGif(gifId: string): Promise<boolean> {
    this.ensureInitialized();
    const gif = await this.getGif(gifId);
    return !!gif;
  }

  async hasEditorState(gifId: string): Promise<boolean> {
    this.ensureInitialized();
    return settingsCache.hasEditorState(gifId);
  }

  async clearEditorDrafts(): Promise<number> {
    this.ensureInitialized();
    return settingsCache.clearTemporaryDrafts();
  }

  // Storage management utilities
  async performMaintenance(): Promise<{
    quotaBefore: StorageQuota;
    quotaAfter: StorageQuota;
    gifsDeleted: number;
    draftsCleared: number;
  }> {
    this.ensureInitialized();
    
    const quotaBefore = await this.getStorageQuota();
    const preferences = await this.getPreferences();
    
    let gifsDeleted = 0;
    let draftsCleared = 0;
    
    if (preferences.autoCleanup) {
      gifsDeleted = await this.cleanupOldGifs();
      draftsCleared = await this.clearEditorDrafts();
    }
    
    const quotaAfter = await this.getStorageQuota();
    
    return {
      quotaBefore,
      quotaAfter,
      gifsDeleted,
      draftsCleared
    };
  }

  async checkStorageHealth(): Promise<{
    isHealthy: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    try {
      this.ensureInitialized();
      
      const quota = await this.getStorageQuota();
      const usagePercentage = (quota.used / quota.total) * 100;
      
      if (usagePercentage > 90) {
        issues.push('Storage usage is above 90%');
        suggestions.push('Consider enabling auto-cleanup or manually delete old GIFs');
      } else if (usagePercentage > 75) {
        suggestions.push('Storage usage is above 75%, consider cleanup soon');
      }
      
      const preferences = await this.getPreferences();
      if (!preferences.autoCleanup) {
        suggestions.push('Consider enabling auto-cleanup to manage storage automatically');
      }
      
      const allGifs = await this.getAllGifs();
      const oldGifs = allGifs.filter(gif => {
        const daysSinceCreation = (Date.now() - new Date(gif.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCreation > preferences.cleanupOlderThan;
      });
      
      if (oldGifs.length > 10) {
        suggestions.push(`${oldGifs.length} GIFs are older than ${preferences.cleanupOlderThan} days`);
      }
      
    } catch (error) {
      issues.push(`Storage system error: ${error}`);
    }
    
    return {
      isHealthy: issues.length === 0,
      issues,
      suggestions
    };
  }

  // Event handling
  addEventListener(listener: StorageEventListener): void {
    gifDatabase.addEventListener(listener);
    chromeStorageManager.addEventListener(listener);
  }

  removeEventListener(listener: StorageEventListener): void {
    gifDatabase.removeEventListener(listener);
    chromeStorageManager.removeEventListener(listener);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage manager not initialized. Call initialize() first.');
    }
  }

  async close(): Promise<void> {
    await gifDatabase.close();
    quotaManager.stopMonitoring();
    this.initialized = false;
  }
}

// Singleton instance
export const storageManager = new StorageManager();

// Re-export types and individual managers for direct access if needed
export { GifData, GifMetadata, UserPreferences, StorageQuota, StorageEvent, StorageEventListener } from '@/types/storage';
export { gifDatabase } from './database';
export { chromeStorageManager } from './chrome-storage';
export { quotaManager } from './quota-manager';
export { settingsCache } from './settings-cache';