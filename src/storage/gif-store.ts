import { GifData, GifMetadata, StorageEvent, StorageEventListener } from '@/types/storage';
import { BlobManager } from './blob-manager';

interface GifStoreMigration {
  version: number;
  migrate: (db: IDBDatabase, transaction: IDBTransaction, oldVersion: number) => void;
}

interface StoreConfig {
  maxRetries: number;
  retryDelay: number;
  compressionThreshold: number;
  chunkSize: number;
}

export class GifStore {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'YouTubeGifStore';
  private currentVersion = 3;
  private listeners = new Map<string, StorageEventListener>();
  private blobManager: BlobManager;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private readonly config: StoreConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    compressionThreshold: 1024 * 1024, // 1MB
    chunkSize: 256 * 1024 // 256KB chunks for blob operations
  };

  private readonly migrations: GifStoreMigration[] = [
    {
      version: 1,
      migrate: (db) => {
        // Initial schema
        if (!db.objectStoreNames.contains('gifs')) {
          const gifsStore = db.createObjectStore('gifs', { keyPath: 'id' });
          gifsStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          gifsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          gifsStore.createIndex('fileSize', 'metadata.fileSize', { unique: false });
        }
        if (!db.objectStoreNames.contains('thumbnails')) {
          db.createObjectStore('thumbnails', { keyPath: 'gifId' });
        }
      }
    },
    {
      version: 2,
      migrate: (db) => {
        // Add metadata store for quick queries
        if (!db.objectStoreNames.contains('metadata')) {
          const metaStore = db.createObjectStore('metadata', { keyPath: 'id' });
          metaStore.createIndex('youtubeUrl', 'youtubeUrl', { unique: false });
          metaStore.createIndex('lastModified', 'lastModified', { unique: false });
        }
      }
    },
    {
      version: 3,
      migrate: (db, transaction) => {
        // Add corruption recovery store
        if (!db.objectStoreNames.contains('recovery')) {
          db.createObjectStore('recovery', { keyPath: 'id', autoIncrement: true });
        }
        // Migrate existing data to include checksums
        if (db.objectStoreNames.contains('gifs')) {
          const gifsStore = transaction.objectStore('gifs');
          const request = gifsStore.openCursor();
          request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
              const gif = cursor.value;
              if (!gif.checksum) {
                gif.checksum = this.calculateChecksum(gif);
                cursor.update(gif);
              }
              cursor.continue();
            }
          };
        }
      }
    }
  ];

  constructor() {
    this.blobManager = new BlobManager(this.config.chunkSize);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    await this.initPromise;
    this.isInitialized = true;
  }

  private async performInitialization(): Promise<void> {
    try {
      await this.openDatabase();
      await this.blobManager.initialize();
      await this.verifyDatabaseIntegrity();
      await this.recoverFromCorruption();
    } catch (error) {
      console.error('Failed to initialize GifStore:', error);
      await this.handleInitializationFailure(error);
    }
  }

  private async openDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.currentVersion);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.setupEventHandlers();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;
        const oldVersion = event.oldVersion;

        this.performMigrations(db, transaction, oldVersion);
      };

      request.onblocked = () => {
        console.warn('Database upgrade blocked - please close other tabs');
      };
    });
  }

  private performMigrations(db: IDBDatabase, transaction: IDBTransaction, oldVersion: number): void {
    for (const migration of this.migrations) {
      if (migration.version > oldVersion) {
        try {
          migration.migrate(db, transaction, oldVersion);
          console.log(`Migrated to version ${migration.version}`);
        } catch (error) {
          console.error(`Migration to version ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.db) return;

    this.db.onerror = (event) => {
      console.error('Database error:', event);
      // Error events are not part of the StorageEvent type
      console.error('Database operation failed:', event);
    };

    this.db.onversionchange = () => {
      console.warn('Database version changed - closing connection');
      this.close();
    };
  }

  private async verifyDatabaseIntegrity(): Promise<boolean> {
    if (!this.db) return false;

    try {
      const transaction = this.db.transaction(['gifs', 'thumbnails', 'metadata'], 'readonly');
      const gifsStore = transaction.objectStore('gifs');
      const countRequest = gifsStore.count();

      return new Promise((resolve) => {
        countRequest.onsuccess = () => {
          resolve(true);
        };
        countRequest.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      console.error('Database integrity check failed:', error);
      return false;
    }
  }

  private async recoverFromCorruption(): Promise<void> {
    if (!this.db) return;

    const isIntact = await this.verifyDatabaseIntegrity();
    if (!isIntact) {
      console.warn('Database corruption detected - attempting recovery');
      await this.performRecovery();
    }
  }

  private async performRecovery(): Promise<void> {
    try {
      // Try to backup existing data
      const backup = await this.createBackup();
      
      // Close and delete corrupted database
      this.close();
      await this.deleteDatabase();
      
      // Recreate database
      await this.openDatabase();
      
      // Restore from backup
      if (backup.length > 0) {
        await this.restoreFromBackup(backup);
      }
      
      console.log('Database recovery completed successfully');
    } catch (error) {
      console.error('Database recovery failed:', error);
      throw new Error('Critical database failure - unable to recover');
    }
  }

  private async createBackup(): Promise<GifData[]> {
    if (!this.db) return [];

    try {
      const transaction = this.db.transaction(['gifs'], 'readonly');
      const store = transaction.objectStore('gifs');
      const request = store.getAll();

      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  private async deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  private async restoreFromBackup(backup: GifData[]): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['gifs', 'recovery'], 'readwrite');
    const gifsStore = transaction.objectStore('gifs');
    const recoveryStore = transaction.objectStore('recovery');

    for (const gif of backup) {
      try {
        await this.validateGifData(gif);
        gifsStore.add(gif);
      } catch (error) {
        // Log corrupted entry to recovery store
        recoveryStore.add({
          gifId: gif.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
          data: gif
        });
      }
    }
  }

  private async validateGifData(gif: GifData): Promise<void> {
    if (!gif.id || !gif.title || !gif.blob) {
      throw new Error('Invalid GIF data structure');
    }

    if (gif.blob.size === 0) {
      throw new Error('Empty blob data');
    }

    const expectedChecksum = this.calculateChecksum(gif);
    interface GifWithChecksum extends GifData {
      checksum?: string;
    }
    const gifWithChecksum = gif as GifWithChecksum;
    if (gifWithChecksum.checksum && gifWithChecksum.checksum !== expectedChecksum) {
      throw new Error('Checksum mismatch - data may be corrupted');
    }
  }

  private calculateChecksum(gif: GifData): string {
    const data = JSON.stringify({
      id: gif.id,
      title: gif.title,
      size: gif.blob.size,
      metadata: gif.metadata
    });
    
    // Simple checksum for demonstration - in production use crypto.subtle
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  private async handleInitializationFailure(error: unknown): Promise<void> {
    console.error('Attempting fallback initialization:', error);
    
    // Try to delete and recreate the database
    try {
      await this.deleteDatabase();
      await this.openDatabase();
      this.isInitialized = true;
    } catch (fallbackError) {
      console.error('Fallback initialization failed:', fallbackError);
      throw new Error('Unable to initialize storage system');
    }
  }

  async saveGif(gif: GifData): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    if (!this.db) throw new Error('Database not available');

    // Validate and process blob
    const processedBlob = await this.blobManager.processBlob(gif.blob);
    gif.blob = processedBlob;

    // Add checksum
    interface GifWithChecksum extends GifData {
      checksum: string;
    }
    (gif as GifWithChecksum).checksum = this.calculateChecksum(gif);

    return this.executeWithRetry(() => this.performSaveGif(gif));
  }

  private async performSaveGif(gif: GifData): Promise<void> {
    if (!this.db) throw new Error('Database not available');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs', 'thumbnails', 'metadata'], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        this.notifyListeners({ type: 'gif-added', data: gif });
        resolve();
      };

      // Save main GIF data
      const gifsStore = transaction.objectStore('gifs');
      gifsStore.add(gif);

      // Save thumbnail separately
      if (gif.thumbnailBlob) {
        const thumbnailsStore = transaction.objectStore('thumbnails');
        thumbnailsStore.add({
          gifId: gif.id,
          blob: gif.thumbnailBlob,
          createdAt: gif.metadata.createdAt
        });
      }

      // Save metadata for quick queries
      const metadataStore = transaction.objectStore('metadata');
      metadataStore.add({
        id: gif.id,
        title: gif.title,
        youtubeUrl: gif.metadata.youtubeUrl,
        lastModified: new Date(),
        fileSize: gif.metadata.fileSize,
        tags: gif.tags
      });
    });
  }

  async getGif(id: string): Promise<GifData | null> {
    if (!this.isInitialized) await this.initialize();
    if (!this.db) throw new Error('Database not available');

    return this.executeWithRetry(() => this.performGetGif(id));
  }

  private async performGetGif(id: string): Promise<GifData | null> {
    if (!this.db) throw new Error('Database not available');

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

        // Validate checksum
        try {
          this.validateGifData(gifData);
        } catch (error) {
          console.error('Data validation failed:', error);
          // Error events are not part of the StorageEvent type
          console.error('Corrupted data detected for GIF:', id);
        }

        // Attach thumbnail if exists
        if (thumbnailRequest.result) {
          gifData.thumbnailBlob = thumbnailRequest.result.blob;
        }

        resolve(gifData);
      };
    });
  }

  async deleteGif(id: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    if (!this.db) throw new Error('Database not available');

    return this.executeWithRetry(() => this.performDeleteGif(id));
  }

  private async performDeleteGif(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not available');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['gifs', 'thumbnails', 'metadata'], 'readwrite');
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        this.notifyListeners({ type: 'gif-deleted', data: { id } });
        resolve();
      };

      const gifsStore = transaction.objectStore('gifs');
      const thumbnailsStore = transaction.objectStore('thumbnails');
      const metadataStore = transaction.objectStore('metadata');
      
      gifsStore.delete(id);
      thumbnailsStore.delete(id);
      metadataStore.delete(id);
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < this.config.maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Operation failed (attempt ${i + 1}/${this.config.maxRetries}):`, error);
        
        if (i < this.config.maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (i + 1)));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  addEventListener(id: string, listener: StorageEventListener): void {
    this.listeners.set(id, listener);
  }

  removeEventListener(id: string): void {
    this.listeners.delete(id);
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
    this.isInitialized = false;
    this.initPromise = null;
  }

  async getAllMetadata(): Promise<GifMetadata[]> {
    if (!this.isInitialized) await this.initialize();
    if (!this.db) throw new Error('Database not available');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

export const gifStore = new GifStore();