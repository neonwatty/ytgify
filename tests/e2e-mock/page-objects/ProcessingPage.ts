import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Processing screen (Mock E2E)
 */
export class ProcessingPage {
  readonly page: Page;
  readonly container: Locator;
  readonly progressBar: Locator;
  readonly progressText: Locator;
  readonly stageIndicator: Locator;
  readonly statusMessage: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.ytgif-processing-screen, .ytgif-processing, .processing-screen');
    this.progressBar = page.locator('.ytgif-progress-bar, .progress-bar');
    this.progressText = page.locator('.ytgif-progress-text, .progress-percentage');
    this.stageIndicator = page.locator('.ytgif-stage, .stage-indicator');
    this.statusMessage = page.locator('.ytgif-status-message, .processing-message');
    this.cancelButton = page.locator('button:has-text("Cancel")');
  }

  async waitForScreen(timeout: number = 10000) {
    await this.container.waitFor({ state: 'visible', timeout });
  }

  async waitForCompletion(timeout: number = 60000) {
    // Wait for processing to complete by checking for either:
    // 1. Processing screen disappears
    // 2. Success screen appears
    // 3. Error screen appears
    await this.page.waitForFunction(
      () => {
        const processing = document.querySelector('.ytgif-processing-screen, .ytgif-processing, .processing-screen');
        const success = document.querySelector('.ytgif-success-screen, .ytgif-success, .success-screen');
        const error = document.querySelector('.ytgif-error-screen, .ytgif-error, .error-screen');

        // Processing complete if success/error appears OR processing disappears
        return success || error || (processing && !(processing as HTMLElement).offsetParent);
      },
      { timeout, polling: 500 }
    );

    // Small delay to let UI settle
    await this.page.waitForTimeout(500);
  }

  async getProgress(): Promise<number> {
    try {
      const text = await this.progressText.textContent();
      if (!text) return 0;

      const match = text.match(/(\d+)%/);
      return match ? parseInt(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  async getCurrentStage(): Promise<string> {
    try {
      const text = await this.stageIndicator.textContent();
      return text || '';
    } catch {
      return '';
    }
  }

  async getStatusMessage(): Promise<string> {
    try {
      const text = await this.statusMessage.textContent();
      return text || '';
    } catch {
      return '';
    }
  }

  async isProcessing(): Promise<boolean> {
    try {
      return await this.container.isVisible();
    } catch {
      return false;
    }
  }

  async cancel() {
    try {
      if (await this.cancelButton.isVisible()) {
        await this.cancelButton.click();
        await this.page.waitForTimeout(500);
      }
    } catch (e) {
      console.warn('[Mock Test] Cancel button not available');
    }
  }

  async waitForStage(stageName: string, timeout: number = 30000) {
    await this.page.waitForFunction(
      (stage) => {
        const stageElement = document.querySelector('.ytgif-stage, .stage-indicator');
        return stageElement?.textContent?.includes(stage);
      },
      stageName,
      { timeout }
    );
  }

  async monitorProgress(callback: (progress: number, stage: string) => void) {
    let lastProgress = -1;
    let lastStage = '';

    while (await this.isProcessing()) {
      const progress = await this.getProgress();
      const stage = await this.getCurrentStage();

      if (progress !== lastProgress || stage !== lastStage) {
        callback(progress, stage);
        lastProgress = progress;
        lastStage = stage;
      }

      await this.page.waitForTimeout(500);
    }
  }
}
