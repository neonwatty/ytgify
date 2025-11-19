/**
 * Global Setup for Auth E2E Tests
 *
 * Runs once before all tests:
 * 1. Check if backend is running
 * 2. Ensure test user exists
 * 3. Verify extension is built
 * 4. Create test result directories
 */

import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { BackendClient } from './helpers/backend-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function globalSetup(config: FullConfig) {
  console.log('\n🔧 Running auth E2E global setup...\n');

  const backendUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const backendClient = new BackendClient(backendUrl);

  // Step 1: Check if backend is running
  console.log(`📡 Checking backend at: ${backendUrl}`);
  try {
    const isHealthy = await backendClient.healthCheck();
    if (!isHealthy) {
      throw new Error('Backend health check failed');
    }
    console.log(`✅ Backend is running\n`);
  } catch (error) {
    console.error(`\n❌ Backend not accessible at ${backendUrl}\n`);
    console.error('   Please start the backend:');
    console.error('   cd ytgify-share && bin/dev\n');
    throw error;
  }

  // Step 2: Ensure test user exists
  console.log('👤 Ensuring test user exists...');
  try {
    await backendClient.ensureTestUser({
      email: 'testauth@example.com',
      username: 'testauth',
      password: 'password123',
    });
    console.log('✅ Test user ready\n');
  } catch (error) {
    console.error('❌ Failed to create test user:', error);
    throw error;
  }

  // Step 3: Verify extension is built
  console.log('📦 Checking extension build...');
  const distPath = path.join(__dirname, '..', '..', 'dist');
  const manifestPath = path.join(distPath, 'manifest.json');

  if (!fs.existsSync(distPath) || !fs.existsSync(manifestPath)) {
    console.log('   Extension not built, building now...');
    try {
      execSync('npm run build', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', '..'),
      });
      console.log('✅ Extension built\n');
    } catch (error) {
      console.error('❌ Failed to build extension:', error);
      throw error;
    }
  } else {
    console.log('✅ Extension already built\n');
  }

  // Step 4: Create test result directories
  console.log('📁 Creating test result directories...');
  const testResultDirs = [
    path.join(__dirname, '..', 'test-results'),
    path.join(__dirname, '..', 'test-results', 'html-auth'),
    path.join(__dirname, '..', 'test-results', 'artifacts-auth'),
  ];

  for (const dir of testResultDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  console.log('✅ Test result directories ready\n');

  // Summary
  console.log('✅ Auth E2E global setup complete!\n');
  console.log('═══════════════════════════════════════');
  console.log('  Backend:    ', backendUrl);
  console.log('  Extension:  ', distPath);
  console.log('  Test User:   testauth@example.com');
  console.log('  Password:    password123');
  console.log('═══════════════════════════════════════\n');
}

export default globalSetup;
