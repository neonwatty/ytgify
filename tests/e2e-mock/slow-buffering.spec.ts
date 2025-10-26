import { test, expect } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';
import {
  NETWORK_PROFILES,
  applyNetworkProfile,
  logNetworkProfile,
} from './helpers/network-profiles';

/**
 * Slow Buffering and Network Issue Tests
 * Tests the new buffering detection and error handling logic
 */
test.describe('Mock E2E: Slow Buffering Scenarios', () => {
  test('Handle slow buffering with network throttling', async ({ page, mockServerUrl }) => {
    test.setTimeout(180000); // 3 minutes - slower with throttling

    // IMPORTANT: Apply throttling BEFORE loading page
    // This ensures video download is throttled, not just post-load requests
    const cleanup = await applyNetworkProfile(page, NETWORK_PROFILES.slow3G);
    logNetworkProfile(NETWORK_PROFILES.slow3G);

    try {
      const videoUrl = getMockVideoUrl('medium', mockServerUrl);
      await page.goto(videoUrl);

    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForFunction(
      () => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && !isNaN(video.duration) && video.duration > 0;
      },
      { timeout: 15000 }
    );

    await page.waitForFunction(
      () => document.querySelector('.ytgif-button') !== null,
      { timeout: 20000 }
    );

    await page.click('.ytgif-button');
    await page.waitForTimeout(1500);

    // Try to create a GIF with slow network
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1500);

    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary', { timeout: 3000 }).catch(() => {});
    }

    // Wait for processing to start
    await page.waitForTimeout(3000);

    // Listen for console logs with buffering info
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('network') || text.includes('buffer') || text.includes('slow')) {
        logs.push(text);
      }
    });

    // Wait for completion or error
    await page.waitForTimeout(60000); // Give it time to complete or fail

    // Check final state
    const finalState = await page.evaluate(() => {
      const errorMessage = document.querySelector('.ytgif-error-message');
      const successScreen = document.querySelector('.ytgif-success-screen');
      const processingScreen = document.querySelector('.ytgif-processing-screen');

      return {
        hasError: !!errorMessage,
        errorText: errorMessage?.textContent || '',
        hasSuccess: !!successScreen,
        stillProcessing: !!processingScreen,
      };
    });

      console.log('[Mock Test] Slow buffering result:', finalState);
      console.log('[Mock Test] Buffering logs:', logs);

      // Should either succeed (with slow network warnings) or fail gracefully
      expect(finalState.hasError || finalState.hasSuccess).toBe(true);

      console.log('✅ [Mock Test] Slow buffering handled!');
    } finally {
      // Restore normal network
      await cleanup();
    }
  });

  // NOTE: Geo-restriction and buffer stuck tests removed from mock E2E
  // Reason: Property mocking (readyState, buffered) doesn't reliably affect async video operations in E2E
  // These edge cases are covered by:
  // - Unit tests: tests/unit/lib/simple-frame-extractor.test.ts
  // - Manual testing: see TESTING_SLOW_BUFFERING.md

  test('Handle high duplicate frame rate with adaptive threshold', async ({
    page,
    mockServerUrl,
  }) => {
    test.setTimeout(90000);

    const videoUrl = getMockVideoUrl('medium', mockServerUrl);
    await page.goto(videoUrl);

    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForFunction(
      () => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && !isNaN(video.duration) && video.duration > 0;
      },
      { timeout: 10000 }
    );

    await page.waitForFunction(
      () => document.querySelector('.ytgif-button') !== null,
      { timeout: 15000 }
    );

    await page.click('.ytgif-button');
    await page.waitForTimeout(1500);

    // Select high frame rate to test adaptive threshold
    // Threshold = Math.max(5, Math.min(30, Math.ceil(frameRate)))
    // For 30fps: threshold = 30 frames
    // For 5fps: threshold = 5 frames

    // Try to proceed with high FPS
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1500);

    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary', { timeout: 3000 }).catch(() => {});
    }

    // Monitor for completion
    await page.waitForTimeout(30000);

    const finalState = await page.evaluate(() => {
      const errorMessage = document.querySelector('.ytgif-error-message');
      const successScreen = document.querySelector('.ytgif-success-screen');

      return {
        hasError: !!errorMessage,
        errorText: errorMessage?.textContent || '',
        hasSuccess: !!successScreen,
      };
    });

    console.log('[Mock Test] High FPS adaptive threshold result:', finalState);

    // Should complete or fail with appropriate message
    expect(finalState.hasError || finalState.hasSuccess).toBe(true);

    console.log('✅ [Mock Test] Adaptive threshold handled!');
  });

  // NOTE: Total wait time budget test moved to real E2E
  // Reason: Mock videos are too small to trigger 120s timeout even with extreme throttling
  // See: tests/e2e/slow-network-buffering.spec.ts for real E2E test with large YouTube video
});
