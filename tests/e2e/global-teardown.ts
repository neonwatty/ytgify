import { FullConfig } from '@playwright/test';

/**
 * Global teardown for E2E tests
 * Cleanup after all tests complete
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global teardown...');

  // Could add cleanup logic here if needed
  // For now, we keep test artifacts for debugging

  console.log('✅ Global teardown complete');
}

export default globalTeardown;