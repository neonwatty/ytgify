/**
 * GIF Database Tests
 * 
 * Comprehensive tests for IndexedDB-based GIF storage functionality,
 * including blob storage, search capabilities, and performance testing.
 */

import { GifDatabase } from '../../../src/storage/database';
import { GifData, GifMetadata } from '../../../src/types/storage';

// Mock IndexedDB for testing
const mockIDBDatabase = {
  createObjectStore: jest.fn(),
  transaction: jest.fn(),
  close: jest.fn(),
  objectStoreNames: {
    contains: jest.fn()
  }
};

const mockIDBObjectStore = {
  createIndex: jest.fn(),
  add: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  index: jest.fn(),
  openCursor: jest.fn()
};

const mockIDBTransaction = {
  objectStore: jest.fn(() => mockIDBObjectStore),
  oncomplete: null as unknown,
  onerror: null as unknown,
  error: null
};

const mockIDBRequest = {
  result: null as unknown,
  error: null as unknown,
  onsuccess: null as unknown,
  onerror: null as unknown,
  onupgradeneeded: null as unknown
};

// mockIDBCursor definition removed - not currently used but available if needed

// Mock IndexedDB global
const mockIndexedDB = {
  open: jest.fn(() => mockIDBRequest)
};

// Setup global mocks
(global as unknown as { indexedDB: unknown }).indexedDB = mockIndexedDB;
(global as unknown as { IDBDatabase: unknown }).IDBDatabase = jest.fn();
(global as unknown as { IDBObjectStore: unknown }).IDBObjectStore = jest.fn();
(global as unknown as { IDBTransaction: unknown }).IDBTransaction = jest.fn();
(global as unknown as { IDBRequest: unknown }).IDBRequest = jest.fn();
(global as unknown as { IDBCursor: unknown }).IDBCursor = jest.fn();

