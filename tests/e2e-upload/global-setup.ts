/**
 * Global Setup for Upload E2E Tests
 *
 * - Starts mock YouTube server
 * - Checks if backend is accessible
 * - Ensures test database is ready
 */

import { BackendClient } from '../e2e-auth/helpers/backend-client';
import { MockYouTubeServer } from '../e2e-mock/helpers/mock-server';

let mockServer: MockYouTubeServer | null = null;

async function globalSetup() {
  // Start mock YouTube server
  console.log('\n🚀 Starting mock YouTube server for upload tests...\n');
  mockServer = new MockYouTubeServer();
  const mockServerUrl = await mockServer.start(); // Returns full URL like http://localhost:56443

  // Store URL for tests
  process.env.MOCK_SERVER_URL = mockServerUrl;

  console.log(`\n✅ Mock YouTube server started at: ${mockServerUrl}\n`);

  // Check backend
  const backendURL = process.env.BACKEND_URL || 'http://localhost:3000';
  console.log(`[Global Setup] Checking backend at ${backendURL}...`);

  const client = new BackendClient(backendURL);
  const isHealthy = await client.healthCheck();

  if (!isHealthy) {
    console.error('[Global Setup] ❌ Backend is not accessible');
    console.error('[Global Setup] Make sure Rails server is running: cd ../ytgify-share && bin/dev');
    throw new Error('Backend not accessible. Start Rails server before running tests.');
  }

  console.log('[Global Setup] ✓ Backend is accessible');
  console.log('[Global Setup] ✓ Ready to run upload E2E tests\n');

  console.log('═══════════════════════════════════════');
  console.log(`  Mock Server: ${mockServerUrl}`);
  console.log(`  Backend API: ${backendURL}`);
  console.log('═══════════════════════════════════════\n');
}

export default globalSetup;
