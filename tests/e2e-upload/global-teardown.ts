/**
 * Global Teardown for Upload E2E Tests
 *
 * Cleanup after all tests complete
 */

async function globalTeardown() {
  console.log('\n🧹 Running upload E2E global teardown...\n');

  // Mock server is automatically closed by Playwright's teardown
  // No explicit cleanup needed

  console.log('✅ Upload E2E global teardown complete\n');
}

export default globalTeardown;
