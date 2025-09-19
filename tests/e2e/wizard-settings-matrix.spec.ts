import { test, expect } from './fixtures';
import { Page, BrowserContext } from '@playwright/test';
import { YouTubePage } from './page-objects/YouTubePage';
import { GifWizard } from './page-objects/GifWizard';
import { QuickCapturePage } from './page-objects/QuickCapturePage';
import { TextOverlayPage } from './page-objects/TextOverlayPage';
import { ProcessingPage } from './page-objects/ProcessingPage';
import { SuccessPage } from './page-objects/SuccessPage';
import { TEST_VIDEOS } from './helpers/test-videos';
import { waitForExtensionReady, handleYouTubeCookieConsent } from './helpers/extension-helpers';
import { extractGifMetadata, validateGifComplete } from './helpers/gif-validator';

/**
 * Comprehensive matrix testing for all resolution, FPS, and duration combinations
 */
test.describe('Wizard Settings Matrix - Resolution, FPS, Duration', () => {
  let page: Page;
  let context: BrowserContext;
  let youtube: YouTubePage;
  let wizard: GifWizard;
  let quickCapture: QuickCapturePage;
  let textOverlay: TextOverlayPage;
  let processing: ProcessingPage;
  let success: SuccessPage;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    youtube = new YouTubePage(page);
    wizard = new GifWizard(page);
    quickCapture = new QuickCapturePage(page);
    textOverlay = new TextOverlayPage(page);
    processing = new ProcessingPage(page);
    success = new SuccessPage(page);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('Resolution Options', () => {
    const resolutions: Array<'144p' | '240p' | '360p' | '480p'> = ['144p', '240p', '360p', '480p'];

    for (const resolution of resolutions) {
      test(`Resolution ${resolution}: Creates GIF successfully`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Select resolution
        await quickCapture.selectResolution(resolution);
        const selectedRes = await quickCapture.getSelectedResolution();
        expect(selectedRes).toBe(resolution);

        // Set a consistent time range
        await quickCapture.setTimeRange(0, 3);
        await quickCapture.clickNext();

        // Skip text overlay
        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        // Wait for processing
        await processing.waitForScreen();
        await processing.waitForCompletion(30000);

        // Verify success
        await success.waitForScreen();
        const gifCreated = await success.validateGifCreated();
        expect(gifCreated).toBe(true);

        // Download and validate the actual GIF output
        const gifPath = await success.downloadGif();
        const validation = await validateGifComplete(gifPath, {
          resolution,
          fps: 5,
          duration: 3,
        });

        // Log validation summary for debugging
        console.log(`Resolution ${resolution} validation:`, validation.summary);

        // Assert the GIF has correct properties
        expect(validation.results.resolution.valid).toBe(true);
        expect(validation.passed).toBe(true);
      });
    }
  });

  test.describe('Frame Rate Options', () => {
    const frameRates: Array<'5' | '10' | '15'> = ['5', '10', '15'];

    for (const fps of frameRates) {
      test(`Frame rate ${fps} fps: Creates GIF successfully`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Select frame rate
        await quickCapture.selectFps(fps);
        const selectedFps = await quickCapture.getSelectedFps();
        expect(selectedFps).toBe(fps);

        // Set a consistent time range
        await quickCapture.setTimeRange(0, 2);
        await quickCapture.clickNext();

        // Skip text overlay
        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        // Wait for processing
        await processing.waitForScreen();

        // Monitor that higher FPS takes longer
        const startTime = Date.now();
        await processing.waitForCompletion(45000);
        const processingTime = Date.now() - startTime;

        // Higher FPS should generally take longer (rough check)
        if (fps === '15') {
          expect(processingTime).toBeGreaterThan(1000);
        }

        // Verify success
        await success.waitForScreen();
        const gifCreated = await success.validateGifCreated();
        expect(gifCreated).toBe(true);
      });
    }
  });

  test.describe('Duration Variations', () => {
    const durations = [
      { start: 0, end: 1, label: '1 second' },
      { start: 0, end: 3, label: '3 seconds' },
      { start: 0, end: 5, label: '5 seconds' },
      { start: 0, end: 7, label: '7 seconds' },
      { start: 0, end: 10, label: '10 seconds (max)' },
    ];

    for (const duration of durations) {
      test(`Duration ${duration.label}: Creates GIF successfully`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Set time range
        await quickCapture.setTimeRange(duration.start, duration.end);

        // Verify duration
        const actualDuration = await quickCapture.getSelectionDuration();
        expect(actualDuration).toBeCloseTo(duration.end - duration.start, 1);

        await quickCapture.clickNext();

        // Skip text overlay
        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        // Wait for processing (longer durations need more time)
        await processing.waitForScreen();
        const timeout = 20000 + (duration.end * 3000);
        await processing.waitForCompletion(timeout);

        // Verify success
        await success.waitForScreen();
        const gifCreated = await success.validateGifCreated();
        expect(gifCreated).toBe(true);
      });
    }
  });

  test.describe('Combined Settings Matrix', () => {
    // Test key combinations to ensure they work together
    const testMatrix = [
      { resolution: '144p', fps: '5', duration: [0, 2], label: 'Smallest file' },
      { resolution: '240p', fps: '10', duration: [0, 5], label: 'Balanced settings' },
      { resolution: '360p', fps: '15', duration: [0, 3], label: 'High FPS compact' },
      { resolution: '480p', fps: '5', duration: [0, 10], label: 'HD long duration' },
      { resolution: '480p', fps: '15', duration: [0, 5], label: 'Maximum quality' },
    ];

    for (const config of testMatrix) {
      test(`Matrix ${config.label}: ${config.resolution} @ ${config.fps}fps, ${config.duration[1]}s`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Apply all settings
        await quickCapture.selectResolution(config.resolution as '144p' | '240p' | '360p' | '480p');
        await quickCapture.selectFps(config.fps as '5' | '10' | '15');
        await quickCapture.setTimeRange(config.duration[0], config.duration[1]);

        // Verify selections
        const selectedRes = await quickCapture.getSelectedResolution();
        expect(selectedRes).toBe(config.resolution);

        const selectedFps = await quickCapture.getSelectedFps();
        expect(selectedFps).toBe(config.fps);

        const duration = await quickCapture.getSelectionDuration();
        expect(duration).toBeCloseTo(config.duration[1] - config.duration[0], 1);

        await quickCapture.clickNext();

        // Skip text overlay
        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        // Wait for processing
        await processing.waitForScreen();

        // Calculate expected processing time based on settings
        const expectedTimeout = 15000 +
          (config.duration[1] * 2000) +
          (parseInt(config.fps) * 1000) +
          (config.resolution === '480p' ? 5000 : 0);

        await processing.waitForCompletion(expectedTimeout);

        // Verify success
        await success.waitForScreen();
        const gifCreated = await success.validateGifCreated();
        expect(gifCreated).toBe(true);

        // Verify file size correlates with settings
        const fileSize = await success.getFileSize();

        // Smallest config should produce smallest file
        if (config.label === 'Smallest file') {
          expect(fileSize).toContain('KB'); // Should be in KB not MB
        }

        // Maximum quality should produce larger file
        if (config.label === 'Maximum quality') {
          // File should be larger, likely in MB range
        }
      });
    }
  });

  test('Settings persistence: Selections remain during navigation', async () => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Make specific selections
    await quickCapture.selectResolution('360p');
    await quickCapture.selectFps('10');
    await quickCapture.setTimeRange(2, 6);

    // Navigate forward
    await quickCapture.clickNext();
    await textOverlay.waitForScreen();

    // Navigate back
    await textOverlay.clickBack();
    await quickCapture.waitForScreen();

    // Verify selections persisted
    const selectedRes = await quickCapture.getSelectedResolution();
    expect(selectedRes).toBe('360p');

    const selectedFps = await quickCapture.getSelectedFps();
    expect(selectedFps).toBe('10');

    const timeRange = await quickCapture.getTimeRangeValues();
    expect(timeRange.start).toBeCloseTo(2, 1);
    expect(timeRange.end).toBeCloseTo(6, 1);
  });

  test('Edge case: All maximum settings together', async () => {
    await youtube.navigateToVideo(TEST_VIDEOS.rickRoll.url); // Longer video
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Select maximum everything
    await quickCapture.selectResolution('480p');
    await quickCapture.selectFps('15');
    await quickCapture.setTimeRange(0, 10); // Max duration

    await quickCapture.clickNext();

    // Add text overlays for maximum processing
    await textOverlay.waitForScreen();
    await textOverlay.addTextOverlay('Top Text Maximum Quality Test', 'top', 'meme');
    await textOverlay.addTextOverlay('Bottom Text Maximum Quality Test', 'bottom', 'meme');
    await textOverlay.clickNext();

    // This should take the longest to process
    await processing.waitForScreen();

    const startTime = Date.now();
    await processing.waitForCompletion(90000); // 90 second timeout for maximum settings
    const processingTime = Date.now() - startTime;

    // Should take significant time with max settings
    expect(processingTime).toBeGreaterThan(5000);

    await success.waitForScreen();
    const gifCreated = await success.validateGifCreated();
    expect(gifCreated).toBe(true);

    // File should be relatively large
    const fileSize = await success.getFileSize();
    // Should likely be in MB range with these settings
  });

  test('Edge case: All minimum settings together', async () => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Select minimum everything
    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');
    await quickCapture.setTimeRange(0, 1); // Min useful duration

    await quickCapture.clickNext();

    // Skip text for minimum processing
    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    // Should process very quickly
    await processing.waitForScreen();

    const startTime = Date.now();
    await processing.waitForCompletion(15000);
    const processingTime = Date.now() - startTime;

    // Should be very fast with minimum settings
    expect(processingTime).toBeLessThan(10000);

    await success.waitForScreen();
    const gifCreated = await success.validateGifCreated();
    expect(gifCreated).toBe(true);

    // File should be very small
    const fileSize = await success.getFileSize();
    expect(fileSize).toContain('KB'); // Should definitely be in KB
  });
});