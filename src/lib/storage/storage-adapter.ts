/**
 * Storage Abstraction Layer
 *
 * Cross-browser storage adapter that handles differences between
 * Chrome and Firefox storage APIs.
 *
 * Chrome: chrome.storage.local + chrome.storage.sync
 * Firefox: browser.storage.local only (no sync)
 *
 * Phase 1: JWT token storage for authentication
 */

import type { AuthState, UserProfile, AuthPreferences } from '@/types/auth';
import type { UserPreferences } from '@/types/storage';

/**
 * Storage adapter with browser detection
 */
export class StorageAdapter {
  /**
   * Detect which browser API is available
   */
  private static get api() {
    // Chrome API (Manifest V3)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return chrome.storage;
    }

    // Firefox API (browser.*)
    // @ts-expect-error - Firefox browser API not in Chrome types
    if (typeof browser !== 'undefined' && browser.storage) {
      // @ts-expect-error - Firefox browser API
      return browser.storage;
    }

    throw new Error('No storage API available');
  }

  /**
   * Check if running in Chrome (has sync storage)
   */
  private static get isChrome(): boolean {
    return (
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.sync !== undefined
    );
  }

  // ========================================
  // JWT Token Storage (Always Local)
  // ========================================

  /**
   * Save JWT auth state (always in local storage for security)
   *
   * Why local not sync?
   * - Tokens are short-lived (15 min)
   * - Should not sync across devices (security)
   * - Each device should authenticate separately
   */
  static async saveAuthState(authState: AuthState): Promise<void> {
    await this.api.local.set({ authState });
    console.log('[StorageAdapter] ✅ Auth state saved to local storage');
  }

  /**
   * Get auth state from local storage
   */
  static async getAuthState(): Promise<AuthState | null> {
    const result = await this.api.local.get('authState');
    return result.authState || null;
  }

  /**
   * Clear auth state (on logout)
   */
  static async clearAuthState(): Promise<void> {
    await this.api.local.remove('authState');
    console.log('[StorageAdapter] 🗑️ Auth state cleared from storage');
  }

  /**
   * Check if user is authenticated (has valid auth state)
   */
  static async isAuthenticated(): Promise<boolean> {
    const authState = await this.getAuthState();
    return authState !== null && authState.token !== null;
  }

  /**
   * Get JWT token (convenience method)
   */
  static async getToken(): Promise<string | null> {
    const authState = await this.getAuthState();
    return authState?.token || null;
  }

  /**
   * Check if token is expired
   */
  static async isTokenExpired(): Promise<boolean> {
    const authState = await this.getAuthState();

    if (!authState) {
      return true;
    }

    const now = Date.now();
    return now >= authState.expiresAt;
  }

  /**
   * Check if token is close to expiry (within 5 minutes)
   */
  static async isTokenExpiringSoon(): Promise<boolean> {
    const authState = await this.getAuthState();

    if (!authState) {
      return false;
    }

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return authState.expiresAt - now < fiveMinutes;
  }

  // ========================================
  // User Profile Storage
  // ========================================

  /**
   * Save user profile (cached from backend)
   */
  static async saveUserProfile(profile: UserProfile): Promise<void> {
    // Update auth state with new profile
    const authState = await this.getAuthState();

    if (authState) {
      authState.userProfile = profile;
      await this.saveAuthState(authState);
    } else {
      // If no auth state, just store profile separately
      await this.api.local.set({ userProfile: profile });
    }

    console.log('[StorageAdapter] ✅ User profile saved');
  }

  /**
   * Get cached user profile
   */
  static async getUserProfile(): Promise<UserProfile | null> {
    const authState = await this.getAuthState();

    if (authState && authState.userProfile) {
      return authState.userProfile;
    }

    // Fallback: check if profile stored separately (legacy)
    const result = await this.api.local.get('userProfile');
    return result.userProfile || null;
  }

  // ========================================
  // User Preferences Storage
  // ========================================

  /**
   * Save user preferences
   *
   * Chrome: Uses sync storage (syncs across devices)
   * Firefox: Falls back to local storage (no sync)
   */
  static async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    // Get existing preferences
    const existing = await this.getPreferences();

    // Merge with new preferences
    const updated = { ...existing, ...preferences };

    // Try to use sync storage if available (Chrome only)
    const storage = this.isChrome ? this.api.sync : this.api.local;

    await storage.set({ userPreferences: updated });

    const location = this.isChrome ? 'sync' : 'local';
    console.log(`[StorageAdapter] ✅ Preferences saved to ${location} storage`);
  }

  /**
   * Get user preferences
   */
  static async getPreferences(): Promise<UserPreferences> {
    // Try sync first (Chrome), fallback to local (Firefox)
    const storage = this.isChrome ? this.api.sync : this.api.local;
    const result = await storage.get('userPreferences');

    return result.userPreferences || this.getDefaultPreferences();
  }

  /**
   * Get default preferences
   */
  static getDefaultPreferences(): UserPreferences {
    return {
      defaultQuality: 'medium',
      autoDownload: true,
      defaultFrameRate: 15,
      defaultWidth: 640,
      showAdvancedOptions: false,
      theme: 'system',
    };
  }

  /**
   * Save auth-specific preferences
   */
  static async saveAuthPreferences(prefs: Partial<AuthPreferences>): Promise<void> {
    const existing = await this.getAuthPreferences();
    const updated = { ...existing, ...prefs };

    await this.api.local.set({ authPreferences: updated });
    console.log('[StorageAdapter] ✅ Auth preferences saved');
  }

  /**
   * Get auth-specific preferences
   */
  static async getAuthPreferences(): Promise<AuthPreferences> {
    const result = await this.api.local.get('authPreferences');

    return (
      result.authPreferences || {
        autoUpload: false,
        uploadOnWifiOnly: false,
        defaultPrivacy: 'public_access' as const,
        notificationPolling: true,
        pollIntervalMinutes: 2,
      }
    );
  }

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Clear all auth data (on logout)
   */
  static async clearAllAuthData(): Promise<void> {
    await this.api.local.remove(['authState', 'userProfile', 'authPreferences']);
    console.log('[StorageAdapter] 🗑️ All auth data cleared');
  }

  /**
   * Get storage usage info
   */
  static async getStorageInfo(): Promise<{
    bytesInUse: number;
    hasAuthData: boolean;
    hasPreferences: boolean;
  }> {
    // Get bytes in use
    const bytesInUse = await new Promise<number>((resolve) => {
      this.api.local.getBytesInUse(null, (bytes: number | undefined) => {
        resolve(bytes || 0);
      });
    });

    // Check what's stored
    const authState = await this.getAuthState();
    const preferences = await this.getPreferences();

    return {
      bytesInUse,
      hasAuthData: authState !== null,
      hasPreferences: preferences !== null,
    };
  }

  // ========================================
  // Migration Helpers
  // ========================================

  /**
   * Migrate old storage format to new format (if needed)
   * Called on extension update
   */
  static async migrateStorage(): Promise<void> {
    try {
      // Check for old token format (Phase 0 testing)
      const oldToken = await this.api.local.get('jwtToken');

      if (oldToken.jwtToken) {
        console.log('[StorageAdapter] 🔄 Migrating old token format...');

        // Create new auth state
        const authState: AuthState = {
          token: oldToken.jwtToken,
          expiresAt: Date.now() + 15 * 60 * 1000, // Assume 15 min expiry
          userId: '',
          userProfile: null,
        };

        await this.saveAuthState(authState);
        await this.api.local.remove('jwtToken');

        console.log('[StorageAdapter] ✅ Migration complete');
      }
    } catch (error) {
      console.error('[StorageAdapter] ❌ Migration failed:', error);
    }
  }
}
