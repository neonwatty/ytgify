import { GifData, GifMetadata, StorageQuota, StorageEvent, StorageEventListener } from '@/types/storage';

export class GifDatabase {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'YouTubeGifMaker';
  private readonly dbVersion = 1;
  private readonly maxStorageSize = 500 * 1024 * 1024; // 500MB default
  private listeners: StorageEventListener[] = [];

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.setupErrorHandling();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createSchema(db);
      };
    });
  }

  private createSchema(db: IDBDatabase): void {
    // Create gifs object store
    if (!db.objectStoreNames.contains('gifs')) {
      const gifsStore = db.createObjectStore('gifs', { keyPath: 'id' });
      gifsStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
      gifsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
      gifsStore.createIndex('fileSize', 'metadata.fileSize', { unique: false });
      gifsStore.createIndex('youtubeUrl', 'metadata.youtubeUrl', { unique: false });
    }

    // Create thumbnails object store for separate thumbnail storage
    if (!db.objectStoreNames.contains('thumbnails')) {
      db.createObjectStore('thumbnails', { keyPath: 'gifId' });
    }
  }

  private setupErrorHandling(): void {
    if (this.db) {
      this.db.onerror = (event) => {
        console.error('Database error:', event);
      };
    }
  }

  async saveGif(gif: GifData): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check storage quota before saving
    const quota = await this.getStorageQuota();
    if (quota.available < gif.metadata.fileSize) {
      throw new Error('Insufficient storage space');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs', 'thumbnails'], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        this.notifyListeners({ type: 'gif-added', data: gif });
        resolve();
      };

      // Save main GIF data
      const gifsStore = transaction.objectStore('gifs');
      gifsStore.add(gif);

      // Save thumbnail separately if exists
      if (gif.thumbnailBlob) {
        const thumbnailsStore = transaction.objectStore('thumbnails');
        thumbnailsStore.add({
          gifId: gif.id,
          blob: gif.thumbnailBlob,
          createdAt: gif.metadata.createdAt
        });
      }
    });
  }

  async getGif(id: string): Promise<GifData | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs', 'thumbnails'], 'readonly');
      const gifsStore = transaction.objectStore('gifs');
      const thumbnailsStore = transaction.objectStore('thumbnails');

      const gifRequest = gifsStore.get(id);
      const thumbnailRequest = thumbnailsStore.get(id);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        const gifData = gifRequest.result;
        if (!gifData) {
          resolve(null);
          return;
        }

        // Attach thumbnail if exists
        if (thumbnailRequest.result) {
          gifData.thumbnailBlob = thumbnailRequest.result.blob;
        }

        resolve(gifData);
      };
    });
  }

  async getAllGifs(): Promise<GifMetadata[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('gifs', 'readonly');
      const store = transaction.objectStore('gifs');
      const index = store.index('createdAt');
      const request = index.openCursor(null, 'prev'); // Most recent first

      const gifs: GifMetadata[] = [];

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const gif = cursor.value;
          // Extract metadata without blob data for performance
          gifs.push({
            id: gif.id,
            title: gif.title,
            description: gif.description,
            width: gif.metadata.width,
            height: gif.metadata.height,
            duration: gif.metadata.duration,
            frameRate: gif.metadata.frameRate,
            fileSize: gif.metadata.fileSize,
            createdAt: gif.metadata.createdAt,
            youtubeUrl: gif.metadata.youtubeUrl,
            startTime: gif.metadata.startTime,
            endTime: gif.metadata.endTime,
            tags: gif.tags
          });
          cursor.continue();
        } else {
          resolve(gifs);
        }
      };
    });
  }

  async searchGifs(query: string): Promise<GifMetadata[]> {
    const allGifs = await this.getAllGifs();
    const searchTerm = query.toLowerCase();

    return allGifs.filter(gif => 
      gif.title.toLowerCase().includes(searchTerm) ||
      gif.description?.toLowerCase().includes(searchTerm) ||
      gif.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  async getGifsByTag(tag: string): Promise<GifMetadata[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('gifs', 'readonly');
      const store = transaction.objectStore('gifs');
      const index = store.index('tags');
      const request = index.getAll(tag);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const gifs = request.result.map(gif => ({
          id: gif.id,
          title: gif.title,
          description: gif.description,
          width: gif.metadata.width,
          height: gif.metadata.height,
          duration: gif.metadata.duration,
          frameRate: gif.metadata.frameRate,
          fileSize: gif.metadata.fileSize,
          createdAt: gif.metadata.createdAt,
          youtubeUrl: gif.metadata.youtubeUrl,
          startTime: gif.metadata.startTime,
          endTime: gif.metadata.endTime,
          tags: gif.tags
        }));
        resolve(gifs);
      };
    });
  }

  async deleteGif(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs', 'thumbnails'], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        this.notifyListeners({ type: 'gif-deleted', data: { id } });
        resolve();
      };

      const gifsStore = transaction.objectStore('gifs');
      const thumbnailsStore = transaction.objectStore('thumbnails');
      
      gifsStore.delete(id);
      thumbnailsStore.delete(id);
    });
  }

  async getStorageQuota(): Promise<StorageQuota> {
    try {
      const estimate = await navigator.storage?.estimate();
      const used = estimate?.usage || 0;
      const total = estimate?.quota || this.maxStorageSize;
      
      return {
        used,
        total,
        available: total - used
      };
    } catch (error) {
      // Fallback for browsers without storage.estimate()
      return {
        used: 0,
        total: this.maxStorageSize,
        available: this.maxStorageSize
      };
    }
  }

  async cleanup(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const allGifs = await this.getAllGifs();
    const gifsToDelete = allGifs.filter(gif => 
      new Date(gif.createdAt) < cutoffDate
    );

    for (const gif of gifsToDelete) {
      await this.deleteGif(gif.id);
    }

    return gifsToDelete.length;
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

  private notifyListeners(event: StorageEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in storage event listener:', error);
      }
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
export const gifDatabase = new GifDatabase();