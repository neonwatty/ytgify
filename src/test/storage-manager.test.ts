/**
 * Storage Manager Integration Tests
 * 
 * Comprehensive tests for the unified storage manager, including 
 * performance testing, quota management, and integration between
 * IndexedDB and Chrome storage systems.
 */

import { StorageManager } from '../storage/index';
import { GifData, UserPreferences, StorageQuota } from '../types/storage';
// Storage manager integration tests

// Mock the individual storage components
jest.mock('../storage/database');
jest.mock('../storage/chrome-storage');

import { gifDatabase } from '../storage/database';
import { chromeStorageManager } from '../storage/chrome-storage';

// Type the mocked modules
const mockGifDatabase = gifDatabase as jest.Mocked<typeof gifDatabase>;
const mockChromeStorageManager = chromeStorageManager as jest.Mocked<typeof chromeStorageManager>;

describe('Storage Manager Integration', () => {
  let storageManager: StorageManager;
  let mockGifData: GifData;
  let mockPreferences: UserPreferences;

  beforeEach(() => {
    jest.clearAllMocks();
    storageManager = new StorageManager();
    
    // Mock GIF data
    mockGifData = {
      id: 'test-gif-123',
      title: 'Test GIF',
      description: 'A test GIF',
      blob: new Blob(['test gif data'], { type: 'image/gif' }),
      thumbnailBlob: new Blob(['test thumbnail'], { type: 'image/png' }),
      metadata: {
        width: 480,
        height: 360,
        duration: 3.5,
        frameRate: 15,
        fileSize: 1024 * 500, // 500KB
        createdAt: new Date(),
        youtubeUrl: 'https://youtube.com/watch?v=test123',
        startTime: 10.5,
        endTime: 14.0
      },
      tags: ['test', 'animation']
    };

    // Mock preferences
    mockPreferences = {
      defaultFrameRate: 15,
      defaultQuality: 80,
      maxDuration: 10,
      autoSave: true,
      theme: 'system',
      showThumbnails: true,
      gridSize: 'medium',
      maxStorageSize: 500,
      autoCleanup: false,
      cleanupOlderThan: 30
    };

    // Setup default mock behaviors
    mockGifDatabase.initialize.mockResolvedValue();
    mockGifDatabase.saveGif.mockResolvedValue();
    mockGifDatabase.getGif.mockResolvedValue(mockGifData);
    mockGifDatabase.getAllGifs.mockResolvedValue([]);
    mockGifDatabase.searchGifs.mockResolvedValue([]);
    mockGifDatabase.getGifsByTag.mockResolvedValue([]);
    mockGifDatabase.deleteGif.mockResolvedValue();
    mockGifDatabase.cleanup.mockResolvedValue(0);
    mockGifDatabase.getStorageQuota.mockResolvedValue({
      used: 1024 * 1024 * 50,
      total: 1024 * 1024 * 500,
      available: 1024 * 1024 * 450
    });
    
    mockChromeStorageManager.getPreferences.mockResolvedValue(mockPreferences);
    mockChromeStorageManager.savePreferences.mockResolvedValue();
    mockChromeStorageManager.updatePreference.mockResolvedValue();
    mockChromeStorageManager.resetPreferences.mockResolvedValue();
  });

  describe('Initialization', () => {
    it('should initialize storage manager successfully', async () => {
      await storageManager.initialize();
      
      expect(mockGifDatabase.initialize).toHaveBeenCalled();
    });

    it('should handle initialization failures', async () => {
      mockGifDatabase.initialize.mockRejectedValue(new Error('Init failed'));
      
      await expect(storageManager.initialize()).rejects.toThrow('Init failed');
    });

    it('should not initialize twice', async () => {
      await storageManager.initialize();
      await storageManager.initialize();
      
      expect(mockGifDatabase.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIF Operations', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should save GIF through storage manager', async () => {
      await storageManager.saveGif(mockGifData);
      
      expect(mockGifDatabase.saveGif).toHaveBeenCalledWith(mockGifData);
    });

    it('should retrieve GIF through storage manager', async () => {
      const result = await storageManager.getGif('test-id');
      
      expect(mockGifDatabase.getGif).toHaveBeenCalledWith('test-id');
      expect(result).toBe(mockGifData);
    });

    it('should get all GIFs through storage manager', async () => {
      await storageManager.getAllGifs();
      
      expect(mockGifDatabase.getAllGifs).toHaveBeenCalled();
    });

    it('should search GIFs through storage manager', async () => {
      await storageManager.searchGifs('test query');
      
      expect(mockGifDatabase.searchGifs).toHaveBeenCalledWith('test query');
    });

    it('should get GIFs by tag through storage manager', async () => {
      await storageManager.getGifsByTag('animation');
      
      expect(mockGifDatabase.getGifsByTag).toHaveBeenCalledWith('animation');
    });

    it('should delete GIF through storage manager', async () => {
      await storageManager.deleteGif('test-id');
      
      expect(mockGifDatabase.deleteGif).toHaveBeenCalledWith('test-id');
    });

    it('should throw error when not initialized', async () => {
      const uninitializedManager = new StorageManager();
      
      await expect(uninitializedManager.saveGif(mockGifData)).rejects.toThrow('Storage manager not initialized');
      await expect(uninitializedManager.getGif('test')).rejects.toThrow('Storage manager not initialized');
    });
  });

  describe('Preferences Management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should get preferences through storage manager', async () => {
      const result = await storageManager.getPreferences();
      
      expect(mockChromeStorageManager.getPreferences).toHaveBeenCalled();
      expect(result).toBe(mockPreferences);
    });

    it('should save preferences through storage manager', async () => {
      const updates = { theme: 'dark' as const };
      await storageManager.savePreferences(updates);
      
      expect(mockChromeStorageManager.savePreferences).toHaveBeenCalledWith(updates);
    });

    it('should update single preference', async () => {
      await storageManager.updatePreference('theme', 'dark');
      
      expect(mockChromeStorageManager.updatePreference).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should reset preferences', async () => {
      await storageManager.resetPreferences();
      
      expect(mockChromeStorageManager.resetPreferences).toHaveBeenCalled();
    });

    it('should get theme convenience method', async () => {
      mockChromeStorageManager.getTheme = jest.fn().mockResolvedValue('dark');
      
      const theme = await storageManager.getTheme();
      
      expect(theme).toBe('dark');
    });

    it('should set theme convenience method', async () => {
      mockChromeStorageManager.setTheme = jest.fn().mockResolvedValue(undefined);
      
      await storageManager.setTheme('light');
      
      expect(mockChromeStorageManager.setTheme).toHaveBeenCalledWith('light');
    });
  });

  describe('Storage Management', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should get storage quota', async () => {
      const quota = await storageManager.getStorageQuota();
      
      expect(mockGifDatabase.getStorageQuota).toHaveBeenCalled();
      expect(quota).toEqual({
        used: 1024 * 1024 * 50,
        total: 1024 * 1024 * 500,
        available: 1024 * 1024 * 450
      });
    });

    it('should cleanup old GIFs with custom days', async () => {
      mockGifDatabase.cleanup.mockResolvedValue(5);
      
      const deletedCount = await storageManager.cleanupOldGifs(15);
      
      expect(mockGifDatabase.cleanup).toHaveBeenCalledWith(15);
      expect(deletedCount).toBe(5);
    });

    it('should cleanup old GIFs with preference days', async () => {
      mockGifDatabase.cleanup.mockResolvedValue(3);
      
      const deletedCount = await storageManager.cleanupOldGifs();
      
      expect(mockChromeStorageManager.getPreferences).toHaveBeenCalled();
      expect(mockGifDatabase.cleanup).toHaveBeenCalledWith(30);
      expect(deletedCount).toBe(3);
    });

    it('should perform maintenance when auto-cleanup enabled', async () => {
      mockPreferences.autoCleanup = true;
      mockGifDatabase.cleanup.mockResolvedValue(2);
      
      const quotaBefore: StorageQuota = { used: 1000, total: 5000, available: 4000 };
      const quotaAfter: StorageQuota = { used: 800, total: 5000, available: 4200 };
      
      mockGifDatabase.getStorageQuota
        .mockResolvedValueOnce(quotaBefore)
        .mockResolvedValueOnce(quotaAfter);
      
      const result = await storageManager.performMaintenance();
      
      expect(result.quotaBefore).toEqual(quotaBefore);
      expect(result.quotaAfter).toEqual(quotaAfter);
      expect(result.gifsDeleted).toBe(2);
      expect(mockGifDatabase.cleanup).toHaveBeenCalled();
    });

    it('should skip cleanup when auto-cleanup disabled', async () => {
      mockPreferences.autoCleanup = false;
      
      const quota: StorageQuota = { used: 1000, total: 5000, available: 4000 };
      mockGifDatabase.getStorageQuota.mockResolvedValue(quota);
      
      const result = await storageManager.performMaintenance();
      
      expect(result.gifsDeleted).toBe(0);
      expect(mockGifDatabase.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('Storage Health Monitoring', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should detect high storage usage', async () => {
      mockGifDatabase.getStorageQuota.mockResolvedValue({
        used: 1024 * 1024 * 451, // > 90% usage
        total: 1024 * 1024 * 500,
        available: 1024 * 1024 * 49
      });
      
      mockGifDatabase.getAllGifs.mockResolvedValue([]);
      
      const health = await storageManager.checkStorageHealth();
      
      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Storage usage is above 90%');
      expect(health.suggestions).toContain('Consider enabling auto-cleanup or manually delete old GIFs');
    });

    it('should detect medium storage usage', async () => {
      mockGifDatabase.getStorageQuota.mockResolvedValue({
        used: 1024 * 1024 * 400, // 80% usage
        total: 1024 * 1024 * 500,
        available: 1024 * 1024 * 100
      });
      
      mockGifDatabase.getAllGifs.mockResolvedValue([]);
      
      const health = await storageManager.checkStorageHealth();
      
      expect(health.isHealthy).toBe(true);
      expect(health.suggestions).toContain('Storage usage is above 75%, consider cleanup soon');
    });

    it('should suggest enabling auto-cleanup', async () => {
      mockPreferences.autoCleanup = false;
      
      mockGifDatabase.getStorageQuota.mockResolvedValue({
        used: 1024 * 1024 * 100,
        total: 1024 * 1024 * 500,
        available: 1024 * 1024 * 400
      });
      
      mockGifDatabase.getAllGifs.mockResolvedValue([]);
      
      const health = await storageManager.checkStorageHealth();
      
      expect(health.suggestions).toContain('Consider enabling auto-cleanup to manage storage automatically');
    });

    it('should detect old GIFs', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // 40 days old
      
      const oldGifs = Array.from({ length: 15 }, (_, i) => ({
        id: `old-gif-${i}`,
        title: `Old GIF ${i}`,
        description: '',
        width: 480,
        height: 360,
        duration: 3,
        frameRate: 15,
        fileSize: 1024,
        createdAt: oldDate,
        tags: []
      }));
      
      mockGifDatabase.getStorageQuota.mockResolvedValue({
        used: 1024 * 1024 * 100,
        total: 1024 * 1024 * 500,
        available: 1024 * 1024 * 400
      });
      
      mockGifDatabase.getAllGifs.mockResolvedValue(oldGifs);
      
      const health = await storageManager.checkStorageHealth();
      
      expect(health.suggestions).toContain('15 GIFs are older than 30 days');
    });

    it('should handle storage health check errors', async () => {
      mockGifDatabase.getStorageQuota.mockRejectedValue(new Error('Storage error'));
      
      const health = await storageManager.checkStorageHealth();
      
      expect(health.isHealthy).toBe(false);
      expect(health.issues).toContain('Storage system error: Error: Storage error');
    });
  });

  describe('Event System Integration', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should add event listeners to both storage systems', () => {
      const listener = jest.fn();
      
      storageManager.addEventListener(listener);
      
      expect(mockGifDatabase.addEventListener).toHaveBeenCalledWith(listener);
      expect(mockChromeStorageManager.addEventListener).toHaveBeenCalledWith(listener);
    });

    it('should remove event listeners from both storage systems', () => {
      const listener = jest.fn();
      
      storageManager.removeEventListener(listener);
      
      expect(mockGifDatabase.removeEventListener).toHaveBeenCalledWith(listener);
      expect(mockChromeStorageManager.removeEventListener).toHaveBeenCalledWith(listener);
    });
  });

  describe('Lifecycle Management', () => {
    it('should close storage systems', async () => {
      await storageManager.initialize();
      await storageManager.close();
      
      expect(mockGifDatabase.close).toHaveBeenCalled();
    });
  });

  describe('Performance Testing', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should handle large batch operations efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate batch operations
      const operations = Array.from({ length: 100 }, (_, i) => 
        storageManager.saveGif({ ...mockGifData, id: `gif-${i}` })
      );
      
      await Promise.all(operations);
      
      const duration = Date.now() - startTime;
      
      // Should complete batch operations reasonably quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second for mocked operations
      expect(mockGifDatabase.saveGif).toHaveBeenCalledTimes(100);
    });

    it('should handle concurrent read operations', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => 
        Promise.all([
          storageManager.getGif(`gif-${i}`),
          storageManager.searchGifs(`query-${i}`),
          storageManager.getGifsByTag(`tag-${i}`)
        ])
      );
      
      const startTime = Date.now();
      await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500);
      expect(mockGifDatabase.getGif).toHaveBeenCalledTimes(50);
      expect(mockGifDatabase.searchGifs).toHaveBeenCalledTimes(50);
      expect(mockGifDatabase.getGifsByTag).toHaveBeenCalledTimes(50);
    });

    it('should handle mixed read/write operations', async () => {
      const readOps = Array.from({ length: 25 }, (_, i) => 
        storageManager.getGif(`gif-${i}`)
      );
      
      const writeOps = Array.from({ length: 25 }, (_, i) => 
        storageManager.saveGif({ ...mockGifData, id: `new-gif-${i}` })
      );
      
      const startTime = Date.now();
      await Promise.all([...readOps, ...writeOps]);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await storageManager.initialize();
    });

    it('should handle database errors gracefully', async () => {
      mockGifDatabase.saveGif.mockRejectedValue(new Error('Database error'));
      
      await expect(storageManager.saveGif(mockGifData)).rejects.toThrow('Database error');
    });

    it('should handle preferences errors gracefully', async () => {
      mockChromeStorageManager.getPreferences.mockRejectedValue(new Error('Chrome storage error'));
      
      await expect(storageManager.getPreferences()).rejects.toThrow('Chrome storage error');
    });

    it('should continue working after partial failures', async () => {
      mockGifDatabase.saveGif
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce();
      
      // First call fails
      await expect(storageManager.saveGif(mockGifData)).rejects.toThrow('Temporary error');
      
      // Second call succeeds
      await expect(storageManager.saveGif(mockGifData)).resolves.not.toThrow();
    });
  });
});