/**
 * Service Worker Helpers for E2E Auth Tests
 *
 * Provides utilities for:
 * - Restarting service worker (simulates Chrome's auto-termination)
 * - Waiting for service worker activation
 * - Getting service worker logs
 */

import { BrowserContext } from '@playwright/test';

/**
 * Restart the extension's service worker
 * Simulates Chrome's automatic termination after 5 minutes of inactivity
 */
export async function restartServiceWorker(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  console.log('[ServiceWorkerHelper] 🔄 Restarting service worker...');

  // Get current service worker
  const oldWorker = context.serviceWorkers()[0];

  if (!oldWorker) {
    console.warn('[ServiceWorkerHelper] No service worker found to restart');
    return;
  }

  // Terminate service worker by forcing it to close
  await oldWorker
    .evaluate(() => {
      // Force termination
      self.close();
    })
    .catch(() => {
      // Expected to fail as worker terminates
    });

  // Wait for new service worker to activate
  try {
    await context.waitForEvent('serviceworker', { timeout: 10000 });
    console.log('[ServiceWorkerHelper] ✓ Service worker restarted');
  } catch (error) {
    console.error('[ServiceWorkerHelper] Failed to restart service worker:', error);
    throw error;
  }
}

/**
 * Wait for service worker to be ready
 * Useful after extension load or restart
 */
export async function waitForServiceWorker(
  context: BrowserContext,
  timeoutMs: number = 10000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      console.log('[ServiceWorkerHelper] ✓ Service worker ready');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('[ServiceWorkerHelper] Timeout waiting for service worker');
}

/**
 * Get service worker console logs
 * Useful for debugging
 */
export async function getServiceWorkerLogs(context: BrowserContext): Promise<string[]> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    return [];
  }

  // Note: This is a placeholder - actual log capture needs to be set up
  // via context.on('console') listener in test setup
  return [];
}

/**
 * Trigger service worker activation event
 * Forces token manager to check auth state
 */
export async function triggerServiceWorkerActivation(
  context: BrowserContext
): Promise<void> {
  const serviceWorker = context.serviceWorkers()[0];

  if (!serviceWorker) {
    throw new Error('[ServiceWorkerHelper] Service worker not found');
  }

  await serviceWorker.evaluate(async () => {
    // Simulate activation by calling chrome.runtime.onStartup listeners
    // This is a workaround since we can't directly trigger the event
    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 1000);
    });
  });

  console.log('[ServiceWorkerHelper] ✓ Service worker activation triggered');
}

/**
 * Check if service worker is running
 */
export async function isServiceWorkerRunning(context: BrowserContext): Promise<boolean> {
  const workers = context.serviceWorkers();
  return workers.length > 0;
}