describe('GIF Database', () => {
  let gifDatabase: GifDatabase;
  let mockGifData: GifData;
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Save original navigator
    originalNavigator = (global as typeof globalThis & { navigator: typeof navigator }).navigator;
    
    // Setup default navigator mock
    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          estimate: jest.fn().mockResolvedValue({
            usage: 1024 * 1024, // 1MB default
            quota: 1024 * 1024 * 100 // 100MB default
          })
        }
      },
      writable: true,
      configurable: true
    });
    
    gifDatabase = new GifDatabase();
    
    // Create mock GIF data
    mockGifData = {
      id: 'test-gif-123',
      title: 'Test GIF',
      description: 'A test GIF for unit testing',
      blob: new Blob(['test gif data'], { type: 'image/gif' }),
      thumbnailBlob: new Blob(['test thumbnail'], { type: 'image/png' }),
      metadata: {
        width: 480,
        height: 360,
        duration: 3.5,
        frameRate: 15,
        fileSize: 1024 * 500, // 500KB
        createdAt: new Date('2024-01-01'),
        youtubeUrl: 'https://youtube.com/watch?v=test123',
        startTime: 10.5,
        endTime: 14.0
      },
      tags: ['funny', 'test', 'animation']
    };

    // Setup default mock behaviors
    mockIndexedDB.open.mockReturnValue(mockIDBRequest);
    mockIDBDatabase.createObjectStore.mockReturnValue(mockIDBObjectStore);
    mockIDBDatabase.transaction.mockReturnValue(mockIDBTransaction);
    mockIDBDatabase.objectStoreNames.contains.mockReturnValue(false);
  });

  describe('Initialization', () => {
    it('should initialize database with correct schema', async () => {
      // Setup successful initialization
      mockIDBRequest.onsuccess = null;
      mockIDBRequest.onupgradeneeded = null;
      
      const initPromise = gifDatabase.initialize();
      
      // Simulate successful database opening
      mockIDBRequest.result = mockIDBDatabase;
      if (mockIDBRequest.onsuccess) {
        (mockIDBRequest.onsuccess as () => void)();
      }
      
      await initPromise;
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('YouTubeGifMaker', 1);
    });

    it('should create object stores during upgrade', async () => {
      const initPromise = gifDatabase.initialize();
      
      // Simulate upgrade needed
      mockIDBRequest.result = mockIDBDatabase;
      if (mockIDBRequest.onupgradeneeded) {
        (mockIDBRequest.onupgradeneeded as (event: IDBVersionChangeEvent) => void)({ 
          target: { result: mockIDBDatabase } 
        } as unknown as IDBVersionChangeEvent);
      }
      
      if (mockIDBRequest.onsuccess) {
        (mockIDBRequest.onsuccess as () => void)();
      }
      
      await initPromise;
      
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('gifs', { keyPath: 'id' });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('thumbnails', { keyPath: 'gifId' });
      expect(mockIDBObjectStore.createIndex).toHaveBeenCalledWith('createdAt', 'metadata.createdAt', { unique: false });
      expect(mockIDBObjectStore.createIndex).toHaveBeenCalledWith('tags', 'tags', { unique: false, multiEntry: true });
    });

    it('should handle initialization errors', async () => {
      const initPromise = gifDatabase.initialize();
      
      // Simulate error
      mockIDBRequest.error = new Error('Database error');
      if (mockIDBRequest.onerror) {
        (mockIDBRequest.onerror as () => void)();
      }
      
      await expect(initPromise).rejects.toThrow('Failed to open database: Database error');
    });
  });

  describe('GIF Storage Operations', () => {
    beforeEach(async () => {
      // Mock successful initialization
      const initPromise = gifDatabase.initialize();
      mockIDBRequest.result = mockIDBDatabase;
      if (mockIDBRequest.onsuccess) {
        (mockIDBRequest.onsuccess as () => void)();
      }
      await initPromise;
    });

    it('should save GIF with blob data', async () => {
      // Mock storage quota check
      const mockNavigator = {
        storage: {
          estimate: jest.fn().mockResolvedValue({
            usage: 1024 * 1024, // 1MB used
            quota: 1024 * 1024 * 100 // 100MB quota
          })
        }
      };
      (global as unknown as { navigator: unknown }).navigator = mockNavigator;

      // Setup transaction to complete immediately
      mockIDBDatabase.transaction.mockImplementation(() => {
        // Immediately call oncomplete after transaction is created
        setTimeout(() => {
          if (mockIDBTransaction.oncomplete) {
            (mockIDBTransaction.oncomplete as () => void)();
          }
        }, 0);
        return mockIDBTransaction;
      });

      await gifDatabase.saveGif(mockGifData);
      
      expect(mockIDBDatabase.transaction).toHaveBeenCalledWith(['gifs', 'thumbnails'], 'readwrite');
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(mockGifData);
    });

    it('should handle insufficient storage space', async () => {
      // Mock getStorageQuota directly to return low available space
      jest.spyOn(gifDatabase, 'getStorageQuota').mockResolvedValue({
        used: 1024 * 1024 * 99, // 99MB used
        total: 1024 * 1024 * 100, // 100MB quota
        available: 1024 * 1024 // Only 1MB available, less than our 500KB gif
      });

      // Since our mockGifData.metadata.fileSize is 500KB but we change it to 2MB
      const largeGifData = {
        ...mockGifData,
        metadata: {
          ...mockGifData.metadata,
          fileSize: 1024 * 1024 * 2 // 2MB file, larger than 1MB available
        }
      };

      // The saveGif should reject immediately due to insufficient space
      await expect(gifDatabase.saveGif(largeGifData)).rejects.toThrow('Insufficient storage space');
    }, 10000);

    it('should retrieve GIF with thumbnail', async () => {
      // Create a copy without the thumbnailBlob for the database storage
      const storedGif = { 
        ...mockGifData,
        thumbnailBlob: undefined // In real DB, thumbnail is stored separately
      };
      
      // Mock the thumbnail stored separately
      const mockThumbnailResult = { 
        gifId: mockGifData.id, 
        blob: new Blob(['test thumbnail'], { type: 'image/png' }) 
      };

      // Mock different requests for gif and thumbnail
      const gifRequest = { result: storedGif };
      const thumbnailRequest = { result: mockThumbnailResult };

      let getCallCount = 0;
      mockIDBObjectStore.get.mockImplementation((_id: string) => {
        getCallCount++;
        // First call gets the GIF, second call gets the thumbnail
        return getCallCount === 1 ? gifRequest : thumbnailRequest;
      });

      // Setup transaction to complete immediately
      mockIDBDatabase.transaction.mockImplementation(() => {
        setTimeout(() => {
          if (mockIDBTransaction.oncomplete) {
            (mockIDBTransaction.oncomplete as () => void)();
          }
        }, 0);
        return mockIDBTransaction;
      });

      const result = await gifDatabase.getGif(mockGifData.id);
      
      // Result should have the thumbnail blob attached from the separate store
      expect(result).toEqual({
        ...storedGif,
        thumbnailBlob: mockThumbnailResult.blob
      });
      expect(mockIDBObjectStore.get).toHaveBeenCalledWith(mockGifData.id);
      expect(mockIDBObjectStore.get).toHaveBeenCalledTimes(2);
    });

    it('should return null for non-existent GIF', async () => {
      mockIDBObjectStore.get.mockReturnValue({
        result: null,
        onsuccess: null,
        onerror: null
      });

      const getPromise = gifDatabase.getGif('non-existent-id');
      
      if (mockIDBTransaction.oncomplete) {
        (mockIDBTransaction.oncomplete as () => void)();
      }
      
      const result = await getPromise;
      
      expect(result).toBeNull();
    });

    it('should delete GIF and thumbnail', async () => {
      const deletePromise = gifDatabase.deleteGif(mockGifData.id);
      
      if (mockIDBTransaction.oncomplete) {
        (mockIDBTransaction.oncomplete as () => void)();
      }
      
      await deletePromise;
      
      expect(mockIDBObjectStore.delete).toHaveBeenCalledWith(mockGifData.id);
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(async () => {
      const initPromise = gifDatabase.initialize();
      mockIDBRequest.result = mockIDBDatabase;
      if (mockIDBRequest.onsuccess) {
        (mockIDBRequest.onsuccess as () => void)();
      }
      await initPromise;
    });

    it('should retrieve all GIFs sorted by creation date', async () => {
      // Create a mock cursor request
      const mockCursorRequest = {
        result: null as IDBCursorWithValue | null,
        onsuccess: null as ((this: IDBRequest) => void) | null,
        onerror: null as ((this: IDBRequest) => void) | null
      };

      mockIDBObjectStore.index.mockReturnValue({
        openCursor: jest.fn().mockReturnValue(mockCursorRequest)
      });

      // Start the getAllGifs operation
      const gifsPromise = gifDatabase.getAllGifs();

      // Simulate cursor iteration
      
      // Wait a tick for the promise to register handlers
      await new Promise(resolve => setTimeout(resolve, 0));

      // Create a proper mock cursor
      const mockCursor = {
        value: mockGifData,
        continue: jest.fn(() => {
          // Second call - return null to end iteration
          mockCursorRequest.result = null;
          if (mockCursorRequest.onsuccess) {
            (mockCursorRequest.onsuccess as () => void)();
          }
        }),
        // Add required IDBCursor properties
        direction: 'next' as IDBCursorDirection,
        key: mockGifData.id,
        primaryKey: mockGifData.id,
        request: mockCursorRequest as unknown as IDBRequest<IDBCursor>,
        source: mockIDBObjectStore.index('createdAt') as IDBIndex,
        advance: jest.fn(),
        continuePrimaryKey: jest.fn(),
        delete: jest.fn(),
        update: jest.fn()
      } as unknown as IDBCursorWithValue;

      // First call - return a cursor with data
      mockCursorRequest.result = mockCursor;

      // Trigger the first success callback
      if (mockCursorRequest.onsuccess) {
        (mockCursorRequest.onsuccess as () => void)();
      }

      const result = await gifsPromise;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockGifData.id);
      expect(result[0].title).toBe(mockGifData.title);
    });

    it('should search GIFs by title', async () => {
      // Mock getAllGifs to return test data
      const mockMetadata: GifMetadata = {
        id: mockGifData.id,
        title: mockGifData.title,
        description: mockGifData.description,
        width: mockGifData.metadata.width,
        height: mockGifData.metadata.height,
        duration: mockGifData.metadata.duration,
        frameRate: mockGifData.metadata.frameRate,
        fileSize: mockGifData.metadata.fileSize,
        createdAt: mockGifData.metadata.createdAt,
        youtubeUrl: mockGifData.metadata.youtubeUrl,
        startTime: mockGifData.metadata.startTime,
        endTime: mockGifData.metadata.endTime,
        tags: mockGifData.tags
      };

      // Mock the getAllGifs method to return our test data
      jest.spyOn(gifDatabase, 'getAllGifs').mockResolvedValue([mockMetadata]);

      const results = await gifDatabase.searchGifs('test');
      
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Test');
    });

    it('should search GIFs by tags', async () => {
      const mockMetadata: GifMetadata = {
        id: mockGifData.id,
        title: mockGifData.title,
        description: mockGifData.description,
        width: mockGifData.metadata.width,
        height: mockGifData.metadata.height,
        duration: mockGifData.metadata.duration,
        frameRate: mockGifData.metadata.frameRate,
        fileSize: mockGifData.metadata.fileSize,
        createdAt: mockGifData.metadata.createdAt,
        youtubeUrl: mockGifData.metadata.youtubeUrl,
        startTime: mockGifData.metadata.startTime,
        endTime: mockGifData.metadata.endTime,
        tags: mockGifData.tags
      };

      jest.spyOn(gifDatabase, 'getAllGifs').mockResolvedValue([mockMetadata]);

      const results = await gifDatabase.searchGifs('funny');
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('funny');
    });

    it('should get GIFs by specific tag', async () => {
      mockIDBObjectStore.index.mockReturnValue({
        getAll: jest.fn().mockReturnValue({
          result: [mockGifData],
          onsuccess: null,
          onerror: null
        })
      });

      const getByTagPromise = gifDatabase.getGifsByTag('funny');
      
      // Simulate successful request
      const getAllRequest = mockIDBObjectStore.index().getAll();
      if (getAllRequest.onsuccess) {
        (getAllRequest.onsuccess as () => void)();
      }
      
      const results = await getByTagPromise;
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('funny');
    });
  });

  describe('Storage Management', () => {
    beforeEach(async () => {
      const initPromise = gifDatabase.initialize();
      mockIDBRequest.result = mockIDBDatabase;
      if (mockIDBRequest.onsuccess) {
        (mockIDBRequest.onsuccess as () => void)();
      }
      await initPromise;
    });

    it('should get storage quota information', async () => {
      // Override the default mock with specific values
      Object.defineProperty(global, 'navigator', {
        value: {
          storage: {
            estimate: jest.fn().mockResolvedValue({
              usage: 1024 * 1024 * 50, // 50MB used
              quota: 1024 * 1024 * 100 // 100MB quota
            })
          }
        },
        writable: true,
        configurable: true
      });

      const quota = await gifDatabase.getStorageQuota();
      
      expect(quota.used).toBe(1024 * 1024 * 50);
      expect(quota.total).toBe(1024 * 1024 * 100);
      expect(quota.available).toBe(1024 * 1024 * 50);
    });

    it('should handle storage estimate fallback', async () => {
      // Remove storage.estimate to test fallback
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
        configurable: true
      });

      const quota = await gifDatabase.getStorageQuota();
      
      expect(quota.used).toBe(0);
      expect(quota.total).toBe(500 * 1024 * 1024); // Default 500MB
      expect(quota.available).toBe(500 * 1024 * 1024);
    });

    it('should cleanup old GIFs', async () => {
      const oldGif: GifMetadata = {
        ...mockGifData.metadata,
        id: 'old-gif',
        title: 'Old GIF',
        tags: [],
        createdAt: new Date('2023-01-01') // Old date
      };

      const newGif: GifMetadata = {
        ...mockGifData.metadata,
        id: 'new-gif',
        title: 'New GIF',
        tags: [],
        createdAt: new Date() // Current date
      };

      jest.spyOn(gifDatabase, 'getAllGifs').mockResolvedValue([oldGif, newGif]);
      jest.spyOn(gifDatabase, 'deleteGif').mockResolvedValue(undefined);

      const deletedCount = await gifDatabase.cleanup(30);
      
      expect(deletedCount).toBe(1);
      expect(gifDatabase.deleteGif).toHaveBeenCalledWith('old-gif');
    });
  });

  describe('Event System', () => {
    it('should add and notify event listeners', () => {
      const listener = jest.fn();
      
      gifDatabase.addEventListener(listener);
      
      // Trigger internal event notification (we'll need to access private method)
      const event = { type: 'gif-added' as const, data: mockGifData };
      (gifDatabase as unknown as { notifyListeners: (event: unknown) => void }).notifyListeners(event);
      
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();
      
      gifDatabase.addEventListener(listener);
      gifDatabase.removeEventListener(listener);
      
      const event = { type: 'gif-added' as const, data: mockGifData };
      (gifDatabase as unknown as { notifyListeners: (event: unknown) => void }).notifyListeners(event);
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      gifDatabase.addEventListener(errorListener);
      
      const event = { type: 'gif-added' as const, data: mockGifData };
      (gifDatabase as unknown as { notifyListeners: (event: unknown) => void }).notifyListeners(event);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in storage event listener:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Database Lifecycle', () => {
    it('should close database connection', async () => {
      // Initialize first
      const initPromise = gifDatabase.initialize();
      mockIDBRequest.result = mockIDBDatabase;
      if (mockIDBRequest.onsuccess) {
        (mockIDBRequest.onsuccess as () => void)();
      }
      await initPromise;
      
      await gifDatabase.close();
      
      expect(mockIDBDatabase.close).toHaveBeenCalled();
    });

    it('should throw error when database not initialized', async () => {
      const newDatabase = new GifDatabase();
      
      await expect(newDatabase.saveGif(mockGifData)).rejects.toThrow('Database not initialized');
      await expect(newDatabase.getGif('test')).rejects.toThrow('Database not initialized');
      await expect(newDatabase.getAllGifs()).rejects.toThrow('Database not initialized');
      await expect(newDatabase.deleteGif('test')).rejects.toThrow('Database not initialized');
    });
  });

  afterEach(() => {
    // Restore original navigator
    if (originalNavigator) {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true
      });
    }
  });
});