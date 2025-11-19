/**
 * Global Teardown for Auth E2E Tests
 *
 * Runs once after all tests complete
 * Currently just logs completion
 * Future: Could clean up test data if needed
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Running auth E2E global teardown...\n');

  // Optional: Clean up test data
  // For now, we keep test user in database for debugging

  console.log('✅ Auth E2E global teardown complete!\n');
}

export default globalTeardown;
