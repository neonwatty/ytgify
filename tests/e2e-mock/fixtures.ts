import { test as base, chromium, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extended test fixtures for mock E2E tests
 * Provides browser context with extension loaded and mock server URL
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  mockServerUrl: string;
}>({
  /**
   * Browser context with Chrome extension loaded
   * Each test gets a fresh context with unique user data directory
   */
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '..', '..', 'dist');
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const userDataDir = path.join(__dirname, 'test-user-data', uniqueId);

    // Check if --headed flag was passed
    const isHeaded = process.argv.includes('--headed');

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: process.env.HEADLESS === 'true' || (process.env.CI === 'true' && !isHeaded),
      channel: 'chromium', // Required for extension support in headless
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
      viewport: { width: 1280, height: 720 },
    });

    await use(context);

    // Cleanup
    await context.close();
  },

  /**
   * Extension ID extracted from loaded extension
   * Waits for service worker to be ready and extracts the extension ID
   */
  extensionId: async ({ context }, use) => {
    let extensionId = '';

    // Wait for service worker with retry logic
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(1.2, retries)));

      const serviceWorkers = context.serviceWorkers();
      if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        const match = url.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
          console.log(`[Mock E2E] Extension loaded with ID: ${extensionId}`);
          break;
        }
      }

      retries++;
    }

    if (!extensionId) {
      console.warn('[Mock E2E] Warning: Extension ID not found after retries');
    }

    await use(extensionId);
  },

  /**
   * Mock server URL from global setup
   * All tests can use this to navigate to mock YouTube pages
   */
  mockServerUrl: async ({}, use) => {
    const url = process.env.MOCK_SERVER_URL;

    if (!url) {
      throw new Error(
        'MOCK_SERVER_URL not found in environment. ' +
        'Make sure global setup has run and started the mock server.'
      );
    }

    console.log(`[Mock E2E] Using mock server at: ${url}`);
    await use(url);
  },
});

export { expect } from '@playwright/test';
