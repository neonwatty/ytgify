import { test, expect } from './fixtures';
import { YouTubePage } from './page-objects/YouTubePage';
import { handleYouTubeCookieConsent, waitForGifButton } from './helpers/extension-helpers';
import { NETWORK_PROFILES, applyNetworkProfile, logNetworkProfile } from '../e2e-mock/helpers/network-profiles';

/**
 * REAL E2E: Slow Network and Buffering Tests
 *
 * NOTE: These tests require actual YouTube access and cannot run in CI.
 * Run locally with: npm run test:e2e:headed
 *
 * Tests the reported issue: https://github.com/neonwatty/ytgify/issues/XX
 * User reported GIF creation stopping at 2/6 seconds with slow network
 */
test.describe('Real E2E: Slow Network Buffering', () => {
  // These scenarios are opt-in due to long run times and external network requirements.
  test.skip(
    ({ browserName }) => browserName !== 'chromium' || process.env.RUN_SLOW_NETWORK !== 'true',
    'Chromium only and requires RUN_SLOW_NETWORK=true to enable'
  );

  test('Handle slow network with throttling - user reported scenario', async ({
    page,
    context,
    extensionId,
  }) => {
    test.setTimeout(300000); // 5 minutes - slow network takes time

    expect(extensionId).toBeTruthy();

    // Apply throttling BEFORE navigation
    const cleanup = await applyNetworkProfile(page, NETWORK_PROFILES.slow3G);
    logNetworkProfile(NETWORK_PROFILES.slow3G);

    try {
      // Use the exact video from user report
      // https://www.youtube.com/watch?v=cuTKalhZmw8&t=1986s
      await page.goto('https://www.youtube.com/watch?v=cuTKalhZmw8&t=1986s');

    await handleYouTubeCookieConsent(page);

    // Wait for video
    await page.waitForSelector('video', { timeout: 60000 });
    await page.waitForFunction(
      () => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && !isNaN(video.duration) && video.duration > 0;
      },
      { timeout: 60000 }
    );

    // Wait for GIF button
    await waitForGifButton(page, 30000);

    // Let video buffer a bit at the target position
    console.log('[Real Test] Waiting for initial buffering at 33:06...');
    await page.waitForTimeout(10000);

    // Click GIF button
    await page.click('.ytgif-button');
    await page.waitForTimeout(2000);

    // Set exact parameters from user report:
    // - Start time: 33:06 (1986s)
    // - Duration: 6 seconds
    // - Resolution: 360p
    // - Frame rate: 15 fps

    console.log('[Real Test] Setting GIF parameters...');

    // Input start time (should already be at 33:06 from URL timestamp)
    // Input duration: 6 seconds
    const durationInput = await page.$('input[placeholder*="duration"], input[type="number"]');
    if (durationInput) {
      await durationInput.fill('6');
    }

    // Select 360p resolution
    const resolutionSelect = await page.$(
      'select[name="resolution"], button:has-text("360p")'
    );
    if (resolutionSelect) {
      await resolutionSelect.click();
      await page.click('text=360p').catch(() => {});
    }

    // Select 15 fps
    const fpsSelect = await page.$('select[name="fps"], select[name="frameRate"]');
    if (fpsSelect) {
      await fpsSelect.selectOption('15');
    }

    await page.waitForTimeout(1000);

    // Proceed to next step
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(2000);

    // Skip text overlay
    try {
      await page.click('button:has-text("Skip")', { timeout: 5000 });
    } catch {
      // If no skip button, click primary to continue
      await page.click('.ytgif-button-primary', { timeout: 3000 }).catch(() => {});
    }

    await page.waitForTimeout(2000);

    // Monitor console for buffering logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (
        text.includes('buffer') ||
        text.includes('duplicate') ||
        text.includes('frame') ||
        text.includes('slow') ||
        text.includes('wait')
      ) {
        console.log('[Console]', text);
        logs.push(text);
      }
    });

    // Wait for processing to complete or error (up to 4 minutes)
    // Expected: 90 frames × ~2-3s per frame = 180-270s worst case
    console.log('[Real Test] Processing GIF with slow network...');
    await page.waitForTimeout(240000); // 4 minutes

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

    console.log('[Real Test] Final state:', finalState);
    console.log('[Real Test] Buffering log count:', logs.length);

      // Assertions:
      // 1. Should NOT silently create incomplete GIF
      // 2. Should either succeed with all 90 frames OR fail with clear error
      expect(finalState.stillProcessing).toBe(false);
      expect(finalState.hasError || finalState.hasSuccess).toBe(true);

      if (finalState.hasSuccess) {
        console.log('✅ [Real Test] Successfully completed with slow network!');

        // Verify frame count via debug global if available
        const frameCount = await page.evaluate(() => {
          return (window as any).__DEBUG_CAPTURED_FRAMES?.length || 0;
        });

        console.log(`[Real Test] Captured frames: ${frameCount}`);

        // Should have close to 90 frames (6s × 15fps)
        if (frameCount > 0) {
          expect(frameCount).toBeGreaterThanOrEqual(85); // Allow some variance
          expect(frameCount).toBeLessThanOrEqual(95);
        }
      } else if (finalState.hasError) {
        console.log('✅ [Real Test] Failed gracefully with clear error!');
        console.log('[Real Test] Error message:', finalState.errorText);

        // Error should be informative
        expect(finalState.errorText.length).toBeGreaterThan(20);
        expect(
          finalState.errorText.toLowerCase().includes('buffer') ||
            finalState.errorText.toLowerCase().includes('slow') ||
            finalState.errorText.toLowerCase().includes('network')
        ).toBe(true);
      }
    } finally {
      await cleanup();
    }
  });

  test('Normal network should complete successfully', async ({ page, context, extensionId }) => {
    test.setTimeout(120000); // 2 minutes

    expect(extensionId).toBeTruthy();

    // No throttling - normal network speed
    const youtube = new YouTubePage(page);

    // Use shorter, stable test video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Rick Astley (stable)

    await handleYouTubeCookieConsent(page);

    await page.waitForSelector('video', { timeout: 30000 });
    await page.waitForFunction(
      () => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && !isNaN(video.duration) && video.duration > 0;
      },
      { timeout: 30000 }
    );

    await waitForGifButton(page, 20000);

    // Click GIF button
    await page.click('.ytgif-button');
    await page.waitForTimeout(1500);

    // Use defaults (should be quick)
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1500);

    // Skip text
    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary', { timeout: 3000 }).catch(() => {});
    }

    // Wait for completion (should be fast with good network)
    await page.waitForTimeout(30000);

    const finalState = await page.evaluate(() => {
      const successScreen = document.querySelector('.ytgif-success-screen');
      const errorMessage = document.querySelector('.ytgif-error-message');

      return {
        hasSuccess: !!successScreen,
        hasError: !!errorMessage,
        errorText: errorMessage?.textContent || '',
      };
    });

    console.log('[Real Test] Normal network result:', finalState);

    // Should succeed without errors
    expect(finalState.hasSuccess).toBe(true);
    expect(finalState.hasError).toBe(false);

    console.log('✅ [Real Test] Completed successfully with normal network!');
  });

  test('Total wait time budget enforcement with extreme throttling', async ({
    page,
    context,
    extensionId,
  }) => {
    test.setTimeout(240000); // 4 minutes - needs time to hit 120s budget + detection

    expect(extensionId).toBeTruthy();

    // Apply extreme throttling BEFORE navigation
    // Using very slow profile: 50kbps download, 2000ms latency
    const cleanup = await applyNetworkProfile(page, NETWORK_PROFILES.verySlow);
    logNetworkProfile(NETWORK_PROFILES.verySlow);

    try {
      // Use long video - Bill Wurtz "history of the entire world, i guess" (20 min)
      // Attempt 10s clip at 30fps = 300 frames
      // With extreme throttling, each frame might take 1-3s = 300-900s total
      // Should exceed 120s budget and abort
      await page.goto('https://www.youtube.com/watch?v=xuCn8ux2gbs&t=600s'); // Start at 10min

      await handleYouTubeCookieConsent(page);

      await page.waitForSelector('video', { timeout: 60000 });
      await page.waitForFunction(
        () => {
          const video = document.querySelector('video') as HTMLVideoElement;
          return video && !isNaN(video.duration) && video.duration > 0;
        },
        { timeout: 60000 }
      );

      await waitForGifButton(page, 30000);

      // Click GIF button
      await page.click('.ytgif-button');
      await page.waitForTimeout(2000);

      // Set parameters designed to exceed budget:
      // - Duration: 10 seconds
      // - Frame rate: 30 fps
      // - Total frames: 300
      // - With 50kbps + 2000ms latency, expect ~1-3s per frame buffering
      // - Should hit 120s budget around frame 40-120

      console.log('[Real Test] Setting aggressive parameters for timeout test...');

      const durationInput = await page.$('input[placeholder*="duration"], input[type="number"]');
      if (durationInput) {
        await durationInput.fill('10');
      }

      const fpsSelect = await page.$('select[name="fps"], select[name="frameRate"]');
      if (fpsSelect) {
        await fpsSelect.selectOption('30');
      }

      await page.waitForTimeout(1000);

      await page.click('.ytgif-button-primary');
      await page.waitForTimeout(2000);

      // Skip text overlay
      try {
        await page.click('button:has-text("Skip")', { timeout: 5000 });
      } catch {
        await page.click('.ytgif-button-primary', { timeout: 3000 }).catch(() => {});
      }

      await page.waitForTimeout(2000);

      // Monitor console for timeout messages
      const logs: string[] = [];
      page.on('console', (msg) => {
        const text = msg.text();
        if (
          text.includes('total') ||
          text.includes('timeout') ||
          text.includes('budget') ||
          text.includes('too long')
        ) {
          console.log('[Console]', text);
          logs.push(text);
        }
      });

      // Wait for timeout to trigger (120s budget + some processing time)
      // Should abort within ~130-150 seconds
      console.log('[Real Test] Waiting for total wait time budget to be exceeded...');
      await page.waitForTimeout(180000); // 3 minutes

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

      console.log('[Real Test] Total wait budget final state:', finalState);
      console.log('[Real Test] Timeout log count:', logs.length);

      // Assertions:
      // 1. Should NOT still be processing (should have aborted)
      expect(finalState.stillProcessing).toBe(false);

      // 2. Should have error (timeout), NOT success
      expect(finalState.hasError).toBe(true);
      expect(finalState.hasSuccess).toBe(false);

      // 3. Error message should mention timeout/budget
      expect(
        finalState.errorText.toLowerCase().includes('too long') ||
          finalState.errorText.toLowerCase().includes('timeout') ||
          finalState.errorText.toLowerCase().includes('120')
      ).toBe(true);

      console.log('✅ [Real Test] Total wait time budget enforced!');
      console.log('[Real Test] Error message:', finalState.errorText);
    } finally {
      await cleanup();
    }
  });
});
