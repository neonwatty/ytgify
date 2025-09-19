import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E test configuration for YouTube GIF Maker Chrome Extension
 * Tests run against real YouTube videos with the extension loaded
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Extension tests should run sequentially for stability
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for extension testing
  reporter: [
    ['list'],
    ['html', { outputFolder: '../test-results/html', open: 'never' }],
    ['junit', { outputFile: '../test-results/junit.xml' }],
    process.env.CI ? ['github'] : null,
  ].filter(Boolean) as any,

  use: {
    baseURL: 'https://www.youtube.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000, // Increased to 30s for parallel execution
    navigationTimeout: 45000, // Increased to 45s for parallel execution
  },

  projects: [
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          slowMo: process.env.CI ? 0 : 100,
          args: [
            `--disable-extensions-except=${path.join(__dirname, '..', '..', 'dist')}`,
            `--load-extension=${path.join(__dirname, '..', '..', 'dist')}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
        contextOptions: {
          // Allow extension to work properly
          ignoreHTTPSErrors: true,
          permissions: ['clipboard-read', 'clipboard-write'],
        },
      },
    },
  ],

  // Timeout configurations
  timeout: 90000, // 1.5 minutes per test
  expect: {
    timeout: 15000, // 15 seconds for assertions
  },

  // Output folder for test artifacts
  outputDir: 'test-results/artifacts',

  // Global setup/teardown
  globalSetup: path.resolve(__dirname, './e2e/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './e2e/global-teardown.ts'),
});