import { databaseCleanup } from '@/shared/database-cleanup';

describe('databaseCleanup', () => {
  let mockDeleteRequest: any;
  let mockOpenRequest: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock requests
    mockDeleteRequest = {
      onsuccess: null as any,
      onerror: null as any,
      onblocked: null as any,
      error: null
    };

    mockOpenRequest = {
      onsuccess: null as any,
      onerror: null as any,
      result: {
        objectStoreNames: {
          contains: jest.fn().mockReturnValue(true)
        },
        close: jest.fn()
      }
    };
  });

  describe('deleteDatabase', () => {
    it('should delete YouTubeGifStore database successfully', async () => {
      global.indexedDB = {
        deleteDatabase: jest.fn().mockReturnValue(mockDeleteRequest)
      } as any;

      const promise = databaseCleanup.deleteDatabase();

      // Simulate successful deletion
      if (mockDeleteRequest.onsuccess) {
        mockDeleteRequest.onsuccess();
      }

      const result = await promise;

      expect(result).toBe(true);
      expect(indexedDB.deleteDatabase).toHaveBeenCalledWith('YouTubeGifStore');
    });

    it('should handle deletion error gracefully', async () => {
      mockDeleteRequest.error = { message: 'Deletion failed' };

      global.indexedDB = {
        deleteDatabase: jest.fn().mockReturnValue(mockDeleteRequest)
      } as any;

      const promise = databaseCleanup.deleteDatabase();

      // Simulate error
      if (mockDeleteRequest.onerror) {
        mockDeleteRequest.onerror();
      }

      const result = await promise;

      expect(result).toBe(false);
    });

    it('should handle blocked deletion', async () => {
      global.indexedDB = {
        deleteDatabase: jest.fn().mockReturnValue(mockDeleteRequest)
      } as any;

      const promise = databaseCleanup.deleteDatabase();

      // Simulate blocked (still resolves true as deletion is in progress)
      if (mockDeleteRequest.onblocked) {
        mockDeleteRequest.onblocked();
      }

      const result = await promise;

      expect(result).toBe(true);
    });

    it('should handle indexedDB not available', async () => {
      global.indexedDB = undefined as any;

      const result = await databaseCleanup.deleteDatabase();

      expect(result).toBe(true);
    });

    it('should handle exception during deletion', async () => {
      global.indexedDB = {
        deleteDatabase: jest.fn().mockImplementation(() => {
          throw new Error('Unexpected error');
        })
      } as any;

      const result = await databaseCleanup.deleteDatabase();

      expect(result).toBe(false);
    });
  });

  describe('databaseExists', () => {
    it('should return true when database exists with gifs store', async () => {
      global.indexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      } as any;

      const promise = databaseCleanup.databaseExists();

      // Simulate successful open
      if (mockOpenRequest.onsuccess) {
        mockOpenRequest.onsuccess();
      }

      const result = await promise;

      expect(result).toBe(true);
      expect(mockOpenRequest.result.objectStoreNames.contains).toHaveBeenCalledWith('gifs');
      expect(mockOpenRequest.result.close).toHaveBeenCalled();
    });

    it('should return false when database exists without gifs store', async () => {
      mockOpenRequest.result.objectStoreNames.contains = jest.fn().mockReturnValue(false);

      global.indexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      } as any;

      const promise = databaseCleanup.databaseExists();

      // Simulate successful open
      if (mockOpenRequest.onsuccess) {
        mockOpenRequest.onsuccess();
      }

      const result = await promise;

      expect(result).toBe(false);
    });

    it('should return false when database open fails', async () => {
      global.indexedDB = {
        open: jest.fn().mockReturnValue(mockOpenRequest)
      } as any;

      const promise = databaseCleanup.databaseExists();

      // Simulate error
      if (mockOpenRequest.onerror) {
        mockOpenRequest.onerror();
      }

      const result = await promise;

      expect(result).toBe(false);
    });

    it('should return false when indexedDB not available', async () => {
      global.indexedDB = undefined as any;

      const result = await databaseCleanup.databaseExists();

      expect(result).toBe(false);
    });

    it('should handle exception during check', async () => {
      global.indexedDB = {
        open: jest.fn().mockImplementation(() => {
          throw new Error('Unexpected error');
        })
      } as any;

      const result = await databaseCleanup.databaseExists();

      expect(result).toBe(false);
    });
  });
});
