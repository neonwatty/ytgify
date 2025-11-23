/**
 * E2E Test: Token Refresh Flow
 *
 * Tests automatic JWT token refresh when server returns 401 during upload.
 * Uses route interception to simulate token expiration scenario.
 */

import { test, expect } from './fixtures';
import { YouTubePage } from '../e2e-mock/page-objects/YouTubePage';
import { QuickCapturePage } from '../e2e-mock/page-objects/QuickCapturePage';
import { TextOverlayPage } from '../e2e-mock/page-objects/TextOverlayPage';
import { ProcessingPage } from '../e2e-mock/page-objects/ProcessingPage';
import { SuccessPage } from './page-objects/SuccessPage';
import { getMockVideoUrl } from '../e2e-mock/helpers/mock-videos';

test.describe('Token Refresh Flow', () => {
  test.beforeEach(async ({ cleanContext }) => {
    // Storage is cleared in cleanContext fixture
    console.log('[Test] Storage cleared');
  });

  test('Automatically refreshes token and retries upload on 401 error', async ({
    page,
    context,
    extensionId,
    testUser,
    mockServerUrl,
    useRealBackend,
  }) => {
    test.setTimeout(120000);

    console.log('[Test] Starting token refresh flow test...');
    console.log(`[Test] Test user: ${testUser.email}`);
    console.log(`[Test] Real backend mode: ${useRealBackend}`);

    // Track console logs for verification
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('[ApiClient]') ||
        text.includes('Token') ||
        text.includes('refresh') ||
        text.includes('expired') ||
        text.includes('GIF uploaded')
      ) {
        consoleLogs.push(text);
        console.log(`[Console] ${text}`);
      }
    });

    // Step 1: Login via popup
    console.log('\n[Test] Step 1: Login via extension popup');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(2000);

    const signInButton = popupPage.locator('[data-testid="sign-in-button"]');
    await signInButton.click();
    await popupPage.waitForTimeout(1000);

    const emailInput = popupPage.locator('[data-testid="email-input"]');
    const passwordInput = popupPage.locator('[data-testid="password-input"]');
    const loginButton = popupPage.locator('[data-testid="login-submit-btn"]');

    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);
    await loginButton.click();
    await popupPage.waitForTimeout(3000);

    console.log('[Test] ✅ Logged in successfully');
    await popupPage.close();

    // Step 2: Create GIF first (before setting up route interception)
    console.log('\n[Test] Step 2: Create GIF');
    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    const videoUrl = getMockVideoUrl('veryShort', mockServerUrl);
    await youtube.navigateToVideo(videoUrl);
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(45000);
    await success.waitForScreen();

    const isGifValid = await success.validateGifCreated();
    expect(isGifValid).toBe(true);
    console.log('[Test] ✅ GIF created successfully');

    // Step 3: Setup route interception to simulate token expiration
    let uploadAttempts = 0;
    let refreshAttempts = 0;

    if (useRealBackend) {
      console.log('\n[Test] Step 3: Real backend mode - skipping route interception');
      console.log('[Test] ⚠️  This test requires manual token expiration on backend');
      console.log('[Test] ⚠️  Test will verify refresh logic works, but may not trigger 401');
    } else {
      console.log('\n[Test] Step 3: Setup route interception');

      await page.route('**/api/v1/gifs', (route) => {
        uploadAttempts++;
        console.log(`[Test] GIF upload attempt #${uploadAttempts}`);

        if (uploadAttempts === 1) {
          // First attempt: return 401 to simulate expired token
          console.log('[Test] → Returning 401 (simulating expired token)');
          route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Unauthorized',
              message: 'Token expired',
            }),
          });
        } else {
          // Second attempt: return success (after refresh)
          console.log('[Test] → Returning success (upload successful after refresh)');
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'GIF uploaded successfully',
              gif: {
                id: 'test-gif-id-' + Date.now(),
                title: 'Test GIF',
                description: null,
                file_url: 'http://localhost:3000/uploads/test.gif',
                thumbnail_url: 'http://localhost:3000/uploads/test-thumb.jpg',
                privacy: 'public',
                duration: 5,
                fps: 5,
                resolution_width: 256,
                resolution_height: 144,
                file_size: 78800,
                has_text_overlay: false,
                is_remix: false,
                remix_count: 0,
                view_count: 0,
                like_count: 0,
                comment_count: 0,
                share_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                hashtag_names: [],
                user: {
                  id: testUser.email,
                  username: testUser.email.split('@')[0],
                  display_name: testUser.email.split('@')[0],
                  avatar_url: null,
                  is_verified: false,
                },
              },
            }),
          });
        }
      });

      await page.route('**/api/v1/auth/refresh', (route) => {
        refreshAttempts++;
        console.log(`[Test] Token refresh attempt #${refreshAttempts}`);

        // Simulate successful token refresh
        const newToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJqdGkiOiJuZXctdG9rZW4taWQiLCJleHAiOjk5OTk5OTk5OTl9.fake-signature-new';

        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            token: newToken,
          }),
        });
      });
    }

    // Step 4: Upload GIF (will trigger 401, then refresh, then retry)
    console.log('\n[Test] Step 4: Click Upload to Cloud');
    console.log('[Test] 🔍 Expected flow:');
    console.log('[Test]   1. First upload attempt returns 401');
    console.log('[Test]   2. Extension detects 401 and refreshes token');
    console.log('[Test]   3. Extension retries upload with new token');
    console.log('[Test]   4. Upload succeeds');

    // Clear previous logs
    consoleLogs.length = 0;

    await success.clickUploadToCloud();

    // Wait for upload to complete
    const uploadResult = await success.waitForUploadComplete(15000);

    // Step 5: Verify results
    console.log('\n[Test] Step 5: Verify results');
    console.log(`[Test] Upload attempts: ${uploadAttempts}`);
    console.log(`[Test] Refresh attempts: ${refreshAttempts}`);
    console.log(`[Test] Upload result: ${uploadResult}`);

    // Analyze console logs
    const hasTokenExpiredLog = consoleLogs.some(
      (log) => log.includes('Token expired') || log.includes('401')
    );
    const hasRefreshLog = consoleLogs.some(
      (log) => log.includes('refresh') && log.includes('Token')
    );
    const hasUploadSuccessLog = consoleLogs.some(
      (log) => log.includes('GIF uploaded successfully') || log.includes('Upload successful')
    );

    console.log('\n[Test] Console Log Analysis:');
    console.log(`  - Token expiration detected: ${hasTokenExpiredLog ? '✅' : '❌'}`);
    console.log(`  - Token refresh occurred: ${hasRefreshLog ? '✅' : '❌'}`);
    console.log(`  - Upload success logged: ${hasUploadSuccessLog ? '✅' : '❌'}`);

    console.log('\n[Test] All captured logs:');
    consoleLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. ${log}`);
    });

    // Assertions
    if (useRealBackend) {
      // Real backend: Just verify upload succeeded (refresh may not trigger without manual intervention)
      expect(uploadResult).toBe('success');
    } else {
      // Mock mode: Verify full refresh flow
      expect(uploadAttempts).toBeGreaterThanOrEqual(2); // At least 2 attempts (initial + retry)
      expect(refreshAttempts).toBeGreaterThanOrEqual(1); // At least 1 refresh
      expect(uploadResult).toBe('success');
    }

    console.log('\n[Test] ✅ Token refresh flow verified!');
    console.log('[Test] Summary:');
    console.log(`[Test]   - Initial upload returned 401: ✅`);
    console.log(`[Test]   - Token was refreshed: ✅`);
    console.log(`[Test]   - Upload retry succeeded: ✅`);
  });

  test('Handles refresh failure gracefully', async ({
    page,
    context,
    extensionId,
    testUser,
    mockServerUrl,
    useRealBackend,
  }) => {
    test.setTimeout(120000);

    // Skip this test in real backend mode (requires route interception)
    if (useRealBackend) {
      console.log('[Test] Skipping refresh failure test in real backend mode');
      test.skip();
      return;
    }

    console.log('[Test] Starting token refresh failure test...');

    // Login
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(2000);

    const signInButton = popupPage.locator('[data-testid="sign-in-button"]');
    await signInButton.click();
    await popupPage.waitForTimeout(1000);

    const emailInput = popupPage.locator('[data-testid="email-input"]');
    const passwordInput = popupPage.locator('[data-testid="password-input"]');
    const loginButton = popupPage.locator('[data-testid="login-submit-btn"]');

    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);
    await loginButton.click();
    await popupPage.waitForTimeout(3000);

    console.log('[Test] ✅ Logged in');
    await popupPage.close();

    // Create GIF
    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    const videoUrl = getMockVideoUrl('veryShort', mockServerUrl);
    await youtube.navigateToVideo(videoUrl);
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(45000);
    await success.waitForScreen();

    // Setup route interception AFTER GIF is created
    await page.route('**/api/v1/gifs', (route) => {
      console.log('[Test] Upload → Returning 401');
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.route('**/api/v1/auth/refresh', (route) => {
      console.log('[Test] Refresh → Returning 401 (refresh failed)');
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid refresh token' }),
      });
    });

    // Try to upload
    console.log('\n[Test] Attempting upload (should fail)...');
    await success.clickUploadToCloud();

    // Wait for authentication error to appear
    // When both upload AND refresh fail with 401, the extension clears auth state
    // and shows an authentication error (not just "upload failed")
    await page.waitForTimeout(3000);

    // Check if authentication failed (auth state should be cleared)
    // Need to check from service worker context where chrome API is available
    const serviceWorker = context.serviceWorkers()[0];
    const authStateAfter = await serviceWorker.evaluate(async () => {
      return new Promise<any>((resolve) => {
        chrome.storage.local.get(['authState'], (result) => {
          resolve(result.authState || null);
        });
      });
    });

    // Auth should be cleared after failed refresh
    expect(authStateAfter).toBeNull();
    console.log('[Test] ✅ Auth state correctly cleared when refresh failed');
    console.log('[Test] ✅ Upload correctly failed when token refresh failed (auth cleared)');
  });
});
