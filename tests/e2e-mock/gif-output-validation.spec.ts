import { test, expect } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';
import { YouTubePage, QuickCapturePage, TextOverlayPage, ProcessingPage, SuccessPage } from './page-objects';
import { validateGifComplete, extractGifMetadata, RESOLUTION_SPECS } from './helpers/gif-validator-mock';

/**
 * GIF Output Validation Tests for Mock E2E
 * Updated to use Page Objects and comprehensive GIF validation
 */
test.describe('Mock E2E: GIF Output Validation', () => {

  // ========== Helper Function ==========

  /**
   * Common test workflow: create GIF and validate output
   */
  async function createAndValidateGif(
    page: any,
    mockServerUrl: string,
    options: {
      resolution?: '144p' | '240p' | '360p' | '480p';
      fps?: '5' | '10' | '15';
      expectedDuration?: number;
      skipText?: boolean;
    }
  ) {
    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    // Navigate
    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));

    // Open wizard
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Apply settings
    if (options.resolution) {
      await quickCapture.selectResolution(options.resolution);
    }
    if (options.fps) {
      await quickCapture.selectFps(options.fps);
    }

    // Note: Skipping setTimeRange for now as timeline drag interaction causes page crashes
    // Tests will use default video duration (20s for veryShort video)

    await quickCapture.clickNext();

    // Handle text overlay
    await textOverlay.waitForScreen();
    if (options.skipText !== false) {
      await textOverlay.clickSkip();
    }

    // Wait for processing
    await processing.waitForCompletion(45000);

    // Get GIF
    await success.waitForScreen();
    const gifUrl = await success.getGifUrl();

    expect(gifUrl).toBeTruthy();

    return {
      gifUrl: gifUrl!,
      success,
      quickCapture
    };
  }

  // ========== Resolution Validation Tests ==========

  test('GIF at 144p has correct dimensions', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      resolution: '144p'
    });

    // Save GIF to local file for examination
    const gifBuffer = await page.evaluate(async (url: string) => {
      const response = await fetch(url);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      return Array.from(new Uint8Array(arrayBuffer));
    }, gifUrl);

    const fs = await import('fs');
    const path = await import('path');
    const outputPath = path.join(process.cwd(), 'test-output-144p.gif');
    fs.writeFileSync(outputPath, Buffer.from(gifBuffer));
    console.log(`\n📁 GIF saved to: ${outputPath}`);

    // Comprehensive validation
    // Note: Using 5s duration (wizard default) since timeline interaction is disabled
    const validation = await validateGifComplete(page, gifUrl, {
      resolution: '144p',
      fps: 5,
      duration: 5
    });

    console.log('\n' + validation.summary);

    // Validate GIF properties (validation.passed checks all criteria with proper tolerance)
    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);

    console.log(`✅ [Mock Test] 144p GIF validated: ${validation.metadata.width}x${validation.metadata.height}`);
  });

  test('GIF at 240p has correct dimensions', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      resolution: '240p'
    });

    const validation = await validateGifComplete(page, gifUrl, {
      resolution: '240p',
      fps: 5,
      duration: 5
    });

    console.log('\n' + validation.summary);

    // Validate GIF properties (validation.passed checks all criteria with proper tolerance)
    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);

    console.log(`✅ [Mock Test] 240p GIF validated: ${validation.metadata.width}x${validation.metadata.height}`);
  });

  test('GIF at 360p has correct dimensions', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      resolution: '360p'
    });

    const validation = await validateGifComplete(page, gifUrl, {
      resolution: '360p',
      fps: 5,
      duration: 5
    });

    console.log('\n' + validation.summary);

    // Validate GIF properties (validation.passed checks all criteria with proper tolerance)
    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);

    console.log(`✅ [Mock Test] 360p GIF validated: ${validation.metadata.width}x${validation.metadata.height}`);
  });

  test('GIF at 480p has correct dimensions', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      resolution: '480p'
    });

    // Note: Test video is 640x360, but 480p now upscales to 854x480
    const validation = await validateGifComplete(page, gifUrl, {
      resolution: '480p', // Expect 480p (upscaling is now supported)
      fps: 5,
      duration: 5
    });

    console.log('\n' + validation.summary);

    // Validate GIF properties (validation.passed checks all criteria with proper tolerance)
    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);

    console.log(`✅ [Mock Test] 480p upscaled from source resolution: ${validation.metadata.width}x${validation.metadata.height}`);
  });

  // ========== Frame Rate Validation Tests ==========

  test('GIF at 5 fps has correct frame rate', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      fps: '5'
    });

    const metadata = await extractGifMetadata(page, gifUrl);

    // Validate FPS - use tolerance of 2 to account for GIF encoding variations and rounding
    expect(metadata.fps).toBeGreaterThanOrEqual(3);
    expect(metadata.fps).toBeLessThanOrEqual(7);

    console.log(`✅ [Mock Test] 5 fps GIF validated: ${metadata.fps} fps, ${metadata.frameCount} frames`);
  });

  test('GIF at 10 fps has correct frame rate', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      fps: '10'
    });

    const metadata = await extractGifMetadata(page, gifUrl);

    // Validate FPS - use tolerance of 2 to account for GIF encoding variations and rounding
    expect(metadata.fps).toBeGreaterThanOrEqual(8);
    expect(metadata.fps).toBeLessThanOrEqual(12);

    console.log(`✅ [Mock Test] 10 fps GIF validated: ${metadata.fps} fps, ${metadata.frameCount} frames`);
  });

  test('GIF at 15 fps has correct frame rate', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      fps: '15'
    });

    const metadata = await extractGifMetadata(page, gifUrl);

    // Validate FPS - use tolerance of 2 to account for GIF encoding variations and rounding
    expect(metadata.fps).toBeGreaterThanOrEqual(13);
    expect(metadata.fps).toBeLessThanOrEqual(17);

    console.log(`✅ [Mock Test] 15 fps GIF validated: ${metadata.fps} fps, ${metadata.frameCount} frames`);
  });

  // ========== Duration Validation Tests ==========
  // NOTE: Timeline interaction uses programmatic setTimeRange() method
  // Duration selection works correctly in mock tests via direct time range manipulation
  // Real E2E tests additionally validate manual timeline drag interaction

  test('GIF with 1s duration is correct length', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();

    await quickCapture.waitForScreen();
    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');

    // Set specific 1-second duration using improved setTimeRange
    await quickCapture.setTimeRange(0, 1);
    await page.waitForTimeout(500);

    // Verify duration was set correctly in UI before proceeding
    const selectedDuration = await quickCapture.getSelectionDuration();
    expect(selectedDuration).toBeCloseTo(1, 0); // Should be ~1s

    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(45000);

    await success.waitForScreen();
    const gifUrl = await success.getGifUrl();

    expect(gifUrl).toBeTruthy();

    const metadata = await extractGifMetadata(page, gifUrl!);

    // Validate duration matches what we set (with reasonable tolerance)
    console.log(`[Mock Test] GIF duration: ${metadata.duration}s (expected: 1s)`);

    expect(metadata.duration).toBeCloseTo(1, 0); // Allow ±1s tolerance
    expect(metadata.frameCount).toBeGreaterThan(0);
    expect(metadata.frameCount).toBeCloseTo(5, 2); // 5fps * 1s = ~5 frames

    console.log(`✅ [Mock Test] 1s duration GIF validated (actual: ${metadata.duration.toFixed(1)}s, ${metadata.frameCount} frames)`);
  });

  test('GIF with 3s duration is correct length', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();

    await quickCapture.waitForScreen();
    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');

    // Set specific 3-second duration using improved setTimeRange
    await quickCapture.setTimeRange(0, 3);
    await page.waitForTimeout(500);

    // Verify duration was set correctly in UI before proceeding
    const selectedDuration = await quickCapture.getSelectionDuration();
    expect(selectedDuration).toBeCloseTo(3, 0); // Should be ~3s

    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(45000);

    await success.waitForScreen();
    const gifUrl = await success.getGifUrl();

    expect(gifUrl).toBeTruthy();

    const metadata = await extractGifMetadata(page, gifUrl!);

    // Validate duration matches what we set (with reasonable tolerance)
    console.log(`[Mock Test] GIF duration: ${metadata.duration}s (expected: 3s)`);

    expect(metadata.duration).toBeCloseTo(3, 0); // Allow ±1s tolerance
    expect(metadata.frameCount).toBeGreaterThan(0);
    expect(metadata.frameCount).toBeCloseTo(15, 3); // 5fps * 3s = ~15 frames

    console.log(`✅ [Mock Test] 3s duration GIF validated (actual: ${metadata.duration.toFixed(1)}s, ${metadata.frameCount} frames)`);
  });

  test('GIF with 5s duration is correct length', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();

    await quickCapture.waitForScreen();
    await quickCapture.selectResolution('144p');
    await quickCapture.selectFps('5');

    // Set specific 5-second duration using improved setTimeRange
    await quickCapture.setTimeRange(0, 5);
    await page.waitForTimeout(500);

    // Verify duration was set correctly in UI before proceeding
    const selectedDuration = await quickCapture.getSelectionDuration();
    expect(selectedDuration).toBeCloseTo(5, 0); // Should be ~5s

    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(45000);

    await success.waitForScreen();
    const gifUrl = await success.getGifUrl();

    expect(gifUrl).toBeTruthy();

    const metadata = await extractGifMetadata(page, gifUrl!);

    // Validate duration matches what we set (with reasonable tolerance)
    console.log(`[Mock Test] GIF duration: ${metadata.duration}s (expected: 5s)`);

    expect(metadata.duration).toBeCloseTo(5, 0); // Allow ±1s tolerance
    expect(metadata.frameCount).toBeGreaterThan(0);
    expect(metadata.frameCount).toBeCloseTo(25, 3); // 5fps * 5s = ~25 frames

    console.log(`✅ [Mock Test] 5s duration GIF validated (actual: ${metadata.duration.toFixed(1)}s, ${metadata.frameCount} frames)`);
  });

  // ========== Text Overlay Test ==========
  // NOTE: Text overlay visual validation differs between mock and real E2E tests:
  // - Real E2E: Validates text actually appears in GIF output (OCR/visual validation)
  // - Mock E2E: Validates workflow completes (text interaction unreliable in mock environment)
  // For full text rendering validation, see real E2E tests (tests/e2e/gif-output-validation.spec.ts)

  test('Text overlay screen appears and GIF creation works', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();

    await quickCapture.waitForScreen();
    await quickCapture.selectResolution('240p');
    await quickCapture.selectFps('5');
    await quickCapture.clickNext();

    // Verify text overlay screen appears
    await textOverlay.waitForScreen();

    // NOTE: Text overlay interaction (typing text, positioning) is unreliable in mock environment
    // due to DOM manipulation issues. The actual text rendering is validated in real E2E tests.
    // Here we just verify the screen appears and we can proceed through the workflow.
    await textOverlay.clickSkip();

    await processing.waitForCompletion(45000);

    await success.waitForScreen();
    const gifUrl = await success.getGifUrl();

    expect(gifUrl).toBeTruthy();

    // Comprehensive validation of the output GIF
    const validation = await validateGifComplete(page, gifUrl!, {
      resolution: '240p',
      fps: 5,
      duration: 5
    });

    console.log('\n' + validation.summary);

    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);
    expect(validation.results.frameRate.valid).toBe(true);

    console.log(`✅ [Mock Test] Text overlay workflow validated (Note: Visual text validation done in real E2E tests)`);
  });

  // ========== Combined Validation Test ==========

  test('Combined settings produce correct output', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      resolution: '240p',
      fps: '10'
    });

    // Comprehensive validation
    const validation = await validateGifComplete(page, gifUrl, {
      resolution: '240p',
      fps: 10,
      duration: 5
    });

    console.log('\n' + validation.summary);

    expect(validation.passed).toBe(true);
    expect(validation.results.resolution.valid).toBe(true);
    expect(validation.results.frameRate.valid).toBe(true);

    console.log(`✅ [Mock Test] Combined validation passed (240p @ 10fps)`);
  });

  // ========== File Size Correlation Test ==========

  test('File size correlates with settings', async ({ page, mockServerUrl }) => {
    test.setTimeout(120000);

    const configs = [
      { resolution: '144p' as const, fps: '5' as const, label: 'smallest' },
      { resolution: '360p' as const, fps: '10' as const, label: 'largest' }
    ];

    const gifSizes: { label: string; fileSize: number; metadata: any }[] = [];

    for (const config of configs) {
      const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
        resolution: config.resolution,
        fps: config.fps
      });

      const metadata = await extractGifMetadata(page, gifUrl);

      gifSizes.push({
        label: config.label,
        fileSize: metadata.fileSize,
        metadata
      });

      console.log(`${config.label}: ${(metadata.fileSize / 1024).toFixed(1)} KB (${metadata.width}x${metadata.height}, ${metadata.fps}fps)`);
    }

    // Validate size correlation
    const smallestGif = gifSizes.find(g => g.label === 'smallest')!;
    const largestGif = gifSizes.find(g => g.label === 'largest')!;

    expect(largestGif.fileSize).toBeGreaterThan(smallestGif.fileSize);

    const sizeRatio = largestGif.fileSize / smallestGif.fileSize;
    console.log(`✅ [Mock Test] File size correlation validated (ratio: ${sizeRatio.toFixed(2)}x)`);
  });

  // ========== GIF Data URL Validation Test ==========

  test('GIF data URL is valid', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const { gifUrl } = await createAndValidateGif(page, mockServerUrl, {
      resolution: '144p',
      fps: '5'
    });

    // Validate URL format
    const isValidDataUrl = gifUrl.startsWith('data:image/gif');
    const isValidBlobUrl = gifUrl.startsWith('blob:');
    expect(isValidDataUrl || isValidBlobUrl).toBe(true);

    // Extract and validate metadata
    const metadata = await extractGifMetadata(page, gifUrl);

    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
    expect(metadata.frameCount).toBeGreaterThan(0);
    expect(metadata.fileSize).toBeGreaterThan(0);

    console.log(`✅ [Mock Test] GIF data URL validated (${(metadata.fileSize / 1024).toFixed(1)} KB)`);
  });
});
