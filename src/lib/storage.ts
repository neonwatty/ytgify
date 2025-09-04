// Storage interface for GIFs and preferences
import { GifData, UserPreferences } from '@/types';

// Enhanced GIF data type with proper blob handling
export interface GifDataWithBlob extends Omit<GifData, 'metadata'> {
  gifBlob: Blob;
  thumbnailBlob?: Blob;
  metadata: GifData['metadata'] & {
    title?: string;
    description?: string;
  };
  createdAt: string; // ISO string for storage
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
  private dbName = 'youtube-gif-maker';
  private dbVersion = 1;
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
        
        // Create GIFs store
        if (!db.objectStoreNames.contains('gifs')) {
          const gifStore = db.createObjectStore('gifs', { keyPath: 'id' });
          gifStore.createIndex('createdAt', 'createdAt', { unique: false });
          gifStore.createIndex('title', 'metadata.title', { unique: false });
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
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllGifs(): Promise<GifDataWithBlob[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs'], 'readonly');
      const store = transaction.objectStore('gifs');
      
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
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