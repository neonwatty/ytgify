import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Playwright Configuration for Auth E2E Tests
 *
 * These tests require:
 * - Backend running at http://localhost:3000
 * - Test user: testauth@example.com / password123
 * - Extension built in dist/ folder
 */

export default defineConfig({
  testDir: './e2e-auth',
  fullyParallel: false, // Sequential execution (shared test user)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid auth conflicts

  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'test-results/html-auth',
      open: 'never'
    }],
    ['junit', {
      outputFile: 'test-results/junit-auth.xml'
    }],
    process.env.CI ? ['github'] : null,
  ].filter(Boolean) as any,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chrome-extension-auth',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 800, height: 600 },
        launchOptions: {
          slowMo: process.env.CI ? 0 : 100,
          args: [
            `--disable-extensions-except=${path.join(__dirname, '..', '..', 'dist')}`,
            `--load-extension=${path.join(__dirname, '..', '..', 'dist')}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
          ],
        },
      },
    },
  ],

  timeout: 60000, // 1 minute per test
  expect: {
    timeout: 10000,
  },

  outputDir: 'test-results/artifacts-auth',
  globalSetup: path.resolve(__dirname, './e2e-auth/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './e2e-auth/global-teardown.ts'),
});
