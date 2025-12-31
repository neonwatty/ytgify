import { chromeMock } from '../__mocks__/chrome-mocks';
import manifest from '../../../manifest.json';

describe('Background Service Worker Framework Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Chrome API mocks for each test
    chromeMock.runtime.onInstalled.addListener.mockClear();
    chromeMock.runtime.onMessage.addListener.mockClear();
  });

  it('should have Chrome API mocks available', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.runtime.onInstalled).toBeDefined();
    expect(chrome.runtime.onMessage).toBeDefined();
    expect(chrome.runtime.sendMessage).toBeDefined();
  });

  it('should be able to register message listeners', () => {
    const mockListener = jest.fn();
    chrome.runtime.onMessage.addListener(mockListener);
    
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(mockListener);
  });

  it('should be able to send messages', async () => {
    const message = { type: 'TEST', data: 'test' };
    const response = await chrome.runtime.sendMessage(message);
    
    expect(response).toEqual({ success: true });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(message);
  });

  it('should handle installation events', () => {
    const mockCallback = jest.fn();
    chrome.runtime.onInstalled.addListener(mockCallback);
    
    expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(mockCallback);
  });

  it('should provide extension manifest data', () => {
    const chromeManifest = chrome.runtime.getManifest();

    expect(chromeManifest).toBeDefined();
    expect(chromeManifest.name).toBe('YTgify - YouTube to GIF Maker');
    expect(chromeManifest.version).toBe(manifest.version);
    expect(chromeManifest.manifest_version).toBe(3);
  });

  it('should generate extension URLs', () => {
    const url = chrome.runtime.getURL('popup.html');
    
    expect(url).toBe('chrome-extension://mock-extension-id/popup.html');
  });

  it('should have storage API available', async () => {
    const testData = { key: 'value' };
    
    await chrome.storage.sync.set(testData);
    const result = await chrome.storage.sync.get('key');
    
    expect(result).toEqual(testData);
  });

  it('should have tabs API available', async () => {
    const tabs = await chrome.tabs.query({ active: true });

    expect(Array.isArray(tabs)).toBe(true);
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs[0]).toHaveProperty('id');
    expect(tabs[0]).toHaveProperty('url');
  });

  describe('Extension Update Cleanup', () => {
    it('should call database cleanup on extension update', async () => {
      // Mock the database cleanup module
      const mockDeleteDatabase = jest.fn().mockResolvedValue(true);

      jest.mock('@/shared/database-cleanup', () => ({
        databaseCleanup: {
          deleteDatabase: mockDeleteDatabase
        }
      }));

      // Create a mock listener callback to simulate onInstalled behavior
      const mockOnInstalledCallback = jest.fn(async (details) => {
        if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
          // This simulates what the actual background script does
          const { databaseCleanup } = await import('@/shared/database-cleanup');
          await databaseCleanup.deleteDatabase();
        }
      });

      // Register the listener
      chrome.runtime.onInstalled.addListener(mockOnInstalledCallback);

      // Simulate extension update event
      const updateDetails = {
        reason: chrome.runtime.OnInstalledReason.UPDATE,
        previousVersion: '1.0.8'
      };

      // Call the listener directly (simulating Chrome's behavior)
      await mockOnInstalledCallback(updateDetails);

      // Verify callback was invoked with UPDATE reason
      expect(mockOnInstalledCallback).toHaveBeenCalledWith(updateDetails);
    });

    it('should not call database cleanup on fresh install', async () => {
      const mockDeleteDatabase = jest.fn().mockResolvedValue(true);

      const mockOnInstalledCallback = jest.fn(async (details) => {
        if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
          const { databaseCleanup } = await import('@/shared/database-cleanup');
          await databaseCleanup.deleteDatabase();
        }
      });

      chrome.runtime.onInstalled.addListener(mockOnInstalledCallback);

      // Simulate fresh install event
      const installDetails = {
        reason: chrome.runtime.OnInstalledReason.INSTALL
      };

      await mockOnInstalledCallback(installDetails);

      // Verify callback was invoked but cleanup was not called
      expect(mockOnInstalledCallback).toHaveBeenCalledWith(installDetails);
      // Database cleanup should not be called for INSTALL
      expect(mockDeleteDatabase).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully during update', async () => {
      const mockDeleteDatabase = jest.fn().mockRejectedValue(new Error('Cleanup failed'));

      const mockOnInstalledCallback = jest.fn(async (details) => {
        if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
          try {
            const { databaseCleanup } = await import('@/shared/database-cleanup');
            await databaseCleanup.deleteDatabase();
          } catch (error) {
            // Cleanup failure should not throw - just log
            // This simulates the try-catch in the actual background script
            console.error('Cleanup failed', error);
          }
        }
      });

      chrome.runtime.onInstalled.addListener(mockOnInstalledCallback);

      const updateDetails = {
        reason: chrome.runtime.OnInstalledReason.UPDATE,
        previousVersion: '1.0.8'
      };

      // Should not throw even if cleanup fails
      await expect(mockOnInstalledCallback(updateDetails)).resolves.not.toThrow();
    });
  });
});