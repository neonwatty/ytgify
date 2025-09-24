import { test as base, chromium, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Override context fixture to load extension
  context: async ({ }, use) => {
    const pathToExtension = path.join(__dirname, '..', '..', 'dist');
    // Ensure unique user data dir for each worker to prevent profile lock conflicts
    const uniqueId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const userDataDir = path.join(__dirname, '..', 'test-user-data-' + uniqueId);

    // Check if --headed flag was passed
    const isHeaded = process.argv.includes('--headed');
    const isCI = process.env.CI === 'true';

    // Extensions require Playwright's bundled chromium channel
    const launchOptions: any = {
      channel: 'chromium', // Required for extensions to work in headless mode
      headless: false, // Default to headed, will be overridden below if needed
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

    // Enable proper headless mode when requested
    if (process.env.HEADLESS === 'true' || (process.env.CI === 'true' && !isHeaded)) {
      launchOptions.headless = true; // Playwright's chromium channel supports extensions in headless
    } else if (isHeaded) {
      launchOptions.headless = false; // Explicitly set headed mode
    }

    // Allow override for testing different channels (though chromium is required for headless extensions)
    if (process.env.PLAYWRIGHT_CHROMIUM_CHANNEL) {
      launchOptions.channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL;
    }

    const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID from background service worker
    let extensionId = '';

    // Wait for service worker to be ready with exponential backoff
    let retries = 0;
    const maxRetries = 5; // Increased retries
    while (retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(1.5, retries))); // Longer wait
      const serviceWorkers = context.serviceWorkers();
      if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        const match = url.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
          break;
        }
      }
      retries++;
    }

    // Final check after all retries
    if (!extensionId) {
      const serviceWorkers = context.serviceWorkers();
      if (serviceWorkers.length > 0) {
        const url = serviceWorkers[0].url();
        const match = url.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
        }
      }
    }

    await use(extensionId);
  },
});

export { expect } from '@playwright/test';