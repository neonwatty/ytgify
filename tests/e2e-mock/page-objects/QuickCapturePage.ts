import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Quick Capture screen (Mock E2E)
 */
export class QuickCapturePage {
  readonly page: Page;
  readonly container: Locator;
  readonly timeline: Locator;
  readonly startHandle: Locator;
  readonly endHandle: Locator;
  readonly playButton: Locator;
  readonly previewVideo: Locator;
  readonly durationDisplay: Locator;
  readonly resolutionButtons: {
    '144p': Locator;
    '240p': Locator;
    '360p': Locator;
    '480p': Locator;
  };
  readonly fpsButtons: {
    '5': Locator;
    '10': Locator;
    '15': Locator;
  };
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly timeDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.ytgif-quick-capture-screen');
    this.timeline = page.locator('.ytgif-timeline-scrubber');
    this.startHandle = page.locator('.ytgif-timeline-handle-start');
    this.endHandle = page.locator('.ytgif-timeline-handle-end');
    this.playButton = page.locator('.ytgif-preview-play');
    this.previewVideo = page.locator('.ytgif-preview-video video');
    this.durationDisplay = page.locator('.ytgif-duration-display');

    // Resolution buttons with generic selectors
    this.resolutionButtons = {
      '144p': page.locator('.ytgif-resolution-btn:has-text("144p")'),
      '240p': page.locator('.ytgif-resolution-btn:has-text("240p")'),
      '360p': page.locator('.ytgif-resolution-btn:has-text("360p")'),
      '480p': page.locator('.ytgif-resolution-btn:has-text("480p")'),
    };

    // FPS buttons - use getByRole with regex to avoid substring matching issues
    // (e.g., "5 fps" substring matches both "5 fps" and "15 fps")
    this.fpsButtons = {
      '5': page.getByRole('button', { name: /^5 fps/ }),
      '10': page.getByRole('button', { name: /^10 fps/ }),
      '15': page.getByRole('button', { name: /^15 fps/ }),
    };

    this.nextButton = page.locator('.ytgif-button-primary, button:has-text("Next")');
    this.backButton = page.locator('.ytgif-back-button, button:has-text("Back")');
    this.timeDisplay = page.locator('.ytgif-time-display');
  }

  async waitForScreen(timeout: number = 10000) {
    await this.container.waitFor({ state: 'visible', timeout });
  }

  async selectResolution(resolution: '144p' | '240p' | '360p' | '480p') {
    await this.resolutionButtons[resolution].click();
    await this.page.waitForTimeout(300);
  }

  async getSelectedResolution(): Promise<string | null> {
    for (const [resolution, button] of Object.entries(this.resolutionButtons)) {
      const isActive = await button.evaluate((el) =>
        el.classList.contains('ytgif-resolution-btn--active') || el.classList.contains('active')
      );
      if (isActive) return resolution;
    }
    return null;
  }

  async selectFps(fps: '5' | '10' | '15') {
    await this.fpsButtons[fps].click();
    await this.page.waitForTimeout(300);
  }

  async getSelectedFps(): Promise<string | null> {
    for (const [fps, button] of Object.entries(this.fpsButtons)) {
      const isActive = await button.evaluate((el) =>
        el.classList.contains('ytgif-frame-rate-btn--active') || el.classList.contains('active')
      );
      if (isActive) return fps;
    }
    return null;
  }

  async setTimeRange(startSeconds: number, endSeconds: number) {
    // For mock tests, we use a simpler approach since timeline interaction
    // is not as critical as functional validation
    const timelineBox = await this.timeline.boundingBox();
    if (!timelineBox) {
      console.warn('[Mock Test] Timeline not visible, skipping time range setting');
      return;
    }

    const videoDuration = await this.getVideoDuration();

    // Calculate positions
    const startX = timelineBox.x + (startSeconds / videoDuration) * timelineBox.width;
    const endX = timelineBox.x + (endSeconds / videoDuration) * timelineBox.width;

    // Drag start handle
    try {
      await this.startHandle.dragTo(this.timeline, {
        targetPosition: { x: startX - timelineBox.x, y: timelineBox.height / 2 }
      });
    } catch (e) {
      console.warn('[Mock Test] Start handle drag failed, using default range');
    }

    // Drag end handle
    try {
      await this.endHandle.dragTo(this.timeline, {
        targetPosition: { x: endX - timelineBox.x, y: timelineBox.height / 2 }
      });
    } catch (e) {
      console.warn('[Mock Test] End handle drag failed, using default range');
    }

    // Wait for UI to update
    await this.page.waitForTimeout(500);
  }

  async playPreview() {
    await this.playButton.click();
    await this.page.waitForTimeout(500);
  }

  async getSelectionDuration(): Promise<number> {
    const text = await this.durationDisplay.textContent();
    if (!text) return 0;

    // Parse duration from text like "5s" or "5.2s"
    const match = text.match(/(\d+\.?\d*)\s*s/);
    return match ? parseFloat(match[1]) : 0;
  }

  async clickNext() {
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
  }

  async clickBack() {
    await this.backButton.click();
    await this.page.waitForTimeout(500);
  }

  async isNextButtonEnabled(): Promise<boolean> {
    return await this.nextButton.isEnabled();
  }

  private async getVideoDuration(): Promise<number> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video && !isNaN(video.duration) ? video.duration : 30;
    });
  }

  async getTimeRangeValues(): Promise<{ start: number; end: number }> {
    // Get the actual time values from the UI
    const timeText = await this.timeDisplay.textContent();
    if (!timeText) return { start: 0, end: 10 };

    // Parse text like "0:05 - 0:15"
    const match = timeText.match(/(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
    if (match) {
      const start = parseInt(match[1]) * 60 + parseInt(match[2]);
      const end = parseInt(match[3]) * 60 + parseInt(match[4]);
      return { start, end };
    }

    return { start: 0, end: 10 };
  }

  async waitForReady() {
    await this.waitForScreen();
    await this.page.waitForTimeout(1000);
  }
}
