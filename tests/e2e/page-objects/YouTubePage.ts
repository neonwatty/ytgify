import { Page, Locator } from '@playwright/test';
import { waitForExtensionReady } from '../helpers/extension-helpers';

/**
 * Page Object Model for YouTube video page interactions
 */
export class YouTubePage {
  readonly page: Page;
  readonly videoPlayer: Locator;
  readonly videoElement: Locator;
  readonly playerControls: Locator;
  readonly gifButton: Locator;
  readonly playButton: Locator;
  readonly currentTimeDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.videoPlayer = page.locator('#movie_player');
    this.videoElement = page.locator('video');
    this.playerControls = page.locator('.ytp-right-controls');
    this.gifButton = page.locator('.ytgif-button');
    this.playButton = page.locator('.ytp-play-button');
    this.currentTimeDisplay = page.locator('.ytp-time-current');
  }

  async navigateToVideo(videoUrl: string) {
    await this.page.goto(videoUrl);
    // Wait for content script readiness marker to confirm extension injected
    const hasMarker = await this.page
      .waitForFunction(() => document.body?.getAttribute('data-ytgif-ready') === 'true', {
        timeout: 5000,
      })
      .then(() => true)
      .catch(() => false);

    if (!hasMarker) {
      // Retry once by reloading the same URL
      await this.page.goto(videoUrl);
      const markerOnRetry = await this.page
        .waitForFunction(() => document.body?.getAttribute('data-ytgif-ready') === 'true', {
          timeout: 5000,
        })
        .then(() => true)
        .catch(() => false);

      if (!markerOnRetry) {
        // Fall back to generic extension-ready check before giving up
        const injected = await this.waitForExtensionInjection();
        if (!injected) {
          throw new Error('Content script did not inject (ytgif-ready marker missing)');
        }
      }
    }
    await this.waitForVideoReady();
  }

  private async waitForExtensionInjection(): Promise<boolean> {
    // Best-effort wait for the GIF button or overlay hook to appear
    const hasMarker = await this.page
      .waitForFunction(
        () =>
          !!document.querySelector('.ytgif-button') ||
          (window as any).__ytgifTestHooksReady === true ||
          document.body?.getAttribute('data-ytgif-ready') === 'true',
        { timeout: 5000 }
      )
      .then(() => true)
      .catch(() => false);

    if (!hasMarker) {
      // As a final check, use the shared helper that waits for the extension button
      return await waitForExtensionReady(this.page, 5000).catch(() => false);
    }

    return true;
  }

  async waitForVideoReady() {
    // Wait for video element to be present
    await this.videoElement.waitFor({ state: 'visible', timeout: 15000 });

    // Enable button visibility for testing (button defaults to hidden)
    await this.page.evaluate(() => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ buttonVisibility: true });
      }
    });

    // Send a window message that the content script listens for as a fallback
    await this.page.evaluate(() => {
      window.postMessage({ type: 'ytgif-force-button-visibility', visible: true }, '*');
    });

    // Retry loop to ensure the GIF button is injected (best effort)
    try {
      await this.page.waitForFunction(() => {
        const hasButton = !!document.querySelector('.ytgif-button');
        if (hasButton) return true;

        // Kick the content script again to show the button
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
          chrome.storage.sync.set({ buttonVisibility: true });
        }
        window.postMessage({ type: 'ytgif-force-button-visibility', visible: true }, '*');
        return false;
      }, { timeout: 30000, polling: 500 });
    } catch {
      // Fall through — openGifWizard will try keyboard shortcut as a fallback
    }

    // Dismiss any overlays or ensure focus
    try {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(500);
    } catch {
      // Ignore if escape doesn't work
    }

    // Hover over video player to ensure controls are visible (needed in headless mode)
    try {
      await this.page.hover('video', { timeout: 5000 });
    } catch {
      // If hover fails, try alternative approach
      await this.page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) {
          video.dispatchEvent(new MouseEvent('mouseenter'));
        }
      });
    }

    // Click video to ensure it's focused
    await this.page.click('video', { force: true });

    // Wait for controls to appear
    await this.page.waitForTimeout(1000);

    // Wait for player controls to be loaded
    await this.playerControls.waitFor({ state: 'visible', timeout: 10000 });

    // Small delay for content script to detect video and inject button
    await this.page.waitForTimeout(2000);

    // Wait for GIF button to be injected by extension (best effort)
    try {
      await this.gifButton.waitFor({ state: 'visible', timeout: 30000 });
    } catch {
      // Fall through; openGifWizard will attempt keyboard shortcut
    }

    // Very small delay to ensure everything is settled
    await this.page.waitForTimeout(500);
  }

  async openGifWizard() {
    const overlaySelector = '.ytgif-overlay-wizard';
    const readySelector = '[data-ytgif-ready="true"], .ytgif-button';

    // Wait for test hooks or readiness marker to be present so direct-open works
    const hasHooks = await this.page
      .waitForFunction(
        () =>
          (window as any).__ytgifTestHooksReady === true ||
          document.body.getAttribute('data-ytgif-ready') === 'true',
        { timeout: 5000 }
      )
      .then(() => true)
      .catch(() => false);

    if (!hasHooks) {
      // Best-effort: still continue, but log to console for debugging
      await this.page.evaluate(() => {
        console.warn('[YouTubePage] Test hooks readiness not confirmed');
      }).catch(() => {});
    }

    // Quick liveness check: ping content script
    const pong = await this.page
      .evaluate(() => {
        return new Promise<boolean>((resolve) => {
          const listener = (event: MessageEvent) => {
            if (event.data?.type === 'ytgif-pong') {
              window.removeEventListener('message', listener);
              resolve(true);
            }
          };
          window.addEventListener('message', listener);
          window.postMessage({ type: 'ytgif-ping' }, '*');
          setTimeout(() => resolve(false), 1000);
        });
      })
      .catch(() => false);

    if (!pong) {
      throw new Error('Content script not responsive (no pong)');
    }

    // Quick readiness poll for injected button/marker
    const hasMarker = await this.page
      .waitForSelector(readySelector, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!hasMarker) {
      await this.page.evaluate(() => {
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
          chrome.storage.sync.set({ buttonVisibility: true });
        }
        window.postMessage({ type: 'ytgif-force-button-visibility', visible: true }, '*');
      }).catch(() => {});
    }

    const tryDirectOpen = async (): Promise<boolean> => {
      await this.page.evaluate(() => {
        window.postMessage({ type: 'ytgif-open-wizard-direct' }, '*');
      });
      return await this.page
        .waitForSelector(overlaySelector, { timeout: 1500 })
        .then(() => true)
        .catch(() => false);
    };

    // Try direct-open hook first with several quick retries to avoid long hangs
    let overlayAppeared = false;
    for (let i = 0; i < 5; i++) {
      overlayAppeared = await tryDirectOpen();
      if (overlayAppeared) break;
      await this.page.waitForTimeout(300);
    }

    if (!overlayAppeared) {
      const buttonVisible = await this.gifButton.isVisible().catch(() => false);

      if (buttonVisible) {
        await this.gifButton.click();
      } else {
        // Force visibility again and then fall back to keyboard shortcut if needed
        await this.page.evaluate(() => {
          if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
            chrome.storage.sync.set({ buttonVisibility: true });
          }
          window.postMessage({ type: 'ytgif-force-button-visibility', visible: true }, '*');
        });

        const clicked =
          (await this.gifButton.isVisible().catch(() => false)) &&
          (await this.gifButton.click().then(() => true).catch(() => false));

        if (!clicked) {
          // Try keyboard shortcut (Cmd/Ctrl + Shift + G) or direct wizard open hook
          await this.page.keyboard.press('Meta+Shift+G').catch(() => {});
          await this.page.keyboard.press('Control+Shift+G').catch(() => {});
          await this.page.evaluate(() => {
            window.postMessage({ type: 'ytgif-open-wizard-direct' }, '*');
          });
        }
      }

      // Wait for overlay to appear (longer timeout since we rely on hooks)
      await this.page.waitForSelector(overlaySelector, { timeout: 10000 });
    }

    // Fail fast if overlay never appeared to avoid 90s test timeouts
    const finalOverlay = await this.page
      .waitForSelector(overlaySelector, { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (!finalOverlay) {
      throw new Error('Failed to open GIF wizard: overlay not found');
    }
  }

  async pauseVideo() {
    const isPlaying = await this.isVideoPlaying();
    if (isPlaying) {
      await this.playButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async playVideo() {
    const isPlaying = await this.isVideoPlaying();
    if (!isPlaying) {
      await this.playButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async seekToTime(seconds: number) {
    await this.page.evaluate((time) => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) {
        video.currentTime = time;
      }
    }, seconds);
    await this.page.waitForTimeout(500);
  }

  async isVideoPlaying(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? !video.paused : false;
    });
  }

  async getVideoDuration(): Promise<number> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? video.duration : 0;
    });
  }

  async getCurrentTime(): Promise<number> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? video.currentTime : 0;
    });
  }

  async waitForExtensionLoad() {
    // Wait for the extension to fully load and inject its elements
    await this.page.waitForFunction(
      () => {
        const gifButton = document.querySelector('.ytgif-button, [aria-label*="GIF"]');
        return gifButton !== null;
      },
      { timeout: 30000 }
    );
  }

  async isGifButtonVisible(): Promise<boolean> {
    return await this.gifButton.isVisible();
  }

  async acceptCookiesIfPresent() {
    try {
      // Handle YouTube cookie consent if it appears
      const acceptButton = this.page.locator('button:has-text("Accept all"), button:has-text("Reject all")').first();
      if (await acceptButton.isVisible({ timeout: 5000 })) {
        await acceptButton.click();
        await this.page.waitForTimeout(1000);
      }
    } catch {
      // Cookie banner not present, continue
    }
  }
}
