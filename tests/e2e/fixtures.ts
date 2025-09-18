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
    const userDataDir = path.join(__dirname, '..', 'test-user-data-' + Date.now());

    // Check if --headed flag was passed or CI environment
    const isHeaded = process.argv.includes('--headed');
    const isCI = process.env.CI === 'true';

    // IMPORTANT: Chrome extensions require GUI mode to function properly
    // Headless Chrome does not support extensions in the traditional headless mode
    // For CI/headless environments, use Xvfb (virtual framebuffer) on Linux
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions always require non-headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        // Minimize window for "headless-like" behavior when not explicitly headed
        ...(!isHeaded && !isCI ? ['--window-position=-2400,-2400', '--window-size=1,1'] : []),
      ],
      viewport: { width: 1280, height: 720 },
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID from background service worker
    let extensionId = '';

    // Wait for service worker to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const url = serviceWorkers[0].url();
      const match = url.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) {
        extensionId = match[1];
      }
    }

    await use(extensionId);
  },
});

export { expect } from '@playwright/test';