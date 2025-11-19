import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Playwright Configuration for Phase 2 Upload E2E Tests
 *
 * These tests require:
 * - Backend running at http://localhost:3000 (ytgify-share Rails server)
 * - Test database seeded with test users
 * - Extension built in dist/ folder
 * - Real YouTube videos for GIF creation
 *
 * Run with:
 * - npm run test:e2e:upload           (headless)
 * - npm run test:e2e:upload:headed    (visible browser)
 * - npm run test:e2e:upload:debug     (debug mode)
 */

export default defineConfig({
  testDir: './e2e-upload',
  fullyParallel: false, // Sequential execution (backend state management)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid upload conflicts

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'test-results/html-upload',
        open: 'never',
      },
    ],
    [
      'junit',
      {
        outputFile: 'test-results/junit-upload.xml',
      },
    ],
    process.env.CI ? ['github'] : null,
  ].filter(Boolean) as any,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 60000, // Match mock tests - GIF processing needs time
    navigationTimeout: 30000,
  },

  // Note: Extension loading handled by fixtures.ts via launchPersistentContext
  // Do NOT add projects section - it conflicts with fixture-based browser launch

  timeout: 120000, // 2 minutes per test (upload takes time)
  expect: {
    timeout: 15000,
  },

  outputDir: 'test-results/artifacts-upload',
  globalSetup: path.resolve(__dirname, './e2e-upload/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './e2e-upload/global-teardown.ts'),
});
