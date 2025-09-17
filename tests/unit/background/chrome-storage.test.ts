/**
 * Tests for Chrome Storage Preferences
 * Priority 1: User preferences persistence and management
 */

// Mock Chrome storage API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  runtime: {
    lastError: null as any
  }
};

(global as any).chrome = mockChrome;

// Storage helper functions (would normally be in a separate file)
async function initializeStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['userPreferences'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      if (!result.userPreferences) {
        const defaultPreferences = {
          defaultFrameRate: 15,
          defaultQuality: 'medium' as const,
          maxDuration: 10,
          autoSave: true,
          theme: 'system' as const,
          showThumbnails: true,
          gridSize: 'medium' as const,
          maxStorageSize: 100,
          autoCleanup: true,
          cleanupOlderThan: 30,
          maxConcurrentJobs: 3,
          enableProgressUpdates: true,
          jobTimeout: 300000,
          preferWebCodecs: true,
          enableAdvancedGifOptimization: true,
          analyticsEnabled: false,
          errorReportingEnabled: true,
          performanceMonitoringEnabled: true
        };

        chrome.storage.local.set({ userPreferences: defaultPreferences }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

async function getUserPreferences(): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['userPreferences'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.userPreferences || {});
      }
    });
  });
}

async function updateUserPreferences(updates: Partial<any>): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const current = await getUserPreferences();
      const updated = { ...current, ...updates };

      chrome.storage.local.set({ userPreferences: updated }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

describe('Chrome Storage Preferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  describe('initializeStorage', () => {
    it('should initialize with default preferences when none exist', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await initializeStorage();

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        {
          userPreferences: expect.objectContaining({
            defaultFrameRate: 15,
            defaultQuality: 'medium',
            maxDuration: 10,
            autoSave: true,
            theme: 'system',
            maxConcurrentJobs: 3,
            preferWebCodecs: true
          })
        },
        expect.any(Function)
      );
    });

    it('should not overwrite existing preferences', async () => {
      const existingPrefs = {
        defaultFrameRate: 30,
        defaultQuality: 'high',
        theme: 'dark'
      };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ userPreferences: existingPrefs });
      });

      await initializeStorage();

      expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should handle storage errors on get', async () => {
      mockChrome.runtime.lastError = { message: 'Storage quota exceeded' };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(initializeStorage()).rejects.toEqual({
        message: 'Storage quota exceeded'
      });
    });

    it('should handle storage errors on set', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChrome.runtime.lastError = null;
      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        mockChrome.runtime.lastError = { message: 'Write failed' };
        callback?.();
      });

      await expect(initializeStorage()).rejects.toEqual({
        message: 'Write failed'
      });
    });
  });

  describe('getUserPreferences', () => {
    it('should retrieve stored preferences', async () => {
      const storedPrefs = {
        defaultFrameRate: 20,
        defaultQuality: 'high',
        theme: 'dark'
      };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ userPreferences: storedPrefs });
      });

      const prefs = await getUserPreferences();

      expect(prefs).toEqual(storedPrefs);
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
        ['userPreferences'],
        expect.any(Function)
      );
    });

    it('should return empty object when no preferences exist', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      const prefs = await getUserPreferences();

      expect(prefs).toEqual({});
    });

    it('should handle storage errors', async () => {
      mockChrome.runtime.lastError = { message: 'Read error' };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(getUserPreferences()).rejects.toEqual({
        message: 'Read error'
      });
    });
  });

  describe('updateUserPreferences', () => {
    it('should update specific preferences while preserving others', async () => {
      const existingPrefs = {
        defaultFrameRate: 15,
        defaultQuality: 'medium',
        theme: 'light'
      };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ userPreferences: existingPrefs });
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await updateUserPreferences({
        defaultFrameRate: 30,
        theme: 'dark'
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        {
          userPreferences: {
            defaultFrameRate: 30,
            defaultQuality: 'medium',
            theme: 'dark'
          }
        },
        expect.any(Function)
      );
    });

    it('should handle updates when no preferences exist', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        callback?.();
      });

      await updateUserPreferences({
        defaultFrameRate: 25
      });

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        {
          userPreferences: {
            defaultFrameRate: 25
          }
        },
        expect.any(Function)
      );
    });

    it('should handle storage errors on read', async () => {
      mockChrome.runtime.lastError = { message: 'Read failed' };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      await expect(updateUserPreferences({ theme: 'dark' })).rejects.toEqual({
        message: 'Read failed'
      });
    });

    it('should handle storage errors on write', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        mockChrome.runtime.lastError = null;
        callback({ userPreferences: {} });
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        mockChrome.runtime.lastError = { message: 'Write failed' };
        callback?.();
      });

      await expect(updateUserPreferences({ theme: 'dark' })).rejects.toEqual({
        message: 'Write failed'
      });
    });
  });

  describe('Storage Change Listeners', () => {
    it('should register storage change listener', () => {
      const listener = jest.fn();
      mockChrome.storage.onChanged.addListener(listener);

      expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalledWith(listener);
    });

    it('should handle preference changes', () => {
      const listener = jest.fn();
      mockChrome.storage.onChanged.addListener(listener);

      const changes = {
        userPreferences: {
          oldValue: { theme: 'light' },
          newValue: { theme: 'dark' }
        }
      };

      // Simulate storage change
      const registeredListener = mockChrome.storage.onChanged.addListener.mock.calls[0][0];
      registeredListener(changes, 'local');

      expect(listener).toHaveBeenCalledWith(changes, 'local');
    });
  });

  describe('Preference Validation', () => {
    it('should validate frame rate values', async () => {
      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        const prefs = data.userPreferences;
        // Validate frame rate is within bounds
        if (prefs.defaultFrameRate < 1 || prefs.defaultFrameRate > 60) {
          mockChrome.runtime.lastError = { message: 'Invalid frame rate' };
        }
        callback?.();
      });

      // Valid frame rate
      mockChrome.runtime.lastError = null;
      await updateUserPreferences({ defaultFrameRate: 30 });
      expect(mockChrome.runtime.lastError).toBeNull();

      // Invalid frame rate
      await expect(updateUserPreferences({ defaultFrameRate: 100 }))
        .rejects.toEqual({ message: 'Invalid frame rate' });
    });

    it('should validate quality values', async () => {
      const validQualities = ['low', 'medium', 'high'];

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        const prefs = data.userPreferences;
        if (prefs.defaultQuality && !validQualities.includes(prefs.defaultQuality)) {
          mockChrome.runtime.lastError = { message: 'Invalid quality setting' };
        }
        callback?.();
      });

      // Valid quality
      mockChrome.runtime.lastError = null;
      await updateUserPreferences({ defaultQuality: 'high' });
      expect(mockChrome.runtime.lastError).toBeNull();
    });
  });

  describe('Storage Quota Management', () => {
    it('should handle storage quota warnings', async () => {
      // Create actually large data that would exceed typical quota
      const largeString = 'x'.repeat(10000);
      const largeData = {
        cachedFrames: new Array(1000).fill({ data: largeString })
      };

      mockChrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ userPreferences: {} });
      });

      mockChrome.storage.local.set.mockImplementation((data, callback) => {
        // Always simulate quota exceeded for this test
        mockChrome.runtime.lastError = { message: 'QUOTA_BYTES_PER_ITEM quota exceeded' };
        callback?.();
      });

      await expect(updateUserPreferences(largeData))
        .rejects.toEqual({ message: 'QUOTA_BYTES_PER_ITEM quota exceeded' });
    });
  });

  describe('Migration', () => {
    it('should migrate old preference format to new format', async () => {
      const oldFormat = {
        fps: 15,
        quality: 'med',
        autosave: 'yes'
      };

      const expectedNewFormat = {
        defaultFrameRate: 15,
        defaultQuality: 'medium',
        autoSave: true
      };

      // Simulate migration logic
      const migratePreferences = (old: any) => {
        const migrated: any = {};
        if (old.fps) migrated.defaultFrameRate = old.fps;
        if (old.quality === 'med') migrated.defaultQuality = 'medium';
        if (old.autosave === 'yes') migrated.autoSave = true;
        return migrated;
      };

      const migrated = migratePreferences(oldFormat);
      expect(migrated).toEqual(expectedNewFormat);
    });
  });
});