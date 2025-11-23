/**
 * Playwright Fixtures for Upload E2E Tests
 *
 * Provides:
 * - Extension context with launchPersistentContext
 * - Extension ID extraction
 * - Backend client for API interactions
 * - Pre-test cleanup (clear storage)
 * - Test user creation
 */

import { test as base, chromium, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { clearExtensionStorage } from '../e2e-auth/helpers/storage-helpers';
import { BackendClient } from '../e2e-auth/helpers/backend-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TestUser {
  email: string;
  username: string;
  password: string;
}

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  cleanContext: BrowserContext;
  backend: BackendClient;
  testUser: TestUser;
  mockServerUrl: string;
  useRealBackend: boolean;
}>({
  // Override context fixture to load extension
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '..', '..', 'dist');
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const userDataDir = path.join(__dirname, '..', 'test-user-data-' + uniqueId);

    // Check if --headed flag was passed or HEADED env var is set
    const isHeaded = process.argv.includes('--headed') || process.env.HEADED === 'true';
    const isDebug = process.argv.includes('--debug');

    // Determine headless mode: headless by default, unless headed/debug flags passed
    const shouldBeHeadless = !isHeaded && !isDebug;

    if (!shouldBeHeadless) {
      console.log('[Fixtures] Running in HEADED mode (browser will be visible)');
    }

    const launchOptions: any = {
      channel: 'chromium',
      headless: shouldBeHeadless,
      devtools: !shouldBeHeadless, // Open DevTools in headed mode
      slowMo: !shouldBeHeadless ? 500 : 0, // Slow down actions in headed mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      viewport: { width: 1280, height: 900 }, // Increased to fit wizard UI (needs ~780px)
    };

    const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Wait for service worker with exponential backoff
    let extensionId = '';
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(1.5, retries)));
      const serviceWorkers = context.serviceWorkers();
      if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        const match = url.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
          console.log(`[Fixtures] ✓ Extension ID: ${extensionId}`);
          break;
        }
      }
      retries++;
    }

    if (!extensionId) {
      throw new Error('[Fixtures] Failed to get extension ID after 5 retries');
    }

    // Enable button visibility IMMEDIATELY after getting extension ID
    // This ensures it's set before ANY content script loads
    const setupPage = await context.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await setupPage.waitForTimeout(300);

    await setupPage.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ buttonVisibility: true }, () => {
          resolve();
        });
      });
    });

    const result = await setupPage.evaluate(() => {
      return new Promise<any>((resolve) => {
        chrome.storage.sync.get(['buttonVisibility'], (result) => {
          resolve(result);
        });
      });
    });

    console.log('[Fixtures] ✓ Button visibility preset:', result);
    await setupPage.close();

    await use(extensionId);
  },

  cleanContext: async ({ context, extensionId }, use) => {
    // Clear storage before each test, but preserve buttonVisibility
    // (Upload tests need button injection, which depends on buttonVisibility preference)
    const serviceWorker = context.serviceWorkers()[0];

    if (serviceWorker) {
      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          // Save buttonVisibility before clearing
          chrome.storage.sync.get(['buttonVisibility'], (syncData) => {
            const savedButtonVisibility = syncData.buttonVisibility;

            // Clear both storages
            chrome.storage.local.clear(() => {
              chrome.storage.sync.clear(() => {
                // Restore buttonVisibility if it was set
                if (savedButtonVisibility !== undefined) {
                  chrome.storage.sync.set({ buttonVisibility: savedButtonVisibility }, () => {
                    resolve();
                  });
                } else {
                  resolve();
                }
              });
            });
          });
        });
      });
      console.log('[Fixtures] ✓ Storage cleared (buttonVisibility preserved)');
    }

    await use(context);
  },

  backend: async ({}, use) => {
    const backendURL = process.env.BACKEND_URL || 'http://localhost:3000';
    const client = new BackendClient(backendURL);
    await use(client);
  },

  testUser: async ({ backend }, use) => {
    const user: TestUser = {
      email: `test-upload-${Date.now()}@example.com`,
      username: `testupload${Date.now()}`,
      password: 'password123',
    };

    // Ensure user exists in backend
    await backend.ensureTestUser(user);

    await use(user);
  },

  mockServerUrl: async ({}, use) => {
    // Mock server URL from global setup (available in process.env)
    const url = process.env.MOCK_SERVER_URL || '';
    await use(url);
  },

  useRealBackend: async ({}, use) => {
    // When true, tests will use real backend instead of route interception
    // Set REAL_BACKEND=true environment variable to enable
    const useReal = process.env.REAL_BACKEND === 'true';
    if (useReal) {
      console.log('[Fixtures] ⚡ REAL BACKEND MODE - Using actual Rails API at http://localhost:3000');
      console.log('[Fixtures] ⚠️  Ensure Rails server is running: cd ../ytgify-share && bin/rails server');
    }
    await use(useReal);
  },
});

export { expect } from '@playwright/test';
