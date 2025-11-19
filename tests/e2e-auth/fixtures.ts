/**
 * Playwright Fixtures for Auth E2E Tests
 *
 * Provides:
 * - Extension context with launchPersistentContext
 * - Extension ID extraction
 * - Pre-test cleanup (clear storage)
 */

import { test as base, chromium, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { clearExtensionStorage } from './helpers/storage-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  cleanContext: BrowserContext;
}>({
  // Override context fixture to load extension
  context: async ({}, use) => {
    const pathToExtension = path.join(__dirname, '..', '..', 'dist');
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const userDataDir = path.join(__dirname, '..', 'test-user-data-' + uniqueId);

    // Check if --headed flag was passed or HEADED env var is set
    const isHeaded = process.argv.includes('--headed') || process.env.HEADED === 'true';
    const isDebug = process.argv.includes('--debug');
    const isCI = process.env.CI === 'true';

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
      viewport: { width: 1280, height: 720 },
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
});

export { expect } from '@playwright/test';
