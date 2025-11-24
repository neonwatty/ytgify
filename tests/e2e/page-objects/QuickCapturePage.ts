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
      '5': page.locator('button.ytgif-frame-rate-btn:has-text("5 fps")').first(),
      '10': page.locator('button.ytgif-frame-rate-btn:has-text("10 fps")').first(),
      '15': page.locator('button.ytgif-frame-rate-btn:has-text("15 fps")').first(),
    };
    this.nextButton = page.locator('button:has-text("Next"), button:has-text("Add Text"), button:has-text("Continue to Customize")');
    this.backButton = page.locator('button:has-text("Back")');
    this.timeDisplay = page.locator('.ytgif-duration-display');
  }

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
    await this.timeline.waitFor({ state: 'visible', timeout: 5000 });
  }

  async setTimeRange(startSeconds: number, endSeconds: number) {
    // Use the start time input and duration slider to align with the real UI controls
    const maxDuration = 10; // UI caps at 10s; clamp here for predictable tests
    const duration = Math.min(maxDuration, Math.max(1, endSeconds - startSeconds));

    // Update start time via input (accepts seconds or MM:SS)
    const startInput = this.page.locator('#ytgif-start-time-input');
    if (await startInput.isVisible()) {
      await startInput.fill(startSeconds.toFixed(1));
      await startInput.press('Enter');
    }

    // Adjust duration through the slider so selection length matches expectations
    const durationSlider = this.page.locator('.ytgif-slider-input');
    if (await durationSlider.isVisible()) {
      const sliderMax = parseFloat((await durationSlider.getAttribute('max')) || '20');
      const appliedDuration = Math.min(duration, sliderMax);
      await durationSlider.evaluate((el, value) => {
        const input = el as HTMLInputElement;
        input.value = value.toString();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, appliedDuration);
    }

    // Give the UI a moment to propagate changes
    await this.page.waitForTimeout(300);
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
    // Prefer the actual control values to avoid relying on rendered text formatting
    const parseTime = (value: string | null): number | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (trimmed.includes(':')) {
        const [mins, secs] = trimmed.split(':');
        const minutesNum = parseInt(mins, 10);
        const secondsNum = parseFloat(secs);
        if (!Number.isNaN(minutesNum) && !Number.isNaN(secondsNum)) {
          return minutesNum * 60 + secondsNum;
        }
        return null;
      }

      const numeric = parseFloat(trimmed);
      return Number.isNaN(numeric) ? null : numeric;
    };

    let start = 0;
    const startInput = this.page.locator('#ytgif-start-time-input');
    if (await startInput.isVisible()) {
      const value = await startInput.inputValue();
      const parsed = parseTime(value);
      if (parsed !== null) start = parsed;
    }

    let duration = 0;
    const durationSlider = this.page.locator('.ytgif-slider-input');
    if (await durationSlider.isVisible()) {
      const value = await durationSlider.inputValue();
      const parsed = parseFloat(value);
      if (!Number.isNaN(parsed)) duration = parsed;
    }

    // Fallback to the duration display if needed
    if (!duration) {
      const timeText = await this.timeDisplay.textContent();
      const match = timeText?.match(/(\d+\.?\d*)s/);
      if (match) duration = parseFloat(match[1]);
    }

    const end = start + duration;
    return { start, end };
  }
}
