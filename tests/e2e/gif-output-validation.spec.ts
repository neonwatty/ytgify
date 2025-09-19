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
import {
  extractGifMetadata,
  validateGifComplete,
  validateGifDataUrl,
  validateTextOverlay,
} from './helpers/gif-validator';

/**
 * Tests that validate GIF output matches input settings
 */
test.describe('GIF Output Validation - Verify Correct Output', () => {
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

  test.describe('Resolution Validation', () => {
    const testCases = [
      { resolution: '144p' as const, expectedWidth: 256, expectedHeight: 144 },
      { resolution: '240p' as const, expectedWidth: 426, expectedHeight: 240 },
      { resolution: '360p' as const, expectedWidth: 640, expectedHeight: 360 },
      { resolution: '480p' as const, expectedWidth: 854, expectedHeight: 480 },
    ];

    for (const testCase of testCases) {
      test(`GIF at ${testCase.resolution} has correct dimensions`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Set specific resolution
        await quickCapture.selectResolution(testCase.resolution);
        await quickCapture.setTimeRange(0, 2);
        await quickCapture.selectFps('5'); // Low FPS for faster processing
        await quickCapture.clickNext();

        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        await processing.waitForScreen();
        await processing.waitForCompletion(30000);

        await success.waitForScreen();

        // Download and validate GIF
        const gifPath = await success.downloadGif();
        const validation = await validateGifComplete(gifPath, {
          resolution: testCase.resolution,
          fps: 5,
          duration: 2,
        });

        console.log(validation.summary);

        // Assert resolution is correct
        expect(validation.results.resolution.valid).toBe(true);
        expect(validation.metadata.width).toBeCloseTo(testCase.expectedWidth, -1);
        expect(validation.metadata.height).toBeCloseTo(testCase.expectedHeight, -1);
      });
    }
  });

  test.describe('Frame Rate Validation', () => {
    const fpsCases = [5, 10, 15];

    for (const fps of fpsCases) {
      test(`GIF at ${fps} fps has correct frame rate`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Set specific FPS
        await quickCapture.selectResolution('144p'); // Small for faster processing
        await quickCapture.selectFps(fps.toString() as '5' | '10' | '15');
        await quickCapture.setTimeRange(0, 2);
        await quickCapture.clickNext();

        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        await processing.waitForScreen();
        await processing.waitForCompletion(30000);

        await success.waitForScreen();

        // Download and validate GIF
        const gifPath = await success.downloadGif();
        const metadata = await extractGifMetadata(gifPath);

        // Calculate expected frames
        const expectedFrames = fps * 2; // 2 second duration
        const actualFps = metadata.frameCount / 2;

        console.log(`FPS Validation: Expected ${fps} fps, got ${actualFps} fps (${metadata.frameCount} frames in 2s)`);

        // Allow some tolerance due to encoding optimizations
        expect(actualFps).toBeCloseTo(fps, 0);
        expect(metadata.frameCount).toBeCloseTo(expectedFrames, 2);
      });
    }
  });

  test.describe('Duration Validation', () => {
    const durationCases = [1, 3, 5];

    for (const duration of durationCases) {
      test(`GIF with ${duration}s duration is correct length`, async () => {
        await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
        await handleYouTubeCookieConsent(page);
        await waitForExtensionReady(page);

        await youtube.openGifWizard();
        await quickCapture.waitForScreen();

        // Set specific duration
        await quickCapture.selectResolution('144p');
        await quickCapture.selectFps('5');
        await quickCapture.setTimeRange(0, duration);
        await quickCapture.clickNext();

        await textOverlay.waitForScreen();
        await textOverlay.clickSkip();

        await processing.waitForScreen();
        await processing.waitForCompletion(45000);

        await success.waitForScreen();

        // Download and validate GIF
        const gifPath = await success.downloadGif();
        const validation = await validateGifComplete(gifPath, {
          resolution: '144p',
          fps: 5,
          duration: duration,
        });

        console.log(validation.summary);

        // Assert duration is correct
        expect(validation.results.duration.valid).toBe(true);
        expect(validation.metadata.duration).toBeCloseTo(duration, 1);

        // Frame count should match duration * fps
        const expectedFrames = duration * 5;
        expect(validation.metadata.frameCount).toBeCloseTo(expectedFrames, 3);
      });
    }
  });

  test('Text overlay is present in GIF output', async () => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    await quickCapture.selectResolution('240p');
    await quickCapture.selectFps('5');
    await quickCapture.setTimeRange(0, 3);
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();

    // Add distinctive text overlays
    await textOverlay.addTextOverlay('TOP TEXT TEST', 'top', 'meme');
    await textOverlay.addTextOverlay('BOTTOM TEXT TEST', 'bottom', 'meme');
    await textOverlay.clickNext();

    await processing.waitForScreen();
    await processing.waitForCompletion(45000);

    await success.waitForScreen();

    // Validate text is visible in preview
    const textValidation = await validateTextOverlay(
      page,
      '.ytgif-gif-preview img',
      ['TOP TEXT TEST', 'BOTTOM TEXT TEST']
    );

    console.log(`Text overlay validation: hasText=${textValidation.hasText}, confidence=${textValidation.confidence}`);

    // Text should be present
    expect(textValidation.hasText).toBe(true);
    expect(textValidation.confidence).toBeGreaterThan(0.5);

    // Also validate the GIF has expected properties
    const gifPath = await success.downloadGif();
    const validation = await validateGifComplete(gifPath, {
      resolution: '240p',
      fps: 5,
      duration: 3,
      hasText: true,
    });

    expect(validation.passed).toBe(true);
  });

  test('Combined validation: All settings produce correct output', async () => {
    const testConfig = {
      resolution: '360p' as const,
      fps: 10,
      duration: 4,
      text: ['VALIDATION TEST', 'SETTINGS CHECK'],
    };

    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Apply all settings
    await quickCapture.selectResolution(testConfig.resolution);
    await quickCapture.selectFps(testConfig.fps.toString() as '10');
    await quickCapture.setTimeRange(0, testConfig.duration);
    await quickCapture.clickNext();

    // Add text overlays
    await textOverlay.waitForScreen();
    await textOverlay.addTextOverlay(testConfig.text[0], 'top', 'meme');
    await textOverlay.addTextOverlay(testConfig.text[1], 'bottom', 'subtitle');
    await textOverlay.clickNext();

    await processing.waitForScreen();
    await processing.waitForCompletion(60000);

    await success.waitForScreen();

    // Get GIF data URL from preview
    const gifSrc = await success.getGifSrc();
    expect(gifSrc).toBeTruthy();

    // Download for full validation
    const gifPath = await success.downloadGif();
    const validation = await validateGifComplete(gifPath, {
      resolution: testConfig.resolution,
      fps: testConfig.fps,
      duration: testConfig.duration,
      hasText: true,
    });

    console.log('=== Complete Validation Results ===');
    console.log(validation.summary);
    console.log(`File size: ${validation.results.fileSize.sizeInMB.toFixed(2)} MB`);

    // All validations should pass
    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);
    expect(validation.results.frameRate.valid).toBe(true);
    expect(validation.results.duration.valid).toBe(true);

    // Additional metadata checks
    expect(validation.metadata.width).toBe(640);
    expect(validation.metadata.height).toBe(360);
    expect(validation.metadata.frameCount).toBeCloseTo(40, 5); // 10fps * 4s
  });

  test('File size correlates with settings', async () => {
    // Test that higher quality = larger file
    const configs = [
      { res: '144p', fps: '5', dur: 2, label: 'smallest' },
      { res: '480p', fps: '15', dur: 2, label: 'largest' },
    ];

    const fileSizes: { label: string; size: number }[] = [];

    for (const config of configs) {
      await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
      await handleYouTubeCookieConsent(page);
      await waitForExtensionReady(page);

      await youtube.openGifWizard();
      await quickCapture.waitForScreen();

      await quickCapture.selectResolution(config.res as '144p' | '480p');
      await quickCapture.selectFps(config.fps as '5' | '15');
      await quickCapture.setTimeRange(0, config.dur);
      await quickCapture.clickNext();

      await textOverlay.waitForScreen();
      await textOverlay.clickSkip();

      await processing.waitForScreen();
      await processing.waitForCompletion(45000);

      await success.waitForScreen();

      const gifPath = await success.downloadGif();
      const metadata = await extractGifMetadata(gifPath);

      fileSizes.push({ label: config.label, size: metadata.fileSize });

      console.log(`${config.label}: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB`);

      // Close wizard for next iteration
      await wizard.close();
    }

    // Higher quality should produce larger file
    const smallestSize = fileSizes.find(f => f.label === 'smallest')!.size;
    const largestSize = fileSizes.find(f => f.label === 'largest')!.size;

    console.log(`Size comparison: smallest=${(smallestSize/1024/1024).toFixed(2)}MB, largest=${(largestSize/1024/1024).toFixed(2)}MB`);

    expect(largestSize).toBeGreaterThan(smallestSize);
    // 480p@15fps should be at least 2x larger than 144p@5fps
    expect(largestSize / smallestSize).toBeGreaterThan(2);
  });

  test('GIF data URL validation', async () => {
    await youtube.navigateToVideo(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await waitForExtensionReady(page);

    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    await quickCapture.selectResolution('240p');
    await quickCapture.selectFps('10');
    await quickCapture.setTimeRange(1, 3); // 2 seconds
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForScreen();
    await processing.waitForCompletion(30000);

    await success.waitForScreen();

    // Get data URL directly from preview
    const gifSrc = await success.getGifSrc();
    expect(gifSrc).toBeTruthy();

    if (gifSrc && gifSrc.startsWith('data:image/gif')) {
      const validation = await validateGifDataUrl(gifSrc, {
        resolution: '240p',
        fps: 10,
        duration: 2,
      });

      console.log('Data URL validation:');
      console.log(`- Resolution: ${validation.validationResults.resolution.message}`);
      console.log(`- FPS: ${validation.validationResults.frameRate.message}`);
      console.log(`- Duration: ${validation.validationResults.duration.message}`);

      expect(validation.valid).toBe(true);
    }
  });
});