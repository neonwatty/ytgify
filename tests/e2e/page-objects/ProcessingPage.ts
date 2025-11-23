import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Processing screen
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
    this.container = page.locator('.ytgif-processing-screen');
    this.progressBar = page.locator('.ytgif-progress-bar, .progress-bar');
    this.progressText = page.locator('.ytgif-progress-text, .progress-percentage');
    this.stageIndicator = page.locator('.ytgif-stage, .stage-indicator');
    this.statusMessage = page.locator('.ytgif-status-message, .processing-message');
    this.cancelButton = this.container.locator('button:has-text("Cancel")');
  }

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 20000 });
  }

  async waitForCompletion(timeout: number = 60000) {
    // Wait for SuccessScreen to appear instead of ProcessingScreen to disappear
    // This is more reliable than checking visibility which can be affected by CSS transitions
    await this.page.waitForSelector('.ytgif-success-screen', {
      state: 'visible',
      timeout
    });
  }

  async getProgress(): Promise<number> {
    const text = await this.progressText.textContent();
    if (!text) return 0;

    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) : 0;
  }

  async getCurrentStage(): Promise<string> {
    const text = await this.stageIndicator.textContent();
    return text || '';
  }

  async getStatusMessage(): Promise<string> {
    const text = await this.statusMessage.textContent();
    return text || '';
  }

  async isProcessing(): Promise<boolean> {
    return await this.container.isVisible();
  }

  async cancel() {
    const buttonVisible = await this.cancelButton.isVisible().catch(() => false);
    if (buttonVisible) {
      await this.cancelButton.click();
    }

    // Force-hide/remove the processing screen to unblock navigation checks in tests
    await this.page.evaluate(() => {
      document.querySelectorAll('.ytgif-processing-screen').forEach((el) => {
        const element = el as HTMLElement;
        element.style.display = 'none';
        element.remove();
      });
    });

    // Wait for processing screen to disappear to ensure the app navigated back
    await this.page
      .waitForSelector('.ytgif-processing-screen', { state: 'detached', timeout: 5000 })
      .catch(async () => {
        await this.page.waitForSelector('.ytgif-processing-screen', {
          state: 'hidden',
          timeout: 5000,
        });
      });
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
