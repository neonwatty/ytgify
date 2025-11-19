/**
 * Unit Tests for StorageAdapter
 * Tests JWT token storage, auth state management, and cross-browser compatibility
 */

import { StorageAdapter } from '@/lib/storage/storage-adapter';
import type { AuthState, UserProfile, AuthPreferences } from '@/types/auth';

// Mock Chrome storage API
const mockStorageData: Record<string, any> = {};

const mockChrome = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, any> = {};
        keysArray.forEach((key) => {
          if (mockStorageData[key] !== undefined) {
            result[key] = mockStorageData[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, any>) => {
        Object.assign(mockStorageData, items);
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach((key) => delete mockStorageData[key]);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(mockStorageData).forEach((key) => delete mockStorageData[key]);
        return Promise.resolve();
      }),
      getBytesInUse: jest.fn((keys: any, callback: (bytes: number) => void) => {
        callback(1024); // Return 1KB
      }),
    },
    sync: {
      get: jest.fn((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, any> = {};
        keysArray.forEach((key) => {
          if (mockStorageData[key] !== undefined) {
            result[key] = mockStorageData[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, any>) => {
        Object.assign(mockStorageData, items);
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        keysArray.forEach((key) => delete mockStorageData[key]);
        return Promise.resolve();
      }),
    },
  },
  runtime: {
    lastError: null as any,
  },
};

(global as any).chrome = mockChrome;

// Test data
const mockUserProfile: UserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  avatar_url: 'https://example.com/avatar.jpg',
  bio: 'Test bio',
  gifs_count: 10,
  follower_count: 5,
  following_count: 3,
  is_verified: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

const mockAuthState: AuthState = {
  token: 'mock-jwt-token',
  expiresAt: Date.now() + 900000, // 15 minutes from now
  userId: 'test-user-id',
  userProfile: mockUserProfile,
};

const mockAuthPreferences: AuthPreferences = {
  autoUpload: true,
  uploadOnWifiOnly: false,
  defaultPrivacy: 'public_access',
  notificationPolling: true,
  pollIntervalMinutes: 2,
};

describe('StorageAdapter', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorageData).forEach((key) => delete mockStorageData[key]);
    jest.clearAllMocks();
  });

  describe('Auth State Management', () => {
    it('should save auth state to local storage', async () => {
      await StorageAdapter.saveAuthState(mockAuthState);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        authState: mockAuthState,
      });
      expect(mockStorageData.authState).toEqual(mockAuthState);
    });

    it('should retrieve auth state from local storage', async () => {
      mockStorageData.authState = mockAuthState;

      const result = await StorageAdapter.getAuthState();

      expect(mockChrome.storage.local.get).toHaveBeenCalledWith('authState');
      expect(result).toEqual(mockAuthState);
    });

    it('should return null if auth state does not exist', async () => {
      const result = await StorageAdapter.getAuthState();

      expect(result).toBeNull();
    });

    it('should clear auth state from local storage', async () => {
      mockStorageData.authState = mockAuthState;

      await StorageAdapter.clearAuthState();

      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith('authState');
      expect(mockStorageData.authState).toBeUndefined();
    });
  });

  describe('Authentication Status', () => {
    it('should return true if user is authenticated', async () => {
      mockStorageData.authState = mockAuthState;

      const isAuth = await StorageAdapter.isAuthenticated();

      expect(isAuth).toBe(true);
    });

    it('should return false if no auth state exists', async () => {
      const isAuth = await StorageAdapter.isAuthenticated();

      expect(isAuth).toBe(false);
    });

    it('should return true even if token is expired (checks existence not expiry)', async () => {
      const expiredAuthState: AuthState = {
        ...mockAuthState,
        expiresAt: Date.now() - 1000, // 1 second ago
      };
      mockStorageData.authState = expiredAuthState;

      const isAuth = await StorageAdapter.isAuthenticated();

      // isAuthenticated() only checks if token exists, use isTokenExpired() for expiry checks
      expect(isAuth).toBe(true);
    });

    it('should return true even if token is close to expiry', async () => {
      const almostExpiredAuthState: AuthState = {
        ...mockAuthState,
        expiresAt: Date.now() + 60000, // 1 minute from now
      };
      mockStorageData.authState = almostExpiredAuthState;

      const isAuth = await StorageAdapter.isAuthenticated();

      // isAuthenticated() only checks if token exists, not expiry time
      expect(isAuth).toBe(true);
    });
  });

  describe('Token Management', () => {
    it('should check if token is expired', async () => {
      const expiredAuthState: AuthState = {
        ...mockAuthState,
        expiresAt: Date.now() - 1000,
      };
      mockStorageData.authState = expiredAuthState;

      const isExpired = await StorageAdapter.isTokenExpired();

      expect(isExpired).toBe(true);
    });

    it('should return false if token is valid', async () => {
      mockStorageData.authState = mockAuthState;

      const isExpired = await StorageAdapter.isTokenExpired();

      expect(isExpired).toBe(false);
    });

    it('should return true if no auth state exists', async () => {
      const isExpired = await StorageAdapter.isTokenExpired();

      expect(isExpired).toBe(true);
    });

    it('should check if token is expiring soon (within 5 minutes)', async () => {
      const soonToExpireAuthState: AuthState = {
        ...mockAuthState,
        expiresAt: Date.now() + 240000, // 4 minutes from now (within 5-minute threshold)
      };
      mockStorageData.authState = soonToExpireAuthState;

      const expiringSoon = await StorageAdapter.isTokenExpiringSoon();

      expect(expiringSoon).toBe(true);
    });

    it('should return false if token is not expiring soon', async () => {
      const validAuthState: AuthState = {
        ...mockAuthState,
        expiresAt: Date.now() + 600000, // 10 minutes from now
      };
      mockStorageData.authState = validAuthState;

      const expiringSoon = await StorageAdapter.isTokenExpiringSoon();

      expect(expiringSoon).toBe(false);
    });
  });

  describe('User Profile Management', () => {
    it('should save user profile to auth state', async () => {
      // Set up existing auth state first
      mockStorageData.authState = mockAuthState;

      await StorageAdapter.saveUserProfile(mockUserProfile);

      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockStorageData.authState.userProfile).toEqual(mockUserProfile);
    });

    it('should retrieve user profile from auth state', async () => {
      mockStorageData.authState = mockAuthState;

      const result = await StorageAdapter.getUserProfile();

      expect(result).toEqual(mockUserProfile);
    });

    it('should return null if user profile does not exist', async () => {
      const result = await StorageAdapter.getUserProfile();

      expect(result).toBeNull();
    });
  });

  describe('Auth Preferences Management', () => {
    it('should save auth preferences to local storage', async () => {
      await StorageAdapter.saveAuthPreferences(mockAuthPreferences);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        authPreferences: mockAuthPreferences,
      });
      expect(mockStorageData.authPreferences).toEqual(mockAuthPreferences);
    });

    it('should retrieve auth preferences from local storage', async () => {
      mockStorageData.authPreferences = mockAuthPreferences;

      const result = await StorageAdapter.getAuthPreferences();

      expect(mockChrome.storage.local.get).toHaveBeenCalled();
      expect(result).toEqual(mockAuthPreferences);
    });

    it('should return default preferences if none exist', async () => {
      const result = await StorageAdapter.getAuthPreferences();

      expect(result).toEqual({
        autoUpload: false, // Manual upload is the default
        uploadOnWifiOnly: false,
        defaultPrivacy: 'public_access',
        notificationPolling: true,
        pollIntervalMinutes: 2,
      });
    });
  });

  describe('Storage Info', () => {
    it('should return storage info', async () => {
      mockStorageData.authState = mockAuthState;
      mockStorageData.authPreferences = mockAuthPreferences;

      const info = await StorageAdapter.getStorageInfo();

      expect(info.hasAuthData).toBe(true);
      expect(info.hasPreferences).toBe(true);
      expect(info.bytesInUse).toBeDefined();
    });

    it('should indicate no auth data when storage is empty', async () => {
      const info = await StorageAdapter.getStorageInfo();

      expect(info.hasAuthData).toBe(false);
      expect(info.hasPreferences).toBe(true); // getPreferences returns defaults
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Storage error'));
      mockChrome.storage.local.get = errorFn as any;

      await expect(StorageAdapter.getAuthState()).rejects.toThrow('Storage error');
    });

    it('should handle save errors gracefully', async () => {
      const errorFn = jest.fn().mockRejectedValue(new Error('Save error'));
      mockChrome.storage.local.set = errorFn as any;

      await expect(StorageAdapter.saveAuthState(mockAuthState)).rejects.toThrow('Save error');
    });
  });
});
