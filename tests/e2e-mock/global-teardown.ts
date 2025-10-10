import { FullConfig } from '@playwright/test';
import { getMockServer } from './helpers/mock-server';

/**
 * Global teardown for mock E2E tests
 * Stops the mock YouTube server
 */
async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Running mock E2E global teardown...\n');

  try {
    // Stop mock YouTube server if it's running
    const mockServer = getMockServer();
    if (mockServer && mockServer.isRunning()) {
      console.log('🛑 Stopping mock YouTube server...');
      await mockServer.stop();
      console.log('✅ Mock YouTube server stopped\n');
    }
  } catch (error) {
    console.error('⚠️  Error during teardown:', error);
    // Don't fail the build if teardown has issues
  }

  console.log('✅ Mock E2E global teardown complete\n');
}

export default globalTeardown;
