import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the GIF creation wizard overlay
 */
export class GifWizard {
  readonly page: Page;
  readonly overlay: Locator;
  readonly closeButton: Locator;
  readonly progressDots: Locator;
  readonly wizardContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.overlay = page.locator('.ytgif-overlay-wizard');
    this.closeButton = page.locator('.ytgif-wizard-close');
    this.progressDots = page.locator('.ytgif-progress-dot');
    this.wizardContainer = page.locator('.ytgif-wizard-container');
  }

  async isVisible(): Promise<boolean> {
    return await this.overlay.isVisible();
  }

  async close() {
    await this.closeButton.click();
    await this.overlay.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async getCurrentStepIndex(): Promise<number> {
    const dots = await this.progressDots.all();
    for (let i = 0; i < dots.length; i++) {
      const isActive = await dots[i].evaluate((el) => el.classList.contains('active'));
      if (!isActive && i > 0) {
        return i - 1;
      }
    }
    return dots.length - 1;
  }

  async getProgressStepCount(): Promise<number> {
    return await this.progressDots.count();
  }

  async waitForWizardReady() {
    await this.overlay.waitFor({ state: 'visible', timeout: 10000 });
    await this.wizardContainer.waitFor({ state: 'visible', timeout: 5000 });
  }
}