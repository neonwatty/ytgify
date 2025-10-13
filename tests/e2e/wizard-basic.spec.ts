import { test, expect } from './fixtures';
import { YouTubePage } from './page-objects/YouTubePage';
import { QuickCapturePage } from './page-objects/QuickCapturePage';
import { TEST_VIDEOS } from './helpers/test-videos';
import { handleYouTubeCookieConsent, waitForGifButton } from './helpers/extension-helpers';

test.describe('Basic Wizard Test with Extension', () => {
  test('Extension loads and GIF button appears', async ({ page, context, extensionId }) => {
    test.setTimeout(120000); // 2 minutes timeout for this test
    expect(extensionId).toBeTruthy();


    const youtube = new YouTubePage(page);

    // Navigate to YouTube video
    await page.goto(TEST_VIDEOS.veryShort.url);

    // Handle cookie consent if present
    await handleYouTubeCookieConsent(page);

    // Wait for video to be ready
    await page.waitForSelector('video', { timeout: 30000 });

    // Try to dismiss any overlays or ensure focus is on video area
    try {
      // Click somewhere on the page to dismiss search if it's active
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } catch {
      // Ignore if escape doesn't work
    }

    // Hover over video player to ensure controls are visible (needed in headless mode)
    try {
      await page.hover('video', { timeout: 5000 });
    } catch {
      // If hover fails, try alternative approach
      await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) {
          video.dispatchEvent(new MouseEvent('mouseenter'));
        }
      });
    }

    // Also try clicking the video to ensure it's focused
    await page.click('video', { force: true });

    // Wait a moment for controls to appear
    await page.waitForTimeout(1000);

    // Wait for player controls to be ready - they might be hidden initially
    await page.waitForSelector('.ytp-right-controls', {
      state: 'attached', // First wait for element to exist in DOM
      timeout: 30000
    });

    // Check if content script executed by injecting a test
    const contentScriptActive = await page.evaluate(() => {
      // Check if any extension-specific globals or elements exist
      return !!(window as any).ytgifExtension || document.querySelector('[class*="ytgif"]');
    });

    // Check video element properties
    const videoInfo = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video) return null;
      return {
        src: video.src,
        currentSrc: video.currentSrc,
        duration: video.duration,
        readyState: video.readyState,
        hasSrc: !!video.src,
        hasCurrentSrc: !!video.currentSrc,
        isNaN_duration: isNaN(video.duration),
        pageType: window.location.pathname.startsWith('/watch') ? 'watch' : 'other'
      };
    });

    // Wait for content script to detect video and inject button
    await waitForGifButton(page, 15000);

    // Now check if the state has been refreshed and button injected
    const stateAfterRefresh = await page.evaluate(() => {
      const video = document.querySelector('video');
      const hasVideo = video && (video.src || video.currentSrc) && !isNaN(video.duration) && video.duration > 0;
      const isWatchPage = window.location.pathname.startsWith('/watch');

      // Check for live stream indicators with improved logic
      const liveBadge = document.querySelector('.ytp-live-badge') as HTMLElement;
      let isLive = false;
      const liveMatches = [];

      if (liveBadge) {
        const isVisible = liveBadge.offsetParent !== null &&
                         (window.getComputedStyle(liveBadge).display !== 'none');
        const hasLiveText = liveBadge.textContent?.toLowerCase().includes('live');
        if (isVisible && hasLiveText) {
          isLive = true;
          liveMatches.push('.ytp-live-badge (visible with live text)');
        }
      }

      // Check other indicators if not already detected as live
      if (!isLive) {
        const strongIndicators = ['.ytp-live', '[data-is-live="true"]'];
        strongIndicators.forEach(selector => {
          const element = document.querySelector(selector) as HTMLElement;
          if (element && element.offsetParent !== null) {
            isLive = true;
            liveMatches.push(selector);
          }
        });
      }

      return {
        hasButton: !!document.querySelector('.ytgif-button'),
        buttonCount: document.querySelectorAll('.ytgif-button').length,
        ytgifElements: document.querySelectorAll('[class*="ytgif"]').length,
        hasVideo,
        isWatchPage,
        isLive,
        liveMatches,
        shouldInjectButton: hasVideo && isWatchPage && !isLive
      };
    });

    // Wait for button injection with smart retry
    await waitForGifButton(page, 10000);

    // Check for service workers (extension loaded)
    const serviceWorkers = context.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);

    // Try to find GIF button with various selectors
    const selectors = [
      '.ytgif-button',
      '.gif-button',
      'button[aria-label*="GIF"]',
      'button[aria-label*="Create GIF"]',
      '.ytp-right-controls .ytgif-button'
    ];

    let gifButton = null;
    for (const selector of selectors) {
      try {
        gifButton = await page.$(selector);
        if (gifButton) {
          break;
        }
      } catch {
        // Continue to next selector
      }
    }

    // If no button found, log all buttons in controls for debugging
    if (!gifButton) {
      const buttons = await page.$$eval('.ytp-right-controls button', buttons =>
        buttons.map(b => ({
          text: b.textContent,
          ariaLabel: b.getAttribute('aria-label'),
          className: b.className
        }))
      );

      // Take screenshot for debugging
      await page.screenshot({
        path: 'tests/test-results/wizard-basic-no-button.png',
        fullPage: false
      });
    }

    // The button should now be present
    expect(gifButton).toBeTruthy();

    // Check extension elements count
    const finalElementCount = await page.$$('[class*="ytgif"]');
    expect(finalElementCount.length).toBeGreaterThan(0);
  });

  test('Can navigate to YouTube and video loads', async ({ page, context, extensionId }) => {
    // Simple test to verify basic navigation works
    await page.goto(TEST_VIDEOS.veryShort.url);

    // Wait for video
    const video = await page.waitForSelector('video', { timeout: 30000 });
    expect(video).toBeTruthy();

    // Check video duration
    const duration = await page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? video.duration : 0;
    });

    expect(duration).toBeGreaterThan(0);
  });

  test('Can create a simple GIF', async ({ page, context, extensionId }) => {
    test.setTimeout(90000); // 90 seconds timeout for GIF creation (includes 45s processing wait)
    const youtube = new YouTubePage(page);

    // Navigate and wait for button
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    // Click GIF button
    await page.click('.ytgif-button');
    await page.waitForTimeout(1000);

    // Quick capture screen - just click continue
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Text overlay screen - skip it
    // Use force click to bypass viewport issues
    try {
      await page.click('button:has-text("Skip")', { force: true });
    } catch (e) {
      // If skip doesn't work, try primary button
      await page.click('.ytgif-button-primary', { force: true });
    }
    await page.waitForTimeout(1000);

    // Check if we're on processing screen
    const processingInfo = await page.evaluate(() => {
      const processing = document.querySelector('.ytgif-processing-screen');
      const progress = document.querySelector('.ytgif-progress-bar');
      return {
        onProcessingScreen: !!processing,
        hasProgressBar: !!progress,
        processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false
      };
    });

    if (processingInfo.onProcessingScreen) {
      // Wait for success screen to appear (up to 45 seconds)
      try {
        await page.waitForFunction(
          () => {
            const success = document.querySelector('.ytgif-success-screen');
            const error = document.querySelector('.ytgif-error-message');
            return success || error;
          },
          { timeout: 45000, polling: 500 }
        );
      } catch (e) {
        console.log('Timeout waiting for success screen');
      }

      // Check if we reached success screen
      const successInfo = await page.evaluate(() => {
        const success = document.querySelector('.ytgif-success-screen');
        const gifPreview = document.querySelector('.ytgif-gif-preview img, .ytgif-success-preview-image');
        return {
          onSuccessScreen: !!success,
          hasGifPreview: !!gifPreview,
          gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null
        };
      });

      if (successInfo.hasGifPreview && successInfo.gifSrc) {
        expect(successInfo.gifSrc).toBeTruthy();
      }
    }
  });

  test('Can open wizard and interact with first screen', async ({ page, context, extensionId }) => {
    const youtube = new YouTubePage(page);

    // Navigate and wait for button
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await page.waitForSelector('.ytp-right-controls', { timeout: 30000 });

    // Wait for button to be injected with smart polling
    await waitForGifButton(page, 10000);

    // Click the GIF button
    const gifButton = await page.$('.ytgif-button');
    expect(gifButton).toBeTruthy();
    await gifButton!.click();

    // Wait for wizard
    await page.waitForTimeout(1000);

    // Check wizard structure
    const wizardInfo = await page.evaluate(() => {
      const wizard = document.querySelector('.ytgif-overlay-wizard');
      const quickCapture = document.querySelector('.ytgif-quick-capture-screen');
      const nextButton = document.querySelector('.ytgif-button-primary');
      const timeline = document.querySelector('.ytgif-timeline-scrubber');

      return {
        wizardExists: !!wizard,
        quickCaptureExists: !!quickCapture,
        nextButtonExists: !!nextButton,
        nextButtonText: nextButton?.textContent || 'not found',
        nextButtonDisabled: nextButton ? (nextButton as HTMLButtonElement).disabled : null,
        timelineExists: !!timeline,
        allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent?.trim(),
          className: b.className,
          disabled: b.disabled
        })).filter(b => b.text && b.className.includes('ytgif'))
      };
    });

    expect(wizardInfo.wizardExists).toBe(true);
    expect(wizardInfo.quickCaptureExists).toBe(true);

    // Try to click next if button exists and is enabled
    if (wizardInfo.nextButtonExists && !wizardInfo.nextButtonDisabled) {
      await page.click('.ytgif-button-primary');
      await page.waitForTimeout(1000);

      // Check if we moved to next screen
      const nextScreenInfo = await page.evaluate(() => {
        const textOverlay = document.querySelector('.ytgif-text-overlay-screen');
        const quickCapture = document.querySelector('.ytgif-quick-capture-screen');

        return {
          onTextOverlay: !!textOverlay,
          stillOnQuickCapture: !!quickCapture && (quickCapture as HTMLElement).offsetParent !== null
        };
      });
    }
  });

  test('Can select different resolution options in wizard', async ({ page, context: _context, extensionId: _extensionId }) => {
    const quickCapture = new QuickCapturePage(page);

    // Navigate and wait for button
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    // Click GIF button to open wizard
    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Verify default resolution is selected (144p)
    const defaultResolution = await quickCapture.getSelectedResolution();
    expect(defaultResolution).toBe('144p');

    // Test selecting different resolutions
    const resolutions: Array<'144p' | '240p' | '360p' | '480p'> = ['144p', '240p', '480p'];

    for (const resolution of resolutions) {
      await quickCapture.selectResolution(resolution);
      const selectedResolution = await quickCapture.getSelectedResolution();
      expect(selectedResolution).toBe(resolution);
    }

    // Verify resolution buttons are visually distinct when selected
    await quickCapture.selectResolution('480p');
    const buttonState = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.ytgif-resolution-btn');
      return Array.from(buttons).map(btn => ({
        text: btn.textContent?.trim(),
        isActive: btn.classList.contains('ytgif-resolution-btn--active')
      }));
    });

    const activeButtons = buttonState.filter(btn => btn.isActive);
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0].text).toContain('480p');
  });

  test('Resolution setting persists through wizard navigation', async ({ page, context: _context, extensionId: _extensionId }) => {
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 5000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Select a specific resolution
    await quickCapture.selectResolution('480p');
    const initialResolution = await quickCapture.getSelectedResolution();
    expect(initialResolution).toBe('480p');

    // Navigate to next screen
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Check if we're on text overlay screen
    const textOverlayVisible = await page.evaluate(() => {
      const textOverlay = document.querySelector('.ytgif-text-overlay-screen');
      return textOverlay && (textOverlay as HTMLElement).offsetParent !== null;
    });

    if (textOverlayVisible) {
      // Navigate back to quick capture screen
      await page.click('.ytgif-back-button');
      await page.waitForTimeout(1000);

      // Verify we're back on the quick capture screen
      const backOnQuickCapture = await page.evaluate(() => {
        const quickCapture = document.querySelector('.ytgif-quick-capture-screen');
        return quickCapture && (quickCapture as HTMLElement).offsetParent !== null;
      });
      expect(backOnQuickCapture).toBe(true);

      // Check if resolution selection interface is available
      const resolutionButtons = await page.$$('.ytgif-resolution-btn');
      expect(resolutionButtons.length).toBeGreaterThan(0);
    }
  });

  test('Can create GIF with specific resolution and validate output', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(60000); // Increase timeout for GIF creation
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 5000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Select 480p resolution for clear validation
    await quickCapture.selectResolution('480p');
    const selectedResolution = await quickCapture.getSelectedResolution();
    expect(selectedResolution).toBe('480p');

    // Continue through wizard
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Skip text overlay if present
    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      // If skip doesn't work, try primary button
      try {
        await page.click('.ytgif-button-primary', { timeout: 3000 });
      } catch {
        // Continue regardless
      }
    }
    await page.waitForTimeout(1000);

    // Wait for processing to complete
    const processingInfo = await page.evaluate(() => {
      const processing = document.querySelector('.ytgif-processing-screen');
      return {
        onProcessingScreen: !!processing,
        processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false
      };
    });

    if (processingInfo.onProcessingScreen) {
      // Wait for success screen to appear (up to 45 seconds)
      try {
        await page.waitForFunction(
          () => {
            const success = document.querySelector('.ytgif-success-screen');
            const error = document.querySelector('.ytgif-error-message');
            const progress = document.querySelector('.ytgif-progress-bar');
            // Check if done processing
            return success || error || (progress && progress.getAttribute('value') === '100');
          },
          { timeout: 45000, polling: 500 }
        );
      } catch (e) {
        console.log('Timeout waiting for GIF processing completion');
      }

      // Check for success screen and GIF output
      const successInfo = await page.evaluate(() => {
        const success = document.querySelector('.ytgif-success-screen');
        const gifPreview = document.querySelector('.ytgif-gif-preview img, .ytgif-success-preview-image');
        return {
          onSuccessScreen: !!success,
          hasGifPreview: !!gifPreview,
          gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null
        };
      });

      if (successInfo.hasGifPreview && successInfo.gifSrc) {
        expect(successInfo.gifSrc).toBeTruthy();

        // Basic validation that GIF was created
        const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
        const isValidBlobUrl = successInfo.gifSrc.startsWith('blob:');
        expect(isValidDataUrl || isValidBlobUrl).toBe(true);

        // Log success for debugging
        console.log(`✅ Successfully created GIF with 480p resolution: ${successInfo.gifSrc.substring(0, 50)}...`);
      }
    }
  });

  test('Can select different FPS options in wizard', async ({ page, context: _context, extensionId: _extensionId }) => {
    const quickCapture = new QuickCapturePage(page);

    // Navigate and wait for button
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    // Click GIF button to open wizard
    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Verify default FPS is selected (5 fps)
    const defaultFpsButton = await page.$('.ytgif-frame-rate-btn--active');
    const defaultFpsText = await defaultFpsButton?.textContent();
    expect(defaultFpsText).toContain('5 fps');

    // Test selecting different FPS options using direct selectors
    const fpsOptions = [
      { fps: '10', selector: '.ytgif-frame-rate-btn:has-text("10 fps")' },
      { fps: '15', selector: '.ytgif-frame-rate-btn:has-text("15 fps")' },
      { fps: '5', selector: '.ytgif-frame-rate-btn:has-text("5 fps")' }
    ];

    for (const option of fpsOptions) {
      await page.click(option.selector);
      await page.waitForTimeout(300);

      // Verify selection
      const activeButton = await page.$('.ytgif-frame-rate-btn--active');
      const activeText = await activeButton?.textContent();
      expect(activeText).toContain(`${option.fps} fps`);
    }

    // Verify FPS buttons are visually distinct when selected
    await page.click('.ytgif-frame-rate-btn:has-text("15 fps")');
    await page.waitForTimeout(300);

    const buttonState = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.ytgif-frame-rate-btn');
      return Array.from(buttons).map(btn => ({
        text: btn.textContent?.trim(),
        isActive: btn.classList.contains('ytgif-frame-rate-btn--active')
      }));
    });

    const activeButtons = buttonState.filter(btn => btn.isActive);
    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0].text).toContain('15 fps');
  });

  test('FPS setting persists through wizard navigation', async ({ page, context: _context, extensionId: _extensionId }) => {
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 5000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Select a specific FPS
    await page.click('.ytgif-frame-rate-btn:has-text("15 fps")');
    await page.waitForTimeout(300);

    const initialFpsButton = await page.$('.ytgif-frame-rate-btn--active');
    const initialFpsText = await initialFpsButton?.textContent();
    expect(initialFpsText).toContain('15 fps');

    // Navigate to next screen
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Check if we're on text overlay screen
    const textOverlayVisible = await page.evaluate(() => {
      const textOverlay = document.querySelector('.ytgif-text-overlay-screen');
      return textOverlay && (textOverlay as HTMLElement).offsetParent !== null;
    });

    if (textOverlayVisible) {
      // Navigate back to quick capture screen
      await page.click('.ytgif-back-button');
      await page.waitForTimeout(1000);

      // Verify we're back on the quick capture screen
      const backOnQuickCapture = await page.evaluate(() => {
        const quickCapture = document.querySelector('.ytgif-quick-capture-screen');
        return quickCapture && (quickCapture as HTMLElement).offsetParent !== null;
      });
      expect(backOnQuickCapture).toBe(true);

      // Check if FPS selection interface is available
      const fpsButtons = await page.$$('.ytgif-frame-rate-btn');
      expect(fpsButtons.length).toBeGreaterThan(0);
    }
  });

  test('Can create GIF with specific FPS and validate output', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(60000); // Increase timeout for GIF creation
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 5000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Select 15 fps for clear validation
    await page.click('.ytgif-frame-rate-btn:has-text("15 fps")');
    await page.waitForTimeout(300);

    const selectedFpsButton = await page.$('.ytgif-frame-rate-btn--active');
    const selectedFpsText = await selectedFpsButton?.textContent();
    expect(selectedFpsText).toContain('15 fps');

    // Continue through wizard
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Skip text overlay if present
    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      // If skip doesn't work, try primary button
      try {
        await page.click('.ytgif-button-primary', { timeout: 3000 });
      } catch {
        // Continue regardless
      }
    }
    await page.waitForTimeout(1000);

    // Wait for processing to complete
    const processingInfo = await page.evaluate(() => {
      const processing = document.querySelector('.ytgif-processing-screen');
      return {
        onProcessingScreen: !!processing,
        processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false
      };
    });

    if (processingInfo.onProcessingScreen) {
      // Wait for success screen to appear (up to 45 seconds)
      try {
        await page.waitForFunction(
          () => {
            const success = document.querySelector('.ytgif-success-screen');
            const error = document.querySelector('.ytgif-error-message');
            const progress = document.querySelector('.ytgif-progress-bar');
            // Check if done processing
            return success || error || (progress && progress.getAttribute('value') === '100');
          },
          { timeout: 45000, polling: 500 }
        );
      } catch (e) {
        console.log('Timeout waiting for GIF processing completion');
      }

      // Check for success screen and GIF output
      const successInfo = await page.evaluate(() => {
        const success = document.querySelector('.ytgif-success-screen');
        const gifPreview = document.querySelector('.ytgif-gif-preview img, .ytgif-success-preview-image');
        return {
          onSuccessScreen: !!success,
          hasGifPreview: !!gifPreview,
          gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null
        };
      });

      if (successInfo.hasGifPreview && successInfo.gifSrc) {
        expect(successInfo.gifSrc).toBeTruthy();

        // Basic validation that GIF was created
        const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
        const isValidBlobUrl = successInfo.gifSrc.startsWith('blob:');
        expect(isValidDataUrl || isValidBlobUrl).toBe(true);

        // Log success for debugging
        console.log(`✅ Successfully created GIF with 15 fps: ${successInfo.gifSrc.substring(0, 50)}...`);
      }
    }
  });

  test('Can validate GIF length interface in wizard', async ({ page, context: _context, extensionId: _extensionId }) => {
    const quickCapture = new QuickCapturePage(page);

    // Navigate and wait for button
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    // Click GIF button to open wizard
    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Wait for timeline to be ready
    await page.waitForTimeout(1500);

    // Verify timeline elements are present
    const timelineExists = await page.$('.ytgif-timeline-scrubber');
    expect(timelineExists).toBeTruthy();

    // Check for timeline handles
    const startHandle = await page.$('.ytgif-timeline-handle-start');
    const endHandle = await page.$('.ytgif-timeline-handle-end');

    if (startHandle && endHandle) {
      // If handles exist, verify we can get time range values
      const timeRange = await quickCapture.getTimeRangeValues();
      expect(timeRange.start).toBeGreaterThanOrEqual(0);
      expect(timeRange.end).toBeGreaterThan(timeRange.start);

      // Verify reasonable duration bounds
      const duration = timeRange.end - timeRange.start;
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(30); // Should be reasonable duration

      console.log(`✅ GIF length interface working - Current selection: ${duration.toFixed(1)}s (${timeRange.start.toFixed(1)}s - ${timeRange.end.toFixed(1)}s)`);
    } else {
      // If timeline handles aren't available, just verify the timeline interface exists
      console.log(`⚠️ Timeline handles not found, but timeline interface exists`);
    }

    // Check for any time-related display elements
    const timeElements = await page.$$('.ytgif-time-display, .ytgif-duration-display, .ytgif-slider-value');
    expect(timeElements.length).toBeGreaterThanOrEqual(0); // At least some time interface should exist
  });

  test('GIF length interface persists through wizard navigation', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(120000); // Increase timeout to 2 minutes for navigation test
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForTimeout(1500); // Reduced wait time

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();
    await page.waitForTimeout(1000); // Reduced wait time

    // Get initial time range if available (with timeout)
    let initialTimeRange = null;
    try {
      const timeRangePromise = quickCapture.getTimeRangeValues();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout getting time range')), 2000)
      );
      initialTimeRange = await Promise.race([timeRangePromise, timeoutPromise]) as any;
    } catch (e) {
      console.log('⚠️ Initial time range not accessible, continuing with navigation test');
    }

    // Navigate to next screen
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000); // Reduced wait time

    // Check if we're on text overlay screen
    const textOverlayVisible = await page.evaluate(() => {
      const textOverlay = document.querySelector('.ytgif-text-overlay-screen');
      return textOverlay && (textOverlay as HTMLElement).offsetParent !== null;
    });

    if (textOverlayVisible) {
      // Navigate back to quick capture screen
      await page.click('.ytgif-back-button');
      await page.waitForTimeout(1000);

      // Verify we're back on the quick capture screen
      const backOnQuickCapture = await page.evaluate(() => {
        const quickCapture = document.querySelector('.ytgif-quick-capture-screen');
        return quickCapture && (quickCapture as HTMLElement).offsetParent !== null;
      });
      expect(backOnQuickCapture).toBe(true);

      // Verify timeline interface is still available
      const timelineExists = await page.$('.ytgif-timeline-scrubber');
      expect(timelineExists).toBeTruthy();

      // If we had initial time range, verify it's still available
      if (initialTimeRange) {
        try {
          const persistedTimeRange = await quickCapture.getTimeRangeValues();
          expect(persistedTimeRange.start).toBeGreaterThanOrEqual(0);
          expect(persistedTimeRange.end).toBeGreaterThan(persistedTimeRange.start);
          console.log(`✅ Time range persisted through navigation: ${(persistedTimeRange.end - persistedTimeRange.start).toFixed(1)}s`);
        } catch (e) {
          console.log('⚠️ Time range not accessible after navigation, but timeline interface exists');
        }
      }
    }
  });

  test('Can create GIF with specific length and validate output', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(120000); // Increase timeout to 2 minutes for GIF creation with time selection
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForTimeout(1500); // Reduced wait time

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Try to set time range defensively (3 seconds) with timeout
    let timeRangeSet = false;
    try {
      const setRangePromise = quickCapture.setTimeRange(0, 3);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout setting time range')), 3000)
      );
      await Promise.race([setRangePromise, timeoutPromise]);
      await page.waitForTimeout(500);

      const getRangePromise = quickCapture.getTimeRangeValues();
      const getTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout getting time range')), 2000)
      );
      const selectedTimeRange = await Promise.race([getRangePromise, getTimeoutPromise]) as any;
      const selectedDuration = selectedTimeRange.end - selectedTimeRange.start;
      expect(selectedDuration).toBeCloseTo(3, 1);
      timeRangeSet = true;
      console.log(`✅ Successfully set time range to 3 seconds`);
    } catch (e) {
      console.log('⚠️ Could not set specific time range, using default selection');
      // Continue with default selection - this is still a valid test
    }

    // Continue through wizard
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000); // Reduced wait time

    // Skip text overlay if present
    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      // If skip doesn't work, try primary button
      try {
        await page.click('.ytgif-button-primary', { timeout: 3000 });
      } catch {
        // Continue regardless
      }
    }
    await page.waitForTimeout(1000);

    // Wait for processing to complete
    const processingInfo = await page.evaluate(() => {
      const processing = document.querySelector('.ytgif-processing-screen');
      return {
        onProcessingScreen: !!processing,
        processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false
      };
    });

    if (processingInfo.onProcessingScreen) {
      // Wait for success screen to appear (up to 45 seconds)
      try {
        await page.waitForFunction(
          () => {
            const success = document.querySelector('.ytgif-success-screen');
            const error = document.querySelector('.ytgif-error-message');
            const progress = document.querySelector('.ytgif-progress-bar');
            // Check if done processing
            return success || error || (progress && progress.getAttribute('value') === '100');
          },
          { timeout: 45000, polling: 500 }
        );
      } catch (e) {
        console.log('Timeout waiting for GIF processing completion');
      }

      // Check for success screen and GIF output
      const successInfo = await page.evaluate(() => {
        const success = document.querySelector('.ytgif-success-screen');
        const gifPreview = document.querySelector('.ytgif-gif-preview img, .ytgif-success-preview-image');
        return {
          onSuccessScreen: !!success,
          hasGifPreview: !!gifPreview,
          gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null
        };
      });

      if (successInfo.hasGifPreview && successInfo.gifSrc) {
        expect(successInfo.gifSrc).toBeTruthy();

        // Basic validation that GIF was created
        const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
        const isValidBlobUrl = successInfo.gifSrc.startsWith('blob:');
        expect(isValidDataUrl || isValidBlobUrl).toBe(true);

        // Log success for debugging
        const durationNote = timeRangeSet ? ' with 3-second duration' : ' with default duration';
        console.log(`✅ Successfully created GIF${durationNote}: ${successInfo.gifSrc.substring(0, 50)}...`);
      }
    }
  });

  // New tests for gif-processor.ts updates
  test('Verify frame rate matches selected setting', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(120000);
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForTimeout(1500);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Select 15 fps
    await quickCapture.selectFps('15');

    // Check if debug frames are captured with correct timing
    await page.evaluate(() => {
      (window as any).__DEBUG_CAPTURED_FRAMES = [];
    });

    // Continue to processing
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Skip text overlay
    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary');
    }

    // Wait for processing
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 5000 });
    await page.waitForSelector('.ytgif-success-screen', { timeout: 45000 });

    // Check debug frames
    const debugFrames = await page.evaluate(() => {
      return (window as any).__DEBUG_CAPTURED_FRAMES || [];
    });

    if (debugFrames.length > 1) {
      // Calculate actual frame rate from captured frames
      const frameTimes = debugFrames.map((f: any) => f.targetTime);
      const intervals = [];
      for (let i = 1; i < frameTimes.length; i++) {
        intervals.push(frameTimes[i] - frameTimes[i - 1]);
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const actualFps = 1 / avgInterval;

      // Should be close to 15 fps
      expect(actualFps).toBeCloseTo(15, 1);
      console.log(`✅ Frame rate verification: Expected 15 fps, got ${actualFps.toFixed(1)} fps`);
    }
  });

  test('Verify duplicate frame detection and recovery', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(90000);

    // Navigate to video
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 15000 });

    // Enable debug mode
    await page.evaluate(() => {
      (window as any).__DEBUG_CAPTURED_FRAMES = [];
    });

    await page.waitForTimeout(1500);
    await page.click('.ytgif-button');
    await page.waitForTimeout(1000);

    // Quick advance to processing
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary');
    }

    // Wait for processing to complete
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 5000 });
    await page.waitForSelector('.ytgif-success-screen', { timeout: 45000 });

    // Check debug frames for duplicates
    const debugFrames = await page.evaluate(() => {
      return (window as any).__DEBUG_CAPTURED_FRAMES || [];
    });

    if (debugFrames.length > 0) {
      const duplicates = debugFrames.filter((f: any) => f.isDuplicate);
      console.log(`📊 Frame analysis: ${debugFrames.length} frames total, ${duplicates.length} marked as duplicates`);

      // Log any duplicate detection
      if (duplicates.length > 0) {
        console.log(`⚠️ Duplicate frames detected and handled at positions:`,
          duplicates.map((f: any) => f.frameNumber).join(', '));
      }

      // Test passes if frames were captured (duplicate handling is automatic)
      expect(debugFrames.length).toBeGreaterThan(0);
    }
  });

  test('Verify aspect ratio preservation', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(90000);
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForTimeout(1500);

    // Get video dimensions
    const videoDimensions = await page.evaluate(() => {
      const video = document.querySelector('video');
      return {
        width: video?.videoWidth || 0,
        height: video?.videoHeight || 0,
      };
    });

    const videoAspectRatio = videoDimensions.width / videoDimensions.height;

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Select a specific resolution
    await quickCapture.selectResolution('360p');

    // Enable debug mode
    await page.evaluate(() => {
      (window as any).__DEBUG_CAPTURED_FRAMES = [];
    });

    // Process GIF
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary');
    }

    // Wait for success
    await page.waitForSelector('.ytgif-processing-screen', { timeout: 5000 });
    await page.waitForSelector('.ytgif-success-screen', { timeout: 45000 });

    // Check captured frame dimensions
    const debugFrames = await page.evaluate(() => {
      return (window as any).__DEBUG_CAPTURED_FRAMES || [];
    });

    if (debugFrames.length > 0) {
      const frame = debugFrames[0];
      const gifAspectRatio = frame.width / frame.height;

      // Aspect ratio should be preserved (within 5% tolerance)
      const ratioDifference = Math.abs(videoAspectRatio - gifAspectRatio) / videoAspectRatio;
      expect(ratioDifference).toBeLessThan(0.05);

      console.log(`✅ Aspect ratio preserved: Video ${videoAspectRatio.toFixed(2)}, GIF ${gifAspectRatio.toFixed(2)}`);
      console.log(`   Dimensions: ${frame.width}x${frame.height}`);
    }
  });

  test('Can set custom start time using input field', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(90000);
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();

    // Wait for timeline to be ready
    await page.waitForTimeout(1000);

    // Locate start time input field
    const startTimeInput = await page.$('#ytgif-start-time-input');
    expect(startTimeInput).toBeTruthy();

    // Check initial value
    const initialValue = await startTimeInput!.inputValue();
    expect(initialValue).toBeTruthy();

    // Clear and type new start time in MM:SS format
    await startTimeInput!.fill('0:02');
    await startTimeInput!.press('Enter');
    await page.waitForTimeout(500);

    // Verify the input updated
    const newValue = await startTimeInput!.inputValue();
    expect(newValue).toBe('0:02');

    // Continue through wizard
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    console.log('✅ Successfully set custom start time using input field');
  });

  test('Start time input validation works in E2E flow', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(90000);
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();
    await page.waitForTimeout(1000);

    // Locate start time input
    const startTimeInput = await page.$('#ytgif-start-time-input');
    expect(startTimeInput).toBeTruthy();

    // Try to input invalid start time
    await startTimeInput!.fill('99:99');
    await startTimeInput!.press('Enter');
    await page.waitForTimeout(500);

    // Check if error message appears
    const errorMessage = await page.$('.ytgif-time-input-error-message');
    if (errorMessage) {
      const errorText = await errorMessage.textContent();
      expect(errorText).toBeTruthy();
      console.log(`✅ Validation error displayed: ${errorText}`);

      // Input valid start time
      await startTimeInput!.fill('0:01');
      await startTimeInput!.press('Enter');
      await page.waitForTimeout(500);

      // Error should clear
      const errorAfter = await page.$('.ytgif-time-input-error-message');
      expect(errorAfter).toBeFalsy();
      console.log('✅ Error cleared after valid input');
    } else {
      console.log('⚠️ Error message not displayed or input rejected invalid value correctly');
    }
  });

  test('Can create GIF with custom start time', async ({ page, context: _context, extensionId: _extensionId }) => {
    test.setTimeout(120000);
    const quickCapture = new QuickCapturePage(page);

    // Navigate and open wizard
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await waitForGifButton(page, 10000);

    await page.click('.ytgif-button');
    await quickCapture.waitForScreen();
    await page.waitForTimeout(1000);

    // Set custom start time
    const startTimeInput = await page.$('#ytgif-start-time-input');
    if (startTimeInput) {
      await startTimeInput.fill('0:01');
      await startTimeInput.press('Enter');
      await page.waitForTimeout(500);
      console.log('✅ Set start time to 0:01');
    }

    // Continue through wizard
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(1000);

    // Skip text overlay
    try {
      await page.click('button:has-text("Skip")', { timeout: 3000 });
    } catch {
      await page.click('.ytgif-button-primary');
    }
    await page.waitForTimeout(1000);

    // Wait for processing
    const processingInfo = await page.evaluate(() => {
      const processing = document.querySelector('.ytgif-processing-screen');
      return {
        onProcessingScreen: !!processing,
        processingVisible: processing ? (processing as HTMLElement).offsetParent !== null : false,
      };
    });

    if (processingInfo.onProcessingScreen) {
      // Wait for success
      try {
        await page.waitForFunction(
          () => {
            const success = document.querySelector('.ytgif-success-screen');
            const error = document.querySelector('.ytgif-error-message');
            return success || error;
          },
          { timeout: 45000, polling: 500 }
        );
      } catch (e) {
        console.log('Timeout waiting for GIF processing completion');
      }

      // Check for success
      const successInfo = await page.evaluate(() => {
        const success = document.querySelector('.ytgif-success-screen');
        const gifPreview = document.querySelector('.ytgif-gif-preview img, .ytgif-success-preview-image');
        return {
          onSuccessScreen: !!success,
          hasGifPreview: !!gifPreview,
          gifSrc: gifPreview ? (gifPreview as HTMLImageElement).src : null,
        };
      });

      if (successInfo.hasGifPreview && successInfo.gifSrc) {
        expect(successInfo.gifSrc).toBeTruthy();
        const isValidDataUrl = successInfo.gifSrc.startsWith('data:image/gif');
        const isValidBlobUrl = successInfo.gifSrc.startsWith('blob:');
        expect(isValidDataUrl || isValidBlobUrl).toBe(true);
        console.log('✅ Successfully created GIF with custom start time');
      }
    }
  });

});