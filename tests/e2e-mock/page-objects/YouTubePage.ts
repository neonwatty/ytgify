import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Mock YouTube page interactions
 * Simplified version for mock test environment
 */
export class YouTubePage {
  readonly page: Page;
  readonly videoElement: Locator;
  readonly gifButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.videoElement = page.locator('video');
    this.gifButton = page.locator('.ytgif-button');
  }

  /**
   * Navigate to a mock video URL
   */
  async navigateToVideo(videoUrl: string) {
    await this.page.goto(videoUrl);
    await this.waitForVideoReady();
  }

  /**
   * Wait for video and GIF button to be ready
   */
  async waitForVideoReady(timeout: number = 15000) {
    // Wait for video element
    await this.videoElement.waitFor({ state: 'visible', timeout });

    // Wait for video to have valid duration (loaded)
    await this.page.waitForFunction(
      () => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && !isNaN(video.duration) && video.duration > 0;
      },
      { timeout }
    );

    // Wait for GIF button to be injected
    await this.gifButton.waitFor({ state: 'visible', timeout });

    // Small delay for stability
    await this.page.waitForTimeout(500);
  }

  /**
   * Open the GIF wizard by clicking the GIF button
   */
  async openGifWizard() {
    await this.gifButton.click();

    // Wait for wizard overlay to appear
    await this.page.waitForFunction(
      () => document.querySelector('.ytgif-overlay-wizard, .ytgif-quick-capture-screen') !== null,
      { timeout: 5000 }
    );

    await this.page.waitForTimeout(500);
  }

  /**
   * Pause the video
   */
  async pauseVideo() {
    const isPlaying = await this.isVideoPlaying();
    if (isPlaying) {
      await this.page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) video.pause();
      });
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Play the video
   */
  async playVideo() {
    const isPlaying = await this.isVideoPlaying();
    if (!isPlaying) {
      await this.page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) video.play();
      });
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Seek to a specific time in the video
   */
  async seekToTime(seconds: number) {
    await this.page.evaluate((time) => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (video) {
        video.currentTime = time;
      }
    }, seconds);
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if video is currently playing
   */
  async isVideoPlaying(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? !video.paused && !video.ended : false;
    });
  }

  /**
   * Get video duration
   */
  async getVideoDuration(): Promise<number> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video && !isNaN(video.duration) ? video.duration : 0;
    });
  }

  /**
   * Get current playback time
   */
  async getCurrentTime(): Promise<number> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? video.currentTime : 0;
    });
  }

  /**
   * Wait for extension to fully load and inject GIF button
   */
  async waitForExtensionLoad(timeout: number = 30000) {
    await this.page.waitForFunction(
      () => document.querySelector('.ytgif-button') !== null,
      { timeout }
    );
  }

  /**
   * Check if GIF button is visible
   */
  async isGifButtonVisible(): Promise<boolean> {
    try {
      return await this.gifButton.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Wait for video to be loaded and playable
   */
  async waitForVideoLoaded(timeout: number = 15000) {
    await this.page.waitForFunction(
      () => {
        const video = document.querySelector('video') as HTMLVideoElement;
        return video && video.readyState >= 2; // HAVE_CURRENT_DATA or better
      },
      { timeout }
    );
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(): Promise<{
    duration: number;
    currentTime: number;
    paused: boolean;
    width: number;
    height: number;
  }> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      if (!video) {
        return { duration: 0, currentTime: 0, paused: true, width: 0, height: 0 };
      }
      return {
        duration: video.duration || 0,
        currentTime: video.currentTime || 0,
        paused: video.paused,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      };
    });
  }
}
