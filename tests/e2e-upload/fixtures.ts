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

    await use(extensionId);
  },

  cleanContext: async ({ context, extensionId }, use) => {
    // Clear storage before each test
    await clearExtensionStorage(context);
    console.log('[Fixtures] ✓ Storage cleared for test');

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
});

export { expect } from '@playwright/test';
