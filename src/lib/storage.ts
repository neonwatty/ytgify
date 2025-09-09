// Storage interface for GIFs and preferences
import { UserPreferences } from '@/types';

// Enhanced GIF data type with proper blob handling
// This matches what the library component expects
export interface GifDataWithBlob {
  id: string;
  title?: string;
  description?: string;
  gifBlob: Blob; // Keep as gifBlob for component compatibility
  thumbnailBlob?: Blob;
  blob?: Blob; // Also support blob field from storage
  metadata: {
    width: number;
    height: number;
    duration: number;
    frameRate: number;
    fileSize: number;
    createdAt: Date;
    youtubeUrl?: string;
    startTime?: number;
    endTime?: number;
    title?: string; // Support title in metadata too
    description?: string;
  };
  tags?: string[];
  createdAt?: string; // For compatibility
}

// Enhanced GIF settings for popup
export interface PopupGifSettings {
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  loop: boolean;
  width: number;
  height: number;
}

// Enhanced user preferences with GIF settings
export interface EnhancedUserPreferences extends Omit<UserPreferences, 'defaultFrameRate' | 'defaultQuality'> {
  defaultGifSettings: PopupGifSettings;
  showNotifications: boolean;
  keyboardShortcuts: {
    activateGifMode: string;
    openLibrary: string;
  };
}

class GifStorage {
  private dbName = 'YouTubeGifStore'; // Use the same database name as content script
  private dbVersion = 3; // Match the version used in content script
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create stores to match what content script creates
        if (!db.objectStoreNames.contains('gifs')) {
          const gifStore = db.createObjectStore('gifs', { keyPath: 'id' });
          gifStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'gifId' });
        }
        
        if (!db.objectStoreNames.contains('metadata')) {
          const metaStore = db.createObjectStore('metadata', { keyPath: 'id' });
          metaStore.createIndex('youtubeUrl', 'youtubeUrl', { unique: false });
        }
      };
    });
  }

  async saveGif(gif: GifDataWithBlob): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs'], 'readwrite');
      const store = transaction.objectStore('gifs');
      
      const request = store.put(gif);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getGif(id: string): Promise<GifDataWithBlob | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs'], 'readonly');
      const store = transaction.objectStore('gifs');
      
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }
        // Ensure compatibility
        if (result.blob && !result.gifBlob) {
          result.gifBlob = result.blob;
        }
        if (result.metadata?.createdAt && typeof result.metadata.createdAt !== 'string') {
          result.createdAt = new Date(result.metadata.createdAt).toISOString();
        }
        if (result.title && !result.metadata?.title) {
          result.metadata = { ...result.metadata, title: result.title };
        }
        resolve(result);
      };
    });
  }

  async getAllGifs(): Promise<GifDataWithBlob[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs'], 'readonly');
      const store = transaction.objectStore('gifs');
      
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = request.result || [];
        // Map the data to ensure compatibility
        const mappedResults = results.map((item: GifDataWithBlob) => {
          // Ensure gifBlob field exists for component compatibility
          if (item.blob && !item.gifBlob) {
            item.gifBlob = item.blob;
          }
          // Ensure createdAt is a string if it's a Date
          if (item.metadata?.createdAt && typeof item.metadata.createdAt !== 'string') {
            item.createdAt = new Date(item.metadata.createdAt).toISOString();
          }
          // Move title from root to metadata if needed
          if (item.title && !item.metadata?.title) {
            item.metadata = { ...item.metadata, title: item.title };
          }
          return item;
        });
        resolve(mappedResults);
      };
    });
  }

  async deleteGif(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs'], 'readwrite');
      const store = transaction.objectStore('gifs');
      
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAllGifs(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs'], 'readwrite');
      const store = transaction.objectStore('gifs');
      
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

class PreferencesStorage {
  private storageKey = 'userPreferences';

  async get(): Promise<EnhancedUserPreferences> {
    try {
      const result = await chrome.storage.sync.get(this.storageKey);
      
      if (result[this.storageKey]) {
        return result[this.storageKey];
      }
      
      // Return default preferences
      return this.getDefaults();
    } catch (error) {
      console.error('Failed to load preferences:', error);
      return this.getDefaults();
    }
  }

  async save(preferences: EnhancedUserPreferences): Promise<void> {
    try {
      await chrome.storage.sync.set({ [this.storageKey]: preferences });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  }

  private getDefaults(): EnhancedUserPreferences {
    return {
      defaultGifSettings: {
        frameRate: 15,
        quality: 'medium',
        loop: true,
        width: 480,
        height: 270
      },
      autoSave: true,
      showNotifications: true,
      theme: 'system',
      showThumbnails: true,
      gridSize: 'medium',
      maxStorageSize: 100 * 1024 * 1024, // 100MB
      autoCleanup: true,
      cleanupOlderThan: 30,
      maxDuration: 30, // Add missing property
      keyboardShortcuts: {
        activateGifMode: 'Alt+G',
        openLibrary: 'Alt+L'
      }
    };
  }
}

// Export singleton instances
export const gifStorage = new GifStorage();
export const preferencesStorage = new PreferencesStorage();

// Re-export types for convenience
export type { GifDataWithBlob as GifData, EnhancedUserPreferences as UserPreferences };