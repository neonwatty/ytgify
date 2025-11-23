/**
 * E2E Test: Token Refresh Debug
 *
 * This test specifically debugs the token refresh issue where:
 * - User logs in and gets a valid token
 * - Token expires after some time
 * - User attempts to upload a GIF
 * - Token should automatically refresh
 * - Upload should succeed
 *
 * Run with: npm run test:e2e:upload -- --headed tests/e2e-upload/token-refresh-debug.spec.ts
 */

import { test, expect } from './fixtures';
import type { Page, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Short "Me at the zoo" video
const API_BASE_URL = 'http://localhost:3000';

// Test user credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123';

interface AuthState {
  token: string;
  expiresAt: number;
  userId: string;
  userProfile: {
    id: string;
    email: string;
    username: string;
  } | null;
}

interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

/**
 * Get auth state from extension storage
 */
async function getAuthState(context: BrowserContext): Promise<AuthState | null> {
  const [page] = context.pages();
  return await page.evaluate(() => {
    return new Promise<AuthState | null>((resolve) => {
      chrome.storage.local.get(['authState'], (result) => {
        resolve(result.authState || null);
      });
    });
  });
}

/**
 * Set auth state in extension storage (for manual token expiration)
 */
async function setAuthState(context: BrowserContext, authState: AuthState): Promise<void> {
  const [page] = context.pages();
  await page.evaluate((state) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ authState: state }, () => {
        resolve();
      });
    });
  }, authState);
}

/**
 * Expire the token by setting expiresAt to past timestamp
 */
async function expireToken(context: BrowserContext): Promise<void> {
  const authState = await getAuthState(context);
  if (!authState) {
    throw new Error('No auth state to expire');
  }

  // Set expiration to 1 minute ago
  const expiredState: AuthState = {
    ...authState,
    expiresAt: Date.now() - 60 * 1000,
  };

  await setAuthState(context, expiredState);
  console.log('[Test] ⏰ Token expired manually');
}

/**
 * Set token to expire in N minutes (for proactive refresh testing)
 */
async function setTokenExpiry(context: BrowserContext, minutesFromNow: number): Promise<void> {
  const authState = await getAuthState(context);
  if (!authState) {
    throw new Error('No auth state to modify');
  }

  const expiringState: AuthState = {
    ...authState,
    expiresAt: Date.now() + minutesFromNow * 60 * 1000,
  };

  await setAuthState(context, expiringState);
  console.log(`[Test] ⏰ Token set to expire in ${minutesFromNow} minute(s)`);
}

/**
 * Capture console logs for debugging
 */
function setupConsoleCapture(page: Page): ConsoleMessage[] {
  const logs: ConsoleMessage[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    // Only capture ApiClient and relevant logs
    if (
      text.includes('[ApiClient]') ||
      text.includes('Token') ||
      text.includes('refresh') ||
      text.includes('expired') ||
      text.includes('auth')
    ) {
      logs.push({
        type: msg.type(),
        text,
        timestamp: Date.now(),
      });
      console.log(`[Console ${msg.type()}] ${text}`);
    }
  });

  return logs;
}

/**
 * Wait for YouTube page to be fully loaded
 */
async function waitForYouTubeReady(page: Page) {
  await page.waitForSelector('video', { timeout: 15000 });
  await page.waitForFunction(
    () => {
      const video = document.querySelector('video');
      return video && video.readyState >= 2; // HAVE_CURRENT_DATA
    },
    { timeout: 15000 }
  );
}

