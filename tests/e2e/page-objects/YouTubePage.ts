import { Page, Locator } from '@playwright/test';

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
    await this.waitForVideoReady();
  }

  async waitForVideoReady() {
    // Wait for video element to be present
    await this.videoElement.waitFor({ state: 'visible', timeout: 15000 });

    // Wait for player controls to be loaded
    await this.playerControls.waitFor({ state: 'visible', timeout: 10000 });

    // Small delay for content script to detect video and inject button
    await this.page.waitForTimeout(2000);

    // Wait for GIF button to be injected by extension
    await this.gifButton.waitFor({ state: 'visible', timeout: 15000 });

    // Very small delay to ensure everything is settled
    await this.page.waitForTimeout(500);
  }

  async openGifWizard() {
    await this.gifButton.click();
    // Wait for overlay to appear
    await this.page.waitForSelector('.ytgif-overlay-wizard', { timeout: 5000 });
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