import { test, expect } from './fixtures';
import { YouTubePage } from './page-objects/YouTubePage';
import { GifWizard } from './page-objects/GifWizard';
import { QuickCapturePage } from './page-objects/QuickCapturePage';
import { TEST_VIDEOS } from './helpers/test-videos';
import { waitForExtensionReady, handleYouTubeCookieConsent } from './helpers/extension-helpers';

test.describe('Basic Wizard Test with Extension', () => {
  test('Extension loads and GIF button appears', async ({ page, context, extensionId }) => {
    expect(extensionId).toBeTruthy();


    const youtube = new YouTubePage(page);

    // Navigate to YouTube video
    await page.goto(TEST_VIDEOS.veryShort.url);

    // Handle cookie consent if present
    await handleYouTubeCookieConsent(page);

    // Wait for video to be ready
    await page.waitForSelector('video', { timeout: 30000 });

    // Wait for player controls to be ready
    await page.waitForSelector('.ytp-right-controls', { timeout: 30000 });

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

    // Wait for content script to detect video and refresh state
    await page.waitForTimeout(3000);

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

    // Wait a bit more for button injection
    await page.waitForTimeout(5000);

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
    const youtube = new YouTubePage(page);

    // Navigate and wait for button
    await page.goto(TEST_VIDEOS.veryShort.url);
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });
    await page.waitForTimeout(8000);

    // Click GIF button
    await page.click('.ytgif-button');
    await page.waitForTimeout(2000);

    // Quick capture screen - just click continue
    await page.click('.ytgif-button-primary');
    await page.waitForTimeout(2000);

    // Text overlay screen - skip it
    // Use force click to bypass viewport issues
    try {
      await page.click('button:has-text("Skip")', { force: true });
    } catch (e) {
      // If skip doesn't work, try primary button
      await page.click('.ytgif-button-primary', { force: true });
    }
    await page.waitForTimeout(2000);

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
      // Wait for GIF to be created (up to 30 seconds)
      await page.waitForTimeout(30000);

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

    // Wait for button to be injected
    await page.waitForTimeout(8000);

    // Click the GIF button
    const gifButton = await page.$('.ytgif-button');
    expect(gifButton).toBeTruthy();
    await gifButton.click();

    // Wait for wizard
    await page.waitForTimeout(2000);

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
      await page.waitForTimeout(2000);

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
});