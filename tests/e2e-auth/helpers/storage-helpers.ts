/**
 * Chrome Storage Helpers for E2E Auth Tests
 *
 * Provides utilities for:
 * - Reading auth state from chrome.storage.local
 * - Clearing extension storage
 * - Manipulating token expiration for testing
 */

import { BrowserContext } from '@playwright/test';

export interface AuthState {
  token: string;
  expiresAt: number;
  userId: string;
  userProfile: {
    id: string;
    email: string;
    username: string;
    bio: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    gifs_count: number;
    follower_count: number;
    following_count: number;
  } | null;
}

/**
 * Get auth state from chrome.storage.local
 */
export async function getAuthStateFromStorage(
  context: BrowserContext,
  extensionId: string
): Promise<AuthState | null> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    throw new Error('[StorageHelper] Service worker not found');
  }

  const authState = await serviceWorker.evaluate(async () => {
    return new Promise((resolve) => {
      chrome.storage.local.get('authState', (result) => {
        resolve(result.authState || null);
      });
    });
  });

  return authState as AuthState | null;
}

/**
 * Set auth state in chrome.storage.local (for testing)
 */
export async function setAuthStateInStorage(
  context: BrowserContext,
  extensionId: string,
  authState: AuthState
): Promise<void> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    throw new Error('[StorageHelper] Service worker not found');
  }

  await serviceWorker.evaluate(async (state) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ authState: state }, () => {
        console.log('[StorageHelper] ✓ Auth state injected into storage');
        resolve();
      });
    });
  }, authState);
}

/**
 * Clear all extension storage (both local and sync)
 */
export async function clearExtensionStorage(context: BrowserContext): Promise<void> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    console.warn('[StorageHelper] Service worker not found, skipping storage clear');
    return;
  }

  await serviceWorker.evaluate(async () => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.clear(() => {
        chrome.storage.sync.clear(() => {
          resolve();
        });
      });
    });
  });

  console.log('[StorageHelper] ✓ Extension storage cleared');
}

/**
 * Set token expiration time (for testing token refresh)
 * @param millisecondsFromNow Time until token expires (e.g., 4 * 60 * 1000 for 4 minutes)
 */
export async function setTokenExpiration(
  context: BrowserContext,
  extensionId: string,
  millisecondsFromNow: number
): Promise<void> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    throw new Error('[StorageHelper] Service worker not found');
  }

  await serviceWorker.evaluate(async (ms) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.get('authState', (result) => {
        const authState = result.authState;
        if (authState) {
          authState.expiresAt = Date.now() + ms;
          chrome.storage.local.set({ authState }, () => {
            console.log(`[StorageHelper] ✓ Token expiration set to ${ms}ms from now`);
            resolve();
          });
        } else {
          console.warn('[StorageHelper] No auth state found to update');
          resolve();
        }
      });
    });
  }, millisecondsFromNow);
}

/**
 * Get all keys from chrome.storage.local (for debugging)
 */
export async function getAllStorageKeys(context: BrowserContext): Promise<string[]> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    return [];
  }

  const keys = await serviceWorker.evaluate(async () => {
    return new Promise<string[]>((resolve) => {
      chrome.storage.local.get(null, (items) => {
        resolve(Object.keys(items));
      });
    });
  });

  return keys as string[];
}

/**
 * Decode JWT token payload (without verification)
 */
export function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('[StorageHelper] Failed to decode JWT:', error);
    return null;
  }
}

/**
 * Wait for auth state to be saved to storage
 * Useful after login to ensure token is persisted
 */
export async function waitForAuthState(
  context: BrowserContext,
  extensionId: string,
  timeoutMs: number = 10000
): Promise<AuthState> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const authState = await getAuthStateFromStorage(context, extensionId);
    if (authState && authState.token) {
      return authState;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('[StorageHelper] Timeout waiting for auth state to be saved');
}
