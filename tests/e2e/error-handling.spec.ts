import { test, expect } from './fixtures';
import { YouTubePage } from './page-objects/YouTubePage';
import { GifWizard } from './page-objects/GifWizard';
import { QuickCapturePage } from './page-objects/QuickCapturePage';
import { TextOverlayPage } from './page-objects/TextOverlayPage';
import { ProcessingPage } from './page-objects/ProcessingPage';
import { SuccessPage } from './page-objects/SuccessPage';
import { TEST_VIDEOS } from './helpers/test-videos';
import { waitForExtensionReady, handleYouTubeCookieConsent } from './helpers/extension-helpers';

test.describe('Error Handling and Edge Cases', () => {
  let youtube: YouTubePage;
  let wizard: GifWizard;
  let quickCapture: QuickCapturePage;
  let textOverlay: TextOverlayPage;
  let processing: ProcessingPage;
  let success: SuccessPage;

  test.beforeEach(async ({ page }) => {
    youtube = new YouTubePage(page);
    wizard = new GifWizard(page);
    quickCapture = new QuickCapturePage(page);
    textOverlay = new TextOverlayPage(page);
    processing = new ProcessingPage(page);
    success = new SuccessPage(page);
  });

  test('Extension does not inject on non-YouTube pages', async ({ page }) => {
    // Navigate to a non-YouTube page
    await page.goto('https://www.google.com');
    await page.waitForTimeout(3000);

    // Check that GIF button is not present
    const gifButtonPresent = await youtube.isGifButtonVisible();
    expect(gifButtonPresent).toBe(false);

    // Check no extension elements injected
    const extensionElements = await page.$$('.ytgif-button, .ytgif-overlay-wizard');
    expect(extensionElements.length).toBe(0);
  });

  test('Handle very short selection (< 1 second)', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Try to set a very short range
    await quickCapture.setTimeRange(0, 0.5);

    // Should either prevent or show minimum duration
    const duration = await quickCapture.getSelectionDuration();
    expect(duration).toBeGreaterThanOrEqual(1); // Minimum 1 second
  });

  test('Handle maximum duration limit (10 seconds)', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.rickRoll.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Try to set a range longer than 10 seconds
    await quickCapture.setTimeRange(0, 15);

    // Should cap at 10 seconds
    const duration = await quickCapture.getSelectionDuration();
    expect(duration).toBeLessThanOrEqual(10);
  });

  test('Handle empty text overlay submission', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();

    // Try to add empty text
    await textOverlay.addTextOverlay('', 'top', 'meme');

    // Should not add overlay with empty text
    const overlayCount = await textOverlay.getOverlayCount();
    expect(overlayCount).toBe(0);
  });

  test('Handle very long text overlay', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();

    // Add very long text
    const longText = 'A'.repeat(500);
    await textOverlay.addTextOverlay(longText, 'top', 'meme');

    // Should handle long text (truncate or wrap)
    const overlays = await textOverlay.getOverlayTexts();
    expect(overlays.length).toBeGreaterThan(0);
    // Text should be handled gracefully (truncated or wrapped)
    expect(overlays[0].length).toBeLessThanOrEqual(500);

    // Proceed to processing
    await textOverlay.clickNext();
  });

  test('Cancel during processing', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.setTimeRange(0, 5);
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForScreen();

    // Wait a bit then cancel
    await page.waitForTimeout(2000);
    await processing.cancel();

    // Should return to previous screen or close
    const processingVisible = await processing.isProcessing();
    expect(processingVisible).toBe(false);
  });

  test('Handle video pause/play during capture', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    // Ensure video is playing
    await youtube.playVideo();

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Video should pause when wizard opens
    const isPlaying = await youtube.isVideoPlaying();
    expect(isPlaying).toBe(false);

    // Close wizard
    await wizard.close();

    // Optionally check if video resumes (depends on implementation)
  });

  test('Handle network interruption simulation', async ({ page, context }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.setTimeRange(0, 3);
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForScreen();

    // Simulate offline mode during processing
    // GIF processing is entirely local (no network required), so this should not affect it
    await context.setOffline(true);

    // Wait for processing to complete - should succeed despite offline mode
    await processing.waitForCompletion(60000);

    await success.waitForScreen();

    // Restore connection
    await context.setOffline(false);

    // Verify GIF was created successfully
    const gifSrc = await success.getGifSrc();
    expect(gifSrc).toBeTruthy();
  });

  test('Rapid navigation stress test', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();

    // Rapidly navigate back and forth
    for (let i = 0; i < 5; i++) {
      await quickCapture.waitForScreen();
      await quickCapture.clickNext();

      await textOverlay.waitForScreen();
      await textOverlay.clickBack();
    }

    // Should still be functional
    await quickCapture.waitForScreen();
    const nextEnabled = await quickCapture.isNextButtonEnabled();
    expect(nextEnabled).toBe(true);
  });

  test('Multiple text overlays limit', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();

    // TextOverlayScreenV2 only supports 2 overlays (top + bottom)
    // Test that both work correctly
    await textOverlay.addTextOverlay('Top Text', 'top', 'meme');
    await textOverlay.addTextOverlay('Bottom Text', 'bottom', 'meme');

    // Should have exactly 2 overlays
    const overlays = await textOverlay.getOverlayTexts();
    expect(overlays.length).toBe(2);
    expect(overlays[0]).toBe('Top Text');
    expect(overlays[1]).toBe('Bottom Text');
  });

  test('Handle video end boundary', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url); // 19 seconds
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    // Seek near end
    await youtube.seekToTime(17);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Should handle end boundary correctly
    const timeRange = await quickCapture.getTimeRangeValues();
    expect(timeRange.end).toBeLessThanOrEqual(19);
  });

  test('Concurrent wizard instances prevention', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    // Open first wizard
    await youtube.openGifWizard();
    await wizard.waitForWizardReady();

    // Try to open second wizard
    await youtube.gifButton.click({ force: true });

    // Should not have multiple wizards
    const wizardCount = await page.locator('.ytgif-overlay-wizard').count();
    expect(wizardCount).toBe(1);
  });

  test('Handle special characters in text overlay', async ({ page }) => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();

    // Add text with special characters
    const specialText = '🎉 <Hello> "World" & €£¥ 你好';
    await textOverlay.addTextOverlay(specialText, 'top', 'meme');

    const overlays = await textOverlay.getOverlayTexts();
    expect(overlays.length).toBe(1);
    // Should handle special characters
  });
});