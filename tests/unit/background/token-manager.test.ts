/**
 * Unit Tests for TokenManager
 * Tests service worker lifecycle, token refresh, and alarm management
 */

import { TokenManager } from '@/background/token-manager';
import { apiClient } from '@/lib/api/api-client';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import type { AuthState, UserProfile } from '@/types/auth';

// Mock dependencies
jest.mock('@/lib/api/api-client');
jest.mock('@/lib/storage/storage-adapter');

// Mock Chrome APIs
const mockChrome = {
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  runtime: {
    sendMessage: jest.fn(),
  },
};

(global as any).chrome = mockChrome;

const mockUserProfile: UserProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  avatar_url: null,
  bio: null,
  gifs_count: 0,
  follower_count: 0,
  following_count: 0,
  is_verified: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

describe('TokenManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('onServiceWorkerActivation', () => {
    it('should do nothing if no auth state exists', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(null);

      await TokenManager.onServiceWorkerActivation();

      expect(apiClient.refreshToken).not.toHaveBeenCalled();
      expect(StorageAdapter.clearAllAuthData).not.toHaveBeenCalled();
    });

    it('should clear expired tokens', async () => {
      const expiredAuthState: AuthState = {
        token: 'expired-token',
        expiresAt: Date.now() - 60000, // 1 minute ago
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiredAuthState);
      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }]);
      mockChrome.tabs.sendMessage.mockResolvedValue(undefined);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await TokenManager.onServiceWorkerActivation();

      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'TOKEN_EXPIRED' });
    });

    it('should refresh tokens expiring within 5 minutes', async () => {
      const expiringAuthState: AuthState = {
        token: 'expiring-token',
        expiresAt: Date.now() + 240000, // 4 minutes from now
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringAuthState);
      (apiClient.refreshToken as jest.Mock).mockResolvedValue('new-token');

      await TokenManager.onServiceWorkerActivation();

      expect(apiClient.refreshToken).toHaveBeenCalled();
    });

    it('should clear auth if token refresh fails', async () => {
      const expiringAuthState: AuthState = {
        token: 'expiring-token',
        expiresAt: Date.now() + 240000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringAuthState);
      (apiClient.refreshToken as jest.Mock).mockRejectedValue(new Error('Refresh failed'));
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await TokenManager.onServiceWorkerActivation();

      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });

    it('should do nothing if token is still valid', async () => {
      const validAuthState: AuthState = {
        token: 'valid-token',
        expiresAt: Date.now() + 600000, // 10 minutes from now
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(validAuthState);

      await TokenManager.onServiceWorkerActivation();

      expect(apiClient.refreshToken).not.toHaveBeenCalled();
      expect(StorageAdapter.clearAllAuthData).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockRejectedValue(
        new Error('Storage error')
      );
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await TokenManager.onServiceWorkerActivation();

      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });
  });

  describe('setupTokenRefreshAlarm', () => {
    it('should create 10-minute alarm', async () => {
      await TokenManager.setupTokenRefreshAlarm();

      expect(mockChrome.alarms.create).toHaveBeenCalledWith('refreshToken', {
        periodInMinutes: 10,
      });
    });

    it('should handle alarm creation errors', async () => {
      mockChrome.alarms.create.mockImplementation(() => {
        throw new Error('Alarm error');
      });

      await TokenManager.setupTokenRefreshAlarm();

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('onTokenRefreshAlarm', () => {
    it('should do nothing if no token exists', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(null);

      await TokenManager.onTokenRefreshAlarm();

      expect(apiClient.refreshToken).not.toHaveBeenCalled();
    });

    it('should refresh token if expiring soon', async () => {
      const expiringAuthState: AuthState = {
        token: 'expiring-token',
        expiresAt: Date.now() + 240000, // 4 minutes
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringAuthState);
      (apiClient.refreshToken as jest.Mock).mockResolvedValue('new-token');

      await TokenManager.onTokenRefreshAlarm();

      expect(apiClient.refreshToken).toHaveBeenCalled();
    });

    it('should do nothing if token is still valid', async () => {
      const validAuthState: AuthState = {
        token: 'valid-token',
        expiresAt: Date.now() + 600000, // 10 minutes
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(validAuthState);

      await TokenManager.onTokenRefreshAlarm();

      expect(apiClient.refreshToken).not.toHaveBeenCalled();
    });

    it('should clear auth if refresh fails', async () => {
      const expiringAuthState: AuthState = {
        token: 'expiring-token',
        expiresAt: Date.now() + 240000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringAuthState);
      (apiClient.refreshToken as jest.Mock).mockRejectedValue(new Error('Refresh failed'));
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await TokenManager.onTokenRefreshAlarm();

      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });
  });

  describe('manualRefresh', () => {
    it('should refresh token successfully', async () => {
      (StorageAdapter.isAuthenticated as jest.Mock).mockResolvedValue(true);
      (apiClient.refreshToken as jest.Mock).mockResolvedValue('new-token');

      const result = await TokenManager.manualRefresh();

      expect(result).toBe(true);
      expect(apiClient.refreshToken).toHaveBeenCalled();
    });

    it('should return false if not authenticated', async () => {
      (StorageAdapter.isAuthenticated as jest.Mock).mockResolvedValue(false);

      const result = await TokenManager.manualRefresh();

      expect(result).toBe(false);
      expect(apiClient.refreshToken).not.toHaveBeenCalled();
    });

    it('should return false and clear auth if refresh fails', async () => {
      (StorageAdapter.isAuthenticated as jest.Mock).mockResolvedValue(true);
      (apiClient.refreshToken as jest.Mock).mockRejectedValue(new Error('Refresh failed'));
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      const result = await TokenManager.manualRefresh();

      expect(result).toBe(false);
      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });
  });

  describe('checkAuthStatus', () => {
    it('should return unauthenticated if no token', async () => {
      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(null);

      const result = await TokenManager.checkAuthStatus();

      expect(result).toEqual({ authenticated: false });
    });

    it('should return authenticated with expiry info', async () => {
      const validAuthState: AuthState = {
        token: 'valid-token',
        expiresAt: Date.now() + 600000, // 10 minutes
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(validAuthState);

      const result = await TokenManager.checkAuthStatus();

      expect(result.authenticated).toBe(true);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.needsRefresh).toBe(false);
    });

    it('should indicate token needs refresh', async () => {
      const expiringAuthState: AuthState = {
        token: 'expiring-token',
        expiresAt: Date.now() + 240000, // 4 minutes
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringAuthState);

      const result = await TokenManager.checkAuthStatus();

      expect(result.authenticated).toBe(true);
      expect(result.needsRefresh).toBe(true);
    });

    it('should clear and return false for expired tokens', async () => {
      const expiredAuthState: AuthState = {
        token: 'expired-token',
        expiresAt: Date.now() - 60000, // 1 minute ago
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiredAuthState);

      const result = await TokenManager.checkAuthStatus();

      expect(result.authenticated).toBe(false);
      expect(StorageAdapter.clearAllAuthData).toHaveBeenCalled();
    });
  });

  describe('clearTokenRefreshAlarm', () => {
    it('should clear alarm successfully', async () => {
      mockChrome.alarms.clear.mockResolvedValue(true);

      await TokenManager.clearTokenRefreshAlarm();

      expect(mockChrome.alarms.clear).toHaveBeenCalledWith('refreshToken');
    });

    it('should handle clear errors', async () => {
      mockChrome.alarms.clear.mockRejectedValue(new Error('Clear failed'));

      await TokenManager.clearTokenRefreshAlarm();

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('notifyTokenExpired', () => {
    it('should send notifications to all tabs', async () => {
      const expiringAuthState: AuthState = {
        token: 'expiring-token',
        expiresAt: Date.now() + 240000,
        userId: 'test-user-id',
        userProfile: mockUserProfile,
      };

      (StorageAdapter.getAuthState as jest.Mock).mockResolvedValue(expiringAuthState);
      (apiClient.refreshToken as jest.Mock).mockRejectedValue(new Error('Refresh failed'));

      mockChrome.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockChrome.tabs.sendMessage.mockResolvedValue(undefined);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      await TokenManager.onServiceWorkerActivation();

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'TOKEN_EXPIRED' });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'TOKEN_EXPIRED' });
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'TOKEN_EXPIRED' });
    });
  });
});
