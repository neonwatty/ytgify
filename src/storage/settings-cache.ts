import type { GifSettings } from '@/types/storage';
import { chromeStorageManager } from './chrome-storage';

export interface EditorState extends GifSettings {
  // Original video information for re-editing
  youtubeUrl?: string;
  originalVideoTitle?: string;
  
  // Editor UI state
  activeTab?: 'timeline' | 'effects' | 'text' | 'export';
  previewSettings?: {
    isPlaying: boolean;
    currentTime: number;
    playbackRate: number;
  };
  
  // Visual adjustments
  filters?: {
    brightness: number;
    contrast: number;
    saturation: number;
    hue: number;
    blur: number;
    sepia: number;
    grayscale: number;
  };
  
  // Export settings
  exportFormat?: 'gif' | 'webp' | 'mp4';
  optimizationLevel?: 'size' | 'quality' | 'balanced';
  
  // Timestamps for tracking
  createdAt: Date;
  lastModified: Date;
  version: number;
}

export interface CachedEditorSettings {
  gifId: string;
  editorState: EditorState;
  thumbnail?: string; // Base64 encoded thumbnail for quick preview
  isTemporary: boolean; // Whether this is a working draft or saved state
}

class SettingsCache {
  private cache = new Map<string, CachedEditorSettings>();
  private storageKey = 'editor_settings_cache';
  private maxCacheSize = 50; // Maximum number of cached settings
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.loadFromStorage();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize settings cache:', error);
      this.initialized = true; // Continue with empty cache
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = await chromeStorageManager.get(this.storageKey);
      if (stored && Array.isArray(stored)) {
        this.cache.clear();
        stored.forEach((setting: CachedEditorSettings) => {
          // Convert date strings back to Date objects
          setting.editorState.createdAt = new Date(setting.editorState.createdAt);
          setting.editorState.lastModified = new Date(setting.editorState.lastModified);
          this.cache.set(setting.gifId, setting);
        });
      }
    } catch (error) {
      console.error('Failed to load settings cache:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const settingsArray = Array.from(this.cache.values());
      await chromeStorageManager.set(this.storageKey, settingsArray);
    } catch (error) {
      console.error('Failed to save settings cache:', error);
    }
  }

  async saveEditorState(gifId: string, editorState: EditorState, options: {
    thumbnail?: string;
    isTemporary?: boolean;
  } = {}): Promise<void> {
    this.ensureInitialized();
    
    const cached: CachedEditorSettings = {
      gifId,
      editorState: {
        ...editorState,
        lastModified: new Date(),
        version: (this.cache.get(gifId)?.editorState.version || 0) + 1
      },
      thumbnail: options.thumbnail,
      isTemporary: options.isTemporary ?? true
    };
    
    this.cache.set(gifId, cached);
    
    // Manage cache size
    if (this.cache.size > this.maxCacheSize) {
      await this.cleanupOldEntries();
    }
    
    await this.saveToStorage();
  }

  async getEditorState(gifId: string): Promise<CachedEditorSettings | null> {
    this.ensureInitialized();
    return this.cache.get(gifId) || null;
  }

  async hasEditorState(gifId: string): Promise<boolean> {
    this.ensureInitialized();
    return this.cache.has(gifId);
  }

  async removeEditorState(gifId: string): Promise<void> {
    this.ensureInitialized();
    this.cache.delete(gifId);
    await this.saveToStorage();
  }

  async getAllCachedSettings(): Promise<CachedEditorSettings[]> {
    this.ensureInitialized();
    return Array.from(this.cache.values());
  }

  async getTemporaryDrafts(): Promise<CachedEditorSettings[]> {
    this.ensureInitialized();
    return Array.from(this.cache.values()).filter(setting => setting.isTemporary);
  }

  async getSavedStates(): Promise<CachedEditorSettings[]> {
    this.ensureInitialized();
    return Array.from(this.cache.values()).filter(setting => !setting.isTemporary);
  }

  async markAsTemporary(gifId: string): Promise<void> {
    this.ensureInitialized();
    const cached = this.cache.get(gifId);
    if (cached) {
      cached.isTemporary = true;
      cached.editorState.lastModified = new Date();
      await this.saveToStorage();
    }
  }

  async markAsSaved(gifId: string): Promise<void> {
    this.ensureInitialized();
    const cached = this.cache.get(gifId);
    if (cached) {
      cached.isTemporary = false;
      cached.editorState.lastModified = new Date();
      await this.saveToStorage();
    }
  }

  async createDefaultEditorState(gifId: string, baseSettings?: Partial<GifSettings>): Promise<EditorState> {
    const now = new Date();
    
    return {
      startTime: baseSettings?.startTime || 0,
      endTime: baseSettings?.endTime || 10,
      frameRate: baseSettings?.frameRate || 15,
      resolution: baseSettings?.resolution || '480p',
      quality: baseSettings?.quality || 'medium',
      speed: baseSettings?.speed || 1,
      brightness: baseSettings?.brightness || 100,
      contrast: baseSettings?.contrast || 100,
      textOverlays: baseSettings?.textOverlays || [],
      
      activeTab: 'timeline',
      previewSettings: {
        isPlaying: false,
        currentTime: baseSettings?.startTime || 0,
        playbackRate: 1
      },
      
      filters: {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        blur: 0,
        sepia: 0,
        grayscale: 0
      },
      
      exportFormat: 'gif',
      optimizationLevel: 'balanced',
      
      createdAt: now,
      lastModified: now,
      version: 1
    };
  }

  private async cleanupOldEntries(): Promise<void> {
    // Remove temporary drafts older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toRemove: string[] = [];
    
    for (const [gifId, cached] of this.cache) {
      if (cached.isTemporary && cached.editorState.lastModified < oneDayAgo) {
        toRemove.push(gifId);
      }
    }
    
    // If still too many, remove oldest temporary entries
    if (this.cache.size - toRemove.length > this.maxCacheSize) {
      const temporaryEntries = Array.from(this.cache.entries())
        .filter(([, cached]) => cached.isTemporary && !toRemove.includes(cached.gifId))
        .sort((a, b) => a[1].editorState.lastModified.getTime() - b[1].editorState.lastModified.getTime());
      
      const additionalToRemove = temporaryEntries.slice(0, this.cache.size - toRemove.length - this.maxCacheSize);
      toRemove.push(...additionalToRemove.map(([gifId]) => gifId));
    }
    
    toRemove.forEach(gifId => this.cache.delete(gifId));
  }

  async clearTemporaryDrafts(): Promise<number> {
    this.ensureInitialized();
    const drafts = await this.getTemporaryDrafts();
    let cleared = 0;
    
    for (const draft of drafts) {
      this.cache.delete(draft.gifId);
      cleared++;
    }
    
    await this.saveToStorage();
    return cleared;
  }

  async clearAllCache(): Promise<void> {
    this.ensureInitialized();
    this.cache.clear();
    await chromeStorageManager.remove(this.storageKey);
  }

  async getCacheSize(): Promise<number> {
    this.ensureInitialized();
    return this.cache.size;
  }

  async getCacheStats(): Promise<{
    totalEntries: number;
    temporaryDrafts: number;
    savedStates: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    totalSizeEstimate: number; // Rough estimate in bytes
  }> {
    this.ensureInitialized();
    
    const entries = Array.from(this.cache.values());
    const temporaryDrafts = entries.filter(e => e.isTemporary).length;
    const savedStates = entries.filter(e => !e.isTemporary).length;
    
    const dates = entries.map(e => e.editorState.lastModified);
    const oldestEntry = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const newestEntry = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
    
    // Rough size estimate (JSON stringified)
    const totalSizeEstimate = JSON.stringify(entries).length * 2; // Approximate bytes
    
    return {
      totalEntries: entries.length,
      temporaryDrafts,
      savedStates,
      oldestEntry,
      newestEntry,
      totalSizeEstimate
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Settings cache not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
export const settingsCache = new SettingsCache();