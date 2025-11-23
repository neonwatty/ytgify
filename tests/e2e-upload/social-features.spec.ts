/**
 * Phase 3 E2E Tests: Social Features Flow
 *
 * Tests the complete social features user journey:
 * 1. User logs in
 * 2. Uploads a GIF
 * 3. Views "My GIFs" tab and sees their uploaded GIF
 * 4. Likes their GIF (toggles like count)
 * 5. Browses trending GIFs
 * 6. Verifies GIF cards display correctly with all metadata
 */

import { test, expect } from './fixtures';
import { SuccessPage } from './page-objects/SuccessPage';
import { getMockVideoUrl } from '../e2e-mock/helpers/mock-videos';

// Import page objects
import {
  YouTubePage,
  QuickCapturePage,
  TextOverlayPage,
  ProcessingPage,
} from '../e2e-mock/page-objects';

test.describe('Phase 3: Social Features E2E Tests', () => {
  test.beforeEach(async ({ cleanContext }) => {
    // Storage is cleared in cleanContext fixture
  });

  // ========================================
  // Test 1: Complete Social Features Flow
  // ========================================

  test('Complete social features flow - login, upload, view My GIFs, like/unlike, verify metadata', async ({
    page,
    extensionId,
    context,
    testUser,
    backend,
    mockServerUrl,
  }) => {
    test.setTimeout(120000); // 2 minutes for complete flow

    console.log('[Social Test] Starting complete social features flow...');
    console.log(`[Social Test] Extension ID: ${extensionId}`);
    console.log(`[Social Test] Test User: ${testUser.username}`);

    // ========================================
    // Step 1: Login via popup
    // ========================================

    console.log('[Social Test] Step 1: Opening popup and logging in...');

    // Open extension popup
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(1000); // Wait for React to render

    // Click Sign In button
    const signInButton = popupPage.getByTestId('sign-in-button');
    await expect(signInButton).toBeVisible();
    await signInButton.click();
    console.log('[Social Test] ✓ Clicked Sign In button');

    // Wait for login form
    await popupPage.waitForTimeout(500);

    // Fill in login credentials
    const emailInput = popupPage.locator('input[type="email"]');
    const passwordInput = popupPage.locator('input[type="password"]');
    const loginButton = popupPage.getByRole('button', { name: /sign in|login/i });

    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);
    await loginButton.click();
    console.log('[Social Test] ✓ Submitted login form');

    // Wait for successful login (profile view should appear)
    await popupPage.waitForTimeout(2000);
    const userProfile = popupPage.getByTestId('user-profile');
    await expect(userProfile).toBeVisible({ timeout: 10000 });
    console.log('[Social Test] ✓ Login successful, user profile visible');

    // Verify username is displayed
    const usernameElement = popupPage.getByTestId('username');
    await expect(usernameElement).toHaveText(testUser.username);
    console.log('[Social Test] ✓ Username displayed correctly');

    // ========================================
    // Step 2: Upload a GIF
    // ========================================

    console.log('[Social Test] Step 2: Creating and uploading GIF...');

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    // Navigate to mock YouTube video
    const videoUrl = getMockVideoUrl('veryShort', mockServerUrl);
    await youtube.navigateToVideo(videoUrl);

    // Open wizard and create GIF
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');
    await quickCapture.clickNext();

    // Skip text overlay
    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    // Wait for processing
    await processing.waitForCompletion(90000);

    // Wait for success screen
    await success.waitForScreen();
    console.log('[Social Test] ✓ GIF created successfully');

    // Upload GIF to cloud
    const uploadButton = success.page.getByRole('button', { name: /upload to cloud/i });
    await expect(uploadButton).toBeVisible();
    await uploadButton.click();
    console.log('[Social Test] ✓ Clicked Upload to Cloud button');

    // Wait for upload success
    await success.page.waitForTimeout(3000);
    const uploadStatus = await success.getUploadStatus();
    expect(uploadStatus).toBe('success');
    console.log('[Social Test] ✓ GIF uploaded successfully to backend');

    // ========================================
    // Step 3: View My GIFs Tab
    // ========================================

    console.log('[Social Test] Step 3: Viewing My GIFs tab...');

    // Switch back to popup and reload to see updated state
    await popupPage.bringToFront();
    await popupPage.reload();
    await popupPage.waitForTimeout(2000);

    // Click "My Account" button to open profile
    const myAccountButton = popupPage.getByTestId('my-account-button');
    await expect(myAccountButton).toBeVisible();
    await myAccountButton.click();
    console.log('[Social Test] ✓ Opened My Account section');

    await popupPage.waitForTimeout(1000);

    // Verify user profile is visible
    await expect(userProfile).toBeVisible();

    // Click "My GIFs" tab
    const myGifsTab = popupPage.getByRole('button', { name: /my gifs/i });
    await expect(myGifsTab).toBeVisible();
    await myGifsTab.click();
    console.log('[Social Test] ✓ Clicked My GIFs tab');

    // Wait for GIFs to load
    await popupPage.waitForTimeout(3000);

    // Verify at least one GIF card is visible
    const gifCards = popupPage.locator('[style*="background-color: rgb(255, 255, 255)"]').filter({
      has: popupPage.locator('img'),
    });
    const gifCount = await gifCards.count();
    expect(gifCount).toBeGreaterThan(0);
    console.log(`[Social Test] ✓ Found ${gifCount} GIF(s) in My GIFs tab`);

    // Verify GIF card displays metadata (title, stats)
    const firstGifCard = gifCards.first();
    await expect(firstGifCard).toBeVisible();

    // Check for like count (should be 0 initially)
    const likeCount = firstGifCard.locator('text=/^0$/').first();
    await expect(likeCount).toBeVisible();
    console.log('[Social Test] ✓ GIF card displays like count');

    // ========================================
    // Step 4: Like the GIF
    // ========================================

    console.log('[Social Test] Step 4: Liking GIF...');

    // Find and click like button (heart icon)
    // Note: Don't filter by fill="none" since it changes to fill="currentColor" when liked
    const likeButton = firstGifCard.locator('button').filter({
      has: popupPage.locator('path[d*="12 20.364"]'), // Heart icon path
    });

    await expect(likeButton).toBeVisible();
    await likeButton.click();
    console.log('[Social Test] ✓ Clicked like button');

    // Wait for like to process
    await popupPage.waitForTimeout(2000);

    // Verify like count increased to 1
    const updatedLikeCount = firstGifCard.locator('text=/^1$/').first();
    await expect(updatedLikeCount).toBeVisible({ timeout: 5000 });
    console.log('[Social Test] ✓ Like count updated to 1');

    // Unlike the GIF (toggle back)
    await likeButton.click();
    await popupPage.waitForTimeout(2000);

    // Verify like count decreased back to 0
    const unlikedCount = firstGifCard.locator('text=/^0$/').first();
    await expect(unlikedCount).toBeVisible({ timeout: 5000 });
    console.log('[Social Test] ✓ Unlike successful, like count back to 0');

    // ========================================
    // Step 5: Verify GIF Card Metadata
    // ========================================

    console.log('[Social Test] Step 5: Verifying GIF card metadata...');

    // GIF card is already visible from previous step
    const detailGifCard = firstGifCard;

    // Verify card has thumbnail image
    const gifThumbnail = detailGifCard.locator('img');
    await expect(gifThumbnail).toBeVisible();
    const imgSrc = await gifThumbnail.getAttribute('src');
    expect(imgSrc).toBeTruthy();
    console.log('[Social Test] ✓ GIF card has thumbnail image');

    // Verify card has username
    const username = detailGifCard.locator(`text=${testUser.username}`);
    await expect(username).toBeVisible();
    console.log('[Social Test] ✓ GIF card displays username');

    // Verify card has comment count icon
    const commentIcon = detailGifCard.locator('svg').filter({
      has: popupPage.locator('path[d*="M8 12h.01M12 12h.01M16 12h.01"]'),
    });
    await expect(commentIcon).toBeVisible();
    console.log('[Social Test] ✓ GIF card has comment icon');

    // Verify card has view count icon
    const viewIcon = detailGifCard.locator('svg').filter({
      has: popupPage.locator('path[d*="M15 12a3 3 0 11-6 0"]'),
    });
    await expect(viewIcon).toBeVisible();
    console.log('[Social Test] ✓ GIF card has view icon');

    console.log('✅ [Social Test] Complete social features flow test passed!');
    console.log('[Social Test] All authenticated features verified:');
    console.log('  - ✓ Login');
    console.log('  - ✓ GIF Upload to Backend');
    console.log('  - ✓ My GIFs Tab Navigation');
    console.log('  - ✓ Like/Unlike Functionality');
    console.log('  - ✓ GIF Card Metadata Display');
    console.log('[Social Test] Note: Trending browse tested separately in anonymous test');

    // Close popup
    await popupPage.close();
  });

  // ========================================
  // Test 2: Anonymous User - Trending View Only
  // ========================================

  test('Anonymous user can browse trending GIFs without login', async ({
    page,
    extensionId,
    context,
  }) => {
    test.setTimeout(60000);

    console.log('[Social Test] Starting anonymous trending browse test...');

    // Open extension popup
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(1000);

    // Verify user is not logged in (Sign In button visible)
    const signInButton = popupPage.getByTestId('sign-in-button');
    await expect(signInButton).toBeVisible();
    console.log('[Social Test] ✓ User is not logged in');

    // Click "Browse Trending" button (should work without auth)
    const browseTrendingButton = popupPage.getByTestId('browse-trending-button');
    await expect(browseTrendingButton).toBeVisible();
    await browseTrendingButton.click();
    console.log('[Social Test] ✓ Clicked Browse Trending button');

    await popupPage.waitForTimeout(2000);

    // Verify trending view opened (matches "Trending" or "Trending GIFs", use first() for strict mode)
    const trendingHeader = popupPage.getByRole('heading', { name: /trending/i }).first();
    await expect(trendingHeader).toBeVisible({ timeout: 10000 });
    console.log('[Social Test] ✓ Trending view opened for anonymous user');

    // Verify like button exists (even for anonymous users)
    const gifCards = popupPage.locator('[style*="background-color: rgb(255, 255, 255)"]').filter({
      has: popupPage.locator('img'),
    });

    if ((await gifCards.count()) > 0) {
      const firstCard = gifCards.first();
      const likeButton = firstCard.locator('button').filter({
        has: popupPage.locator('path[d*="12 20.364"]'), // Heart icon path
      });

      await expect(likeButton).toBeVisible();
      console.log('[Social Test] ✓ Like button visible (will fail with auth error if clicked)');
    }

    console.log('✅ [Social Test] Anonymous trending browse test passed!');

    await popupPage.close();
  });
});
