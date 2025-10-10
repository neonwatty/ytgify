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
    // Use the duration slider approach (more reliable in mock environment)
    const videoDuration = await this.getVideoDuration();
    const targetDuration = endSeconds - startSeconds;

    // Validate inputs
    if (startSeconds < 0 || endSeconds > videoDuration || startSeconds >= endSeconds) {
      console.warn(`[Mock Test] Invalid time range: ${startSeconds}-${endSeconds}s (video duration: ${videoDuration}s)`);
      throw new Error(`Invalid time range: ${startSeconds}-${endSeconds}s`);
    }

    // Step 1: Click on the timeline to set the start position
    const timelineBox = await this.timeline.boundingBox();
    if (!timelineBox) {
      throw new Error('Timeline not visible');
    }

    const startPercent = startSeconds / videoDuration;
    const clickX = timelineBox.x + (startPercent * timelineBox.width);
    const clickY = timelineBox.y + (timelineBox.height / 2);

    await this.page.mouse.click(clickX, clickY);
    await this.page.waitForTimeout(300);

    // Step 2: Adjust the duration using the slider
    const durationSlider = this.page.locator('.ytgif-slider-input');
    await durationSlider.waitFor({ state: 'visible', timeout: 5000 });

    // Get slider constraints
    const sliderMax = await durationSlider.getAttribute('max');
    const maxDuration = sliderMax ? parseFloat(sliderMax) : 20;

    // Clamp duration to slider limits
    const clampedDuration = Math.min(Math.max(targetDuration, 1), maxDuration);

    // Set the slider value
    await durationSlider.fill(clampedDuration.toString());
    await this.page.waitForTimeout(300);

    // Step 3: Verify the change took effect
    const actualDuration = await this.getSelectionDuration();
    const tolerance = 0.5; // Allow 0.5s tolerance

    if (Math.abs(actualDuration - clampedDuration) > tolerance) {
      console.error(`[Mock Test] Timeline update failed: expected ${clampedDuration}s, got ${actualDuration}s`);
      throw new Error(`Timeline duration mismatch: expected ${clampedDuration}s, got ${actualDuration}s`);
    }

    console.log(`[Mock Test] ✅ Timeline set to ${startSeconds}s - ${endSeconds}s (${actualDuration}s duration)`);
  }

  async playPreview() {
    await this.playButton.click();
    await this.page.waitForTimeout(500);
  }

  async getSelectionDuration(): Promise<number> {
    // Try to read from the duration slider value display
    const sliderValue = this.page.locator('.ytgif-slider-value');
    try {
      const text = await sliderValue.textContent({ timeout: 2000 });
      if (text) {
        // Parse duration from text like "5.0s" or "5.2s"
        const match = text.match(/(\d+\.?\d*)\s*s/);
        if (match) return parseFloat(match[1]);
      }
    } catch {
      // Fallback to duration display if slider value not found
    }

    // Fallback: Try duration display
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
