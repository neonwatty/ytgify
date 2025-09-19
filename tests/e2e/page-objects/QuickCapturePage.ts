import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Quick Capture screen
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
    this.resolutionButtons = {
      '144p': page.locator('button:has-text("144p Nano")'),
      '240p': page.locator('button:has-text("240p Mini")'),
      '360p': page.locator('button:has-text("360p Compact")'),
      '480p': page.locator('button:has-text("480p HD")'),
    };
    this.fpsButtons = {
      '5': page.locator('button:has-text("5 fps")'),
      '10': page.locator('button:has-text("10 fps")'),
      '15': page.locator('button:has-text("15 fps")'),
    };
    this.nextButton = page.locator('button:has-text("Next"), button:has-text("Add Text")');
    this.backButton = page.locator('button:has-text("Back")');
    this.timeDisplay = page.locator('.ytgif-time-display');
  }

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
    await this.timeline.waitFor({ state: 'visible', timeout: 5000 });
  }

  async setTimeRange(startSeconds: number, endSeconds: number) {
    // Set start time by dragging handle
    const timelineBox = await this.timeline.boundingBox();
    if (!timelineBox) throw new Error('Timeline not visible');

    const videoDuration = await this.getVideoDuration();

    // Calculate positions
    const startX = timelineBox.x + (startSeconds / videoDuration) * timelineBox.width;
    const endX = timelineBox.x + (endSeconds / videoDuration) * timelineBox.width;

    // Drag start handle
    await this.startHandle.dragTo(this.timeline, {
      targetPosition: { x: startX - timelineBox.x, y: timelineBox.height / 2 }
    });

    // Drag end handle
    await this.endHandle.dragTo(this.timeline, {
      targetPosition: { x: endX - timelineBox.x, y: timelineBox.height / 2 }
    });

    // Wait for UI to update
    await this.page.waitForTimeout(500);
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
  }

  async clickBack() {
    await this.backButton.click();
  }

  async isNextButtonEnabled(): Promise<boolean> {
    return await this.nextButton.isEnabled();
  }

  private async getVideoDuration(): Promise<number> {
    return await this.page.evaluate(() => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video ? video.duration : 30; // Default fallback
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
}