test.describe('Token Refresh Debug Tests', () => {
  test('Scenario 1: Upload with expired token (should auto-refresh)', async ({ context, page, extensionId, useRealBackend }) => {
    // Skip: Manual debugging test using outdated web UI flows
    // These tests were designed for manual verification with headed browser
    // TODO: Refactor to use extension popup auth instead of Rails web UI
    test.skip();
    return;

    const consoleLogs = setupConsoleCapture(page);

    // Step 1: Register/Login
    console.log('\n[Test] Step 1: Login to get initial token');
    await page.goto(`${API_BASE_URL}/users/sign_up`);
    await page.fill('input[name="user[email]"]', TEST_EMAIL);
    await page.fill('input[name="user[username]"]', `testuser_${Date.now()}`);
    await page.fill('input[name="user[password]"]', TEST_PASSWORD);
    await page.fill('input[name="user[password_confirmation]"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Step 2: Open extension popup to trigger login via extension
    console.log('\n[Test] Step 2: Open extension popup');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(2000);

    // Login via popup if needed
    const loginButton = await popupPage.$('button:has-text("Login")');
    if (loginButton) {
      await loginButton.click();
      await popupPage.fill('input[type="email"]', TEST_EMAIL);
      await popupPage.fill('input[type="password"]', TEST_PASSWORD);
      await popupPage.click('button[type="submit"]:has-text("Login")');
      await popupPage.waitForTimeout(2000);
    }

    // Step 3: Verify we have a valid token
    console.log('\n[Test] Step 3: Verify initial auth state');
    const initialAuthState = await getAuthState(context);
    expect(initialAuthState).not.toBeNull();
    expect(initialAuthState?.token).toBeTruthy();
    console.log('[Test] ✅ Initial token received');
    console.log('[Test] Token expires at:', new Date(initialAuthState!.expiresAt).toISOString());

    // Step 4: Manually expire the token
    console.log('\n[Test] Step 4: Manually expire token');
    await expireToken(context);

    const expiredAuthState = await getAuthState(context);
    expect(expiredAuthState?.expiresAt).toBeLessThan(Date.now());
    console.log('[Test] ✅ Token expired (expiresAt in past)');

    // Step 5: Navigate to YouTube
    console.log('\n[Test] Step 5: Navigate to YouTube');
    await page.goto(TEST_VIDEO_URL);
    await waitForYouTubeReady(page);
    console.log('[Test] ✅ YouTube page ready');

    // Step 6: Create a GIF (this will trigger overlay and wizard)
    console.log('\n[Test] Step 6: Create GIF');
    const video = await page.locator('video').first();
    await video.click(); // Play video
    await page.waitForTimeout(2000);

    // Open wizard via keyboard shortcut (Ctrl+Shift+G)
    await page.keyboard.press('Control+Shift+G');
    await page.waitForTimeout(1000);

    // Check if wizard opened
    const wizard = await page.locator('[data-testid="gif-wizard"]').count();
    if (wizard === 0) {
      console.log('[Test] ⚠️ Wizard did not open via shortcut, trying button click');
      const createButton = await page.locator('button:has-text("Create GIF")').first();
      await createButton.click();
    }

    await page.waitForTimeout(2000);

    // Proceed with quick capture defaults
    const quickCaptureButton = await page.locator('button:has-text("Quick Capture")').first();
    if (await quickCaptureButton.isVisible()) {
      await quickCaptureButton.click();
      await page.waitForTimeout(1000);
    }

    // Skip text overlay
    const skipTextButton = await page.locator('button:has-text("Skip")').first();
    if (await skipTextButton.isVisible()) {
      await skipTextButton.click();
      await page.waitForTimeout(2000);
    }

    // Wait for GIF processing to complete
    await page.waitForSelector('text=Processing complete', { timeout: 60000 });
    console.log('[Test] ✅ GIF created successfully');

    // Step 7: Upload to cloud (THIS IS THE CRITICAL STEP)
    console.log('\n[Test] Step 7: Upload GIF with expired token');
    console.log('[Test] 🔍 This should trigger automatic token refresh...');

    // Clear previous console logs for clarity
    consoleLogs.length = 0;

    const uploadButton = await page.locator('button:has-text("Upload to Cloud")').first();
    await uploadButton.click();

    // Wait and capture console logs
    await page.waitForTimeout(5000);

    // Step 8: Analyze console logs
    console.log('\n[Test] Step 8: Analyzing console logs');
    console.log('[Test] Captured logs:');
    consoleLogs.forEach((log, i) => {
      console.log(`  ${i + 1}. [${log.type}] ${log.text}`);
    });

    // Check for expected log messages
    const hasExpiredLog = consoleLogs.some((log) => log.text.includes('Token expired, attempting refresh'));
    const hasRefreshSuccessLog = consoleLogs.some((log) => log.text.includes('Token refreshed successfully'));
    const hasUploadSuccessLog = consoleLogs.some((log) => log.text.includes('GIF uploaded successfully'));

    console.log('\n[Test] Log Analysis:');
    console.log(`  - Token expired detected: ${hasExpiredLog ? '✅' : '❌'}`);
    console.log(`  - Token refresh success: ${hasRefreshSuccessLog ? '✅' : '❌'}`);
    console.log(`  - Upload success: ${hasUploadSuccessLog ? '✅' : '❌'}`);

    // Step 9: Verify final auth state
    console.log('\n[Test] Step 9: Verify final auth state');
    const finalAuthState = await getAuthState(context);
    expect(finalAuthState).not.toBeNull();

    if (finalAuthState) {
      console.log('[Test] Final token:', finalAuthState.token.substring(0, 20) + '...');
      console.log('[Test] Final expiresAt:', new Date(finalAuthState.expiresAt).toISOString());
      console.log('[Test] Token is valid:', finalAuthState.expiresAt > Date.now() ? '✅' : '❌');

      // Token should be refreshed (different from initial token)
      expect(finalAuthState.token).not.toBe(initialAuthState?.token);
      expect(finalAuthState.expiresAt).toBeGreaterThan(Date.now());
    }

    // Step 10: Verify upload succeeded
    await page.waitForSelector('text=Uploaded successfully', { timeout: 10000 });
    console.log('[Test] ✅ Upload confirmed successful');

    // Final assertions
    expect(hasExpiredLog).toBe(true);
    expect(hasRefreshSuccessLog).toBe(true);
    expect(hasUploadSuccessLog).toBe(true);
  });

  test('Scenario 2: Upload with token expiring soon (proactive refresh)', async ({ context, page, extensionId, useRealBackend }) => {
    // Skip: Manual debugging test using outdated web UI flows
    // These tests were designed for manual verification with headed browser
    // TODO: Refactor to use extension popup auth instead of Rails web UI
    test.skip();
    return;

    const consoleLogs = setupConsoleCapture(page);

    // Login and get token (same as Scenario 1)
    console.log('\n[Test] Step 1: Login to get initial token');
    await page.goto(`${API_BASE_URL}/users/sign_up`);
    await page.fill('input[name="user[email]"]', `test_${Date.now()}@example.com`);
    await page.fill('input[name="user[username]"]', `testuser_${Date.now()}`);
    await page.fill('input[name="user[password]"]', TEST_PASSWORD);
    await page.fill('input[name="user[password_confirmation]"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(2000);

    const loginButton = await popupPage.$('button:has-text("Login")');
    if (loginButton) {
      await loginButton.click();
      await popupPage.fill('input[type="email"]', TEST_EMAIL);
      await popupPage.fill('input[type="password"]', TEST_PASSWORD);
      await popupPage.click('button[type="submit"]:has-text("Login")');
      await popupPage.waitForTimeout(2000);
    }

    const initialAuthState = await getAuthState(context);
    expect(initialAuthState).not.toBeNull();

    // Set token to expire in 3 minutes (should trigger proactive refresh at 5-min threshold)
    console.log('\n[Test] Step 2: Set token to expire in 3 minutes');
    await setTokenExpiry(context, 3);

    const modifiedAuthState = await getAuthState(context);
    const minutesUntilExpiry = (modifiedAuthState!.expiresAt - Date.now()) / 1000 / 60;
    console.log(`[Test] ✅ Token expires in ${minutesUntilExpiry.toFixed(1)} minutes`);

    // Navigate to YouTube and create GIF
    console.log('\n[Test] Step 3: Create GIF');
    await page.goto(TEST_VIDEO_URL);
    await waitForYouTubeReady(page);

    await page.keyboard.press('Control+Shift+G');
    await page.waitForTimeout(2000);

    const quickCaptureButton = await page.locator('button:has-text("Quick Capture")').first();
    if (await quickCaptureButton.isVisible()) {
      await quickCaptureButton.click();
      await page.waitForTimeout(1000);
    }

    const skipTextButton = await page.locator('button:has-text("Skip")').first();
    if (await skipTextButton.isVisible()) {
      await skipTextButton.click();
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector('text=Processing complete', { timeout: 60000 });

    // Upload (should trigger proactive refresh)
    console.log('\n[Test] Step 4: Upload with expiring token');
    consoleLogs.length = 0;

    const uploadButton = await page.locator('button:has-text("Upload to Cloud")').first();
    await uploadButton.click();
    await page.waitForTimeout(5000);

    // Check logs
    console.log('\n[Test] Step 5: Analyzing console logs');
    const hasProactiveRefreshLog = consoleLogs.some((log) =>
      log.text.includes('Token expires in') && log.text.includes('minute(s), refreshing proactively')
    );
    const hasRefreshSuccessLog = consoleLogs.some((log) => log.text.includes('Token refreshed successfully'));

    console.log(`  - Proactive refresh triggered: ${hasProactiveRefreshLog ? '✅' : '❌'}`);
    console.log(`  - Token refresh success: ${hasRefreshSuccessLog ? '✅' : '❌'}`);

    expect(hasProactiveRefreshLog).toBe(true);
    expect(hasRefreshSuccessLog).toBe(true);

    await page.waitForSelector('text=Uploaded successfully', { timeout: 10000 });
    console.log('[Test] ✅ Upload successful with proactive refresh');
  });
});
