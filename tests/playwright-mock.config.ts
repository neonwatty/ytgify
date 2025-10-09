import { defineConfig } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright configuration for mock E2E tests
 *
 * These tests run against a local mock YouTube server instead of real YouTube.
 * Benefits:
 * - No external dependencies
 * - Fast and reliable
 * - Can run in CI without rate limiting
 * - Fully parallelizable
 */
export default defineConfig({
  testDir: './e2e-mock',

  // Parallel execution - mock tests can run in parallel!
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // Retries
  retries: process.env.CI ? 2 : 1,

  // Workers - more than real YouTube tests since no rate limiting
  workers: process.env.CI ? 3 : 2,

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results/html-mock', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit-mock.xml' }],
    ...(process.env.CI ? [['github'] as any] : [])
  ],

  // Test execution settings
  use: {
    // Trace and screenshots
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Timeouts - faster than real YouTube since mock is local
    actionTimeout: 60000, // 60 seconds for actions (GIF processing needs more time)
    navigationTimeout: 15000, // 15 seconds for navigation
  },

  // Global timeouts
  timeout: 60000, // 1 minute per test (faster than real YouTube tests)
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },

  // Output directory for test artifacts
  outputDir: 'test-results/artifacts-mock',

  // Global setup and teardown
  globalSetup: path.resolve(__dirname, './e2e-mock/global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './e2e-mock/global-teardown.ts'),

  // Test match patterns
  testMatch: '**/*.spec.ts',

  // Ignore patterns
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/test-results/**',
    '**/test-user-data/**'
  ],
});
