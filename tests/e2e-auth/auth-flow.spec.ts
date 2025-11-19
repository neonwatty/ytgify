/**
 * Auth Flow E2E Tests
 *
 * Tests the complete JWT authentication flow:
 * - Login with valid/invalid credentials
 * - User profile display
 * - Logout
 * - Token persistence
 */

import { test, expect } from './fixtures';
import { PopupPage } from './page-objects/PopupPage';
import { AuthViewPage } from './page-objects/AuthViewPage';
import { UserProfilePage } from './page-objects/UserProfilePage';
import {
  getAuthStateFromStorage,
  clearExtensionStorage,
  decodeJWT,
} from './helpers/storage-helpers';

test.describe('Phase 1: JWT Authentication Flow', () => {
  test.describe('Login Flow', () => {
    test('should successfully login with valid credentials', async ({
      page,
      context,
      extensionId,
      cleanContext,
    }) => {
      test.setTimeout(60000);

      const popup = new PopupPage(page, extensionId);
      const authView = new AuthViewPage(page);
      const profileView = new UserProfilePage(page);

      // Step 1: Open extension popup
      await popup.open();

      // Step 2: Click "Sign In" button
      const signInButton = page.locator('[data-testid="sign-in-button"]');
      await signInButton.waitFor({ state: 'visible', timeout: 5000 });
      await signInButton.click();
      console.log('✓ Sign In button clicked');

      // Step 3: Wait for login form to appear
      await authView.waitForLoginForm();
      const isLoginVisible = await authView.isLoginFormVisible();
      expect(isLoginVisible).toBe(true);
      console.log('✓ Login form visible');

      // Step 4: Fill in credentials and submit
      await authView.login('testauth@example.com', 'password123');

      // Step 5: Wait for profile to appear
      await profileView.waitForProfile();
      console.log('✓ Profile view appeared');

      // Step 6: Verify profile displays correct user
      const username = await profileView.getUsername();
      expect(username).toBe('testauth');
      console.log(`✓ Username correct: ${username}`);

      const email = await profileView.getEmail();
      expect(email).toBe('testauth@example.com');
      console.log(`✓ Email correct: ${email}`);

      // Step 7: Verify auth state in storage
      const authState = await getAuthStateFromStorage(context, extensionId);
      expect(authState).toBeTruthy();
      expect(authState?.token).toBeTruthy();
      expect(authState?.userId).toBeTruthy();
      expect(authState?.userProfile?.email).toBe('testauth@example.com');
      console.log('✓ Auth state saved to storage');

      // Step 8: Verify token is valid JWT
      if (authState && authState.token) {
        const tokenPayload = decodeJWT(authState.token);
        expect(tokenPayload).toBeTruthy();
        expect(tokenPayload.sub).toBe(authState.userId);
        expect(tokenPayload.exp).toBeGreaterThan(Date.now() / 1000);
        console.log('✓ JWT token valid');
      }

      console.log('\n✅ Login test passed!');
    });

    test('should show error with invalid credentials', async ({
      page,
      context,
      extensionId,
      cleanContext,
    }) => {
      test.setTimeout(60000);

      const popup = new PopupPage(page, extensionId);
      const authView = new AuthViewPage(page);

      // Step 1: Open popup and navigate to login form
      await popup.open();
      const signInButton = page.locator('[data-testid="sign-in-button"]');
      await signInButton.click();
      await authView.waitForLoginForm();

      // Step 2: Try to login with wrong password
      await authView.login('testauth@example.com', 'wrongpassword');

      // Step 3: Wait for error message
      await authView.waitForErrorMessage();
      const errorText = await authView.getErrorMessage();

      expect(errorText).toContain('incorrect');
      console.log(`✓ Error message shown: ${errorText}`);

      // Step 4: Verify auth state is NOT saved
      const authState = await getAuthStateFromStorage(context, extensionId);
      expect(authState).toBeNull();
      console.log('✓ Auth state not saved (as expected)');

      console.log('\n✅ Invalid credentials test passed!');
    });
  });

  test.describe('Token Persistence', () => {
    test('should persist token across popup close/reopen', async ({
      page,
      context,
      extensionId,
      cleanContext,
    }) => {
      test.setTimeout(60000);

      const popup = new PopupPage(page, extensionId);
      const authView = new AuthViewPage(page);
      const profileView = new UserProfilePage(page);

      // Step 1: Login
      await popup.open();
      const signInButton = page.locator('[data-testid="sign-in-button"]');
      await signInButton.click();
      await authView.waitForLoginForm();
      await authView.login('testauth@example.com', 'password123');
      await profileView.waitForProfile();
      console.log('✓ User logged in');

      // Step 2: Get auth state before closing
      const authStateBefore = await getAuthStateFromStorage(context, extensionId);
      expect(authStateBefore?.token).toBeTruthy();
      console.log('✓ Auth state exists before close');

      // Step 3: Close popup
      await popup.close();
      console.log('✓ Popup closed');

      // Step 4: Reopen popup
      const newPage = await context.newPage();
      const newPopup = new PopupPage(newPage, extensionId);
      const newProfileView = new UserProfilePage(newPage);
      await newPopup.open();
      console.log('✓ Popup reopened');

      // Step 5: Click "My Account" to open auth section
      const myAccountButton = newPage.locator('[data-testid="my-account-button"]');
      await myAccountButton.waitFor({ state: 'visible', timeout: 5000 });
      await myAccountButton.click();
      console.log('✓ My Account clicked');

      // Step 6: Verify profile still visible (token persisted)
      await newProfileView.waitForProfile();
      const username = await newProfileView.getUsername();
      expect(username).toBe('testauth');
      console.log(`✓ Profile still visible after reopen: ${username}`);

      // Step 7: Verify token unchanged in storage
      const authStateAfter = await getAuthStateFromStorage(context, extensionId);
      expect(authStateAfter?.token).toBe(authStateBefore?.token);
      expect(authStateAfter?.userId).toBe(authStateBefore?.userId);
      console.log('✓ Token persisted unchanged');

      console.log('\n✅ Token persistence test passed!');
    });

    test('should persist token after service worker restart', async ({
      page,
      context,
      extensionId,
      cleanContext,
    }) => {
      test.setTimeout(60000);

      const popup = new PopupPage(page, extensionId);
      const authView = new AuthViewPage(page);
      const profileView = new UserProfilePage(page);

      // Step 1: Login
      await popup.open();
      const signInButton = page.locator('[data-testid="sign-in-button"]');
      await signInButton.click();
      await authView.waitForLoginForm();
      await authView.login('testauth@example.com', 'password123');
      await profileView.waitForProfile();
      console.log('✓ User logged in');

      // Step 2: Get auth state and service worker before restart
      const authStateBefore = await getAuthStateFromStorage(context, extensionId);
      expect(authStateBefore?.token).toBeTruthy();
      const oldWorker = context.serviceWorkers()[0];
      console.log('✓ Auth state exists before restart');

      // Step 3: Restart service worker
      await oldWorker.evaluate(() => self.close()).catch(() => {});
      console.log('✓ Service worker terminated');

      // Wait a bit to ensure worker is fully terminated
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 4: Close and reopen popup to trigger background script (will auto-restart worker)
      await popup.close();
      const newPage = await context.newPage();
      const newPopup = new PopupPage(newPage, extensionId);
      const newProfileView = new UserProfilePage(newPage);
      await newPopup.open();
      console.log('✓ Popup reopened after SW restart');

      // Step 5: Click "My Account" to open auth section
      const myAccountButton = newPage.locator('[data-testid="my-account-button"]');
      await myAccountButton.waitFor({ state: 'visible', timeout: 5000 });
      await myAccountButton.click();
      console.log('✓ My Account clicked');

      // Step 6: Verify profile still visible (token survived restart)
      await newProfileView.waitForProfile();
      const username = await newProfileView.getUsername();
      expect(username).toBe('testauth');
      console.log(`✓ Profile still visible after SW restart: ${username}`);

      // Step 7: Verify token unchanged in storage
      const authStateAfter = await getAuthStateFromStorage(context, extensionId);
      expect(authStateAfter?.token).toBe(authStateBefore?.token);
      expect(authStateAfter?.userId).toBe(authStateBefore?.userId);
      console.log('✓ Token survived service worker restart');

      console.log('\n✅ Service worker persistence test passed!');
    });
  });

  test.describe('Logout Flow', () => {
    test('should clear auth state on logout', async ({
      page,
      context,
      extensionId,
      cleanContext,
    }) => {
      test.setTimeout(60000);

      const popup = new PopupPage(page, extensionId);
      const authView = new AuthViewPage(page);
      const profileView = new UserProfilePage(page);

      // Step 1: Login first
      await popup.open();
      const signInButton = page.locator('[data-testid="sign-in-button"]');
      await signInButton.click();
      await authView.waitForLoginForm();
      await authView.login('testauth@example.com', 'password123');
      await profileView.waitForProfile();

      // Step 2: Verify logged in
      const authStateBefore = await getAuthStateFromStorage(context, extensionId);
      expect(authStateBefore?.token).toBeTruthy();
      console.log('✓ User logged in');

      // Step 3: Click logout
      await profileView.clickLogout();

      // Step 4: Wait for login form to reappear
      await authView.waitForLoginForm();
      console.log('✓ Login form reappeared after logout');

      // Step 5: Verify auth state is cleared
      const authStateAfter = await getAuthStateFromStorage(context, extensionId);
      expect(authStateAfter).toBeNull();
      console.log('✓ Auth state cleared');

      console.log('\n✅ Logout test passed!');
    });
  });
});
