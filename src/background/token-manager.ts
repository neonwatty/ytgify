/**
 * Token Manager for Chrome Service Worker Lifecycle
 *
 * Problem: Chrome service workers terminate after 5 minutes idle
 * Solution: Check and refresh token on EVERY activation, not just alarms
 *
 * Phase 1: JWT token lifecycle management
 */

import { apiClient } from '@/lib/api/api-client';
import { StorageAdapter } from '@/lib/storage/storage-adapter';

/**
 * Token manager handles JWT lifecycle across service worker restarts
 */
export class TokenManager {
  // Refresh token if it expires within 5 minutes
  private static readonly TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes

  /**
   * Check and refresh token on service worker activation
   *
   * Called when:
   * - Browser starts (chrome.runtime.onStartup)
   * - Extension installed/updated (chrome.runtime.onInstalled)
   * - Service worker wakes from termination
   */
  static async onServiceWorkerActivation(): Promise<void> {
    try {
      const authState = await StorageAdapter.getAuthState();

      if (!authState || !authState.token) {
        console.log('[TokenManager] 📋 No auth state stored');
        return;
      }

      const now = Date.now();
      const timeUntilExpiry = authState.expiresAt - now;

      if (timeUntilExpiry < 0) {
        // Token already expired
        console.log('[TokenManager] ❌ Token expired. Clearing auth data.');
        await StorageAdapter.clearAllAuthData();

        // Notify popup/content scripts
        await this.notifyTokenExpired();
        return;
      }

      if (timeUntilExpiry < this.TOKEN_REFRESH_THRESHOLD) {
        // Token expires soon, refresh immediately
        const minutesRemaining = Math.floor(timeUntilExpiry / 60000);
        console.log(
          `[TokenManager] ⏱️ Token expires in ${minutesRemaining} minutes. Refreshing...`
        );

        try {
          await apiClient.refreshToken();
          console.log('[TokenManager] ✅ Token refreshed successfully');
        } catch (error) {
          console.error('[TokenManager] ❌ Token refresh failed:', error);
          await StorageAdapter.clearAllAuthData();
          await this.notifyTokenExpired();
        }
      } else {
        // Token still valid
        const minutesRemaining = Math.floor(timeUntilExpiry / 60000);
        console.log(`[TokenManager] ✅ Token valid for ${minutesRemaining} more minutes`);
      }
    } catch (error) {
      console.error('[TokenManager] ❌ Token check failed:', error);

      // On error, clear auth and prompt login
      await StorageAdapter.clearAllAuthData();
      await this.notifyTokenExpired();
    }
  }

  /**
   * Set up periodic token refresh (backup mechanism)
   * Alarm-based refresh as fallback in case activation checks miss
   */
  static async setupTokenRefreshAlarm(): Promise<void> {
    try {
      // Create alarm for every 10 minutes
      chrome.alarms.create('refreshToken', {
        periodInMinutes: 10,
      });

      console.log('[TokenManager] ⏰ Token refresh alarm set (10 minute interval)');
    } catch (error) {
      console.error('[TokenManager] ❌ Failed to set up refresh alarm:', error);
    }
  }

  /**
   * Handle token refresh alarm
   * Called every 10 minutes as backup refresh mechanism
   */
  static async onTokenRefreshAlarm(): Promise<void> {
    try {
      const authState = await StorageAdapter.getAuthState();

      if (!authState || !authState.token) {
        console.log('[TokenManager] 📋 No token to refresh');
        return;
      }

      // Check if token needs refresh
      const now = Date.now();
      const timeUntilExpiry = authState.expiresAt - now;

      if (timeUntilExpiry < this.TOKEN_REFRESH_THRESHOLD) {
        console.log('[TokenManager] ⏰ Alarm: Refreshing token...');

        try {
          await apiClient.refreshToken();
          console.log('[TokenManager] ✅ Alarm: Token refreshed successfully');
        } catch (error) {
          console.error('[TokenManager] ❌ Alarm: Token refresh failed:', error);
          await StorageAdapter.clearAllAuthData();
          await this.notifyTokenExpired();
        }
      } else {
        const minutesRemaining = Math.floor(timeUntilExpiry / 60000);
        console.log(
          `[TokenManager] ⏰ Alarm: Token still valid (${minutesRemaining} minutes remaining)`
        );
      }
    } catch (error) {
      console.error('[TokenManager] ❌ Alarm-based token refresh failed:', error);
      await StorageAdapter.clearAllAuthData();
      await this.notifyTokenExpired();
    }
  }

  /**
   * Notify popup and content scripts that token expired
   */
  private static async notifyTokenExpired(): Promise<void> {
    try {
      // Show Chrome notification to user
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon128.png',
          title: 'YTGify Session Expired',
          message: 'Please sign in again to upload GIFs to your account.',
          priority: 2,
        });
      }

      // Send message to all tabs (content scripts)
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'TOKEN_EXPIRED' }).catch(() => {
            // Ignore errors (tab may not have content script)
          });
        }
      }

      // Send message to extension (popup, etc.)
      chrome.runtime.sendMessage({ type: 'TOKEN_EXPIRED' }).catch(() => {
        // Ignore errors (popup may not be open)
      });

      console.log('[TokenManager] 📢 Sent TOKEN_EXPIRED notifications');
    } catch (error) {
      console.error('[TokenManager] ❌ Failed to send token expired notifications:', error);
    }
  }

  /**
   * Manually trigger token refresh (called by UI or content script)
   */
  static async manualRefresh(): Promise<boolean> {
    try {
      console.log('[TokenManager] 🔄 Manual token refresh requested');

      const hasToken = await StorageAdapter.isAuthenticated();

      if (!hasToken) {
        console.log('[TokenManager] ❌ No token to refresh');
        return false;
      }

      await apiClient.refreshToken();
      console.log('[TokenManager] ✅ Manual refresh successful');

      return true;
    } catch (error) {
      console.error('[TokenManager] ❌ Manual refresh failed:', error);
      await StorageAdapter.clearAllAuthData();
      await this.notifyTokenExpired();
      return false;
    }
  }

  /**
   * Check auth status (for popup/content script requests)
   */
  static async checkAuthStatus(): Promise<{
    authenticated: boolean;
    expiresIn?: number;
    needsRefresh?: boolean;
  }> {
    const authState = await StorageAdapter.getAuthState();

    if (!authState || !authState.token) {
      return { authenticated: false };
    }

    const now = Date.now();
    const expiresIn = authState.expiresAt - now;

    if (expiresIn < 0) {
      // Expired
      await StorageAdapter.clearAllAuthData();
      return { authenticated: false };
    }

    const needsRefresh = expiresIn < this.TOKEN_REFRESH_THRESHOLD;

    return {
      authenticated: true,
      expiresIn,
      needsRefresh,
    };
  }

  /**
   * Clear auth alarm when user logs out
   */
  static async clearTokenRefreshAlarm(): Promise<void> {
    try {
      await chrome.alarms.clear('refreshToken');
      console.log('[TokenManager] ✅ Token refresh alarm cleared');
    } catch (error) {
      console.error('[TokenManager] ❌ Failed to clear alarm:', error);
    }
  }
}
