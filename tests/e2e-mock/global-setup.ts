import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { MockYouTubeServer } from './helpers/mock-server';
import { getRequiredVideoFiles } from './helpers/mock-videos';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mockServer: MockYouTubeServer | null = null;

/**
 * Global setup for mock E2E tests
 * 1. Build extension if needed
 * 2. Start mock YouTube server
 * 3. Verify test video files exist
 */
async function globalSetup(config: FullConfig) {
  console.log('\n🔧 Running mock E2E global setup...\n');

  // Step 1: Ensure extension is built
  const distPath = path.join(__dirname, '..', '..', 'dist');
  if (!fs.existsSync(distPath)) {
    console.log('📦 Building extension (dist folder not found)...');
    try {
      execSync('npm run build', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..', '..')
      });
      console.log('✅ Extension built successfully\n');
    } catch (error) {
      console.error('❌ Failed to build extension:', error);
      throw error;
    }
  } else {
    const manifestPath = path.join(distPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.log('📦 Building extension (manifest.json not found)...');
      try {
        execSync('npm run build', {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..', '..')
        });
        console.log('✅ Extension built successfully\n');
      } catch (error) {
        console.error('❌ Failed to build extension:', error);
        throw error;
      }
    } else {
      console.log('✅ Extension already built\n');
    }
  }

  // Step 2: Verify test video files (warn if missing, don't fail)
  console.log('🎬 Checking for test video files...');
  const videosPath = path.join(__dirname, 'fixtures', 'videos');
  const requiredFiles = getRequiredVideoFiles();
  const missingFiles: string[] = [];

  for (const filename of requiredFiles) {
    const videoPath = path.join(videosPath, filename);
    if (!fs.existsSync(videoPath)) {
      missingFiles.push(filename);
    }
  }

  if (missingFiles.length > 0) {
    console.warn('⚠️  Warning: Missing test video files:');
    missingFiles.forEach(file => console.warn(`   - ${file}`));
    console.warn('\n   To generate test videos, run:');
    console.warn('   npm run generate:test-videos\n');
    console.warn('   Tests will fail without these files!\n');
  } else {
    console.log('✅ All test video files present\n');
  }

  // Step 3: Create test results directories
  const dirs = [
    path.join(__dirname, '..', 'test-results'),
    path.join(__dirname, '..', 'test-results', 'html-mock'),
    path.join(__dirname, '..', 'test-results', 'artifacts-mock'),
    path.join(__dirname, '..', 'test-results', 'screenshots-mock'),
    path.join(__dirname, '..', 'test-results', 'videos-mock'),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Step 4: Start mock YouTube server
  console.log('🚀 Starting mock YouTube server...');
  try {
    mockServer = new MockYouTubeServer();
    const serverUrl = await mockServer.start();

    // Store server URL in environment for tests to access
    process.env.MOCK_SERVER_URL = serverUrl;

    console.log(`✅ Mock YouTube server started at: ${serverUrl}\n`);
  } catch (error) {
    console.error('❌ Failed to start mock server:', error);
    throw error;
  }

  console.log('✅ Mock E2E global setup complete!\n');
  console.log('═══════════════════════════════════════');
  console.log('  Mock Server:', process.env.MOCK_SERVER_URL);
  console.log('  Extension:  ', distPath);
  console.log('═══════════════════════════════════════\n');
}

export default globalSetup;

// Store server instance for cleanup (though teardown will handle it)
export { mockServer };
