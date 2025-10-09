import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Success screen (Mock E2E)
 * Adapted for mock tests - uses data URLs/blob URLs instead of file downloads
 */
export class SuccessPage {
  readonly page: Page;
  readonly container: Locator;
  readonly gifPreview: Locator;
  readonly downloadButton: Locator;
  readonly createAnotherButton: Locator;
  readonly feedbackButton: Locator;
  readonly closeButton: Locator;
  readonly sizeDisplay: Locator;
  readonly dimensionsDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.ytgif-success-screen, .ytgif-success, .success-screen');
    this.gifPreview = page.locator('.ytgif-gif-preview img, .ytgif-success-preview-image, .gif-preview img');
    this.downloadButton = page.locator('button:has-text("Download")');
    this.createAnotherButton = page.locator('button:has-text("Create Another"), button:has-text("New GIF")');
    this.feedbackButton = page.locator('button:has-text("Feedback"), button:has-text("Rate")');
    this.closeButton = page.locator('button:has-text("Close"), button:has-text("Done")');
    this.sizeDisplay = page.locator('.ytgif-size, .file-size');
    this.dimensionsDisplay = page.locator('.ytgif-dimensions, .gif-dimensions');
  }

  async waitForScreen(timeout: number = 15000) {
    await this.container.waitFor({ state: 'visible', timeout });
    await this.gifPreview.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get the GIF URL (data URL or blob URL)
   * For mock tests, we work with URLs instead of file downloads
   */
  async getGifUrl(): Promise<string | null> {
    try {
      const src = await this.gifPreview.getAttribute('src');
      return src;
    } catch {
      return null;
    }
  }

  /**
   * Create another GIF
   */
  async createAnother() {
    await this.createAnotherButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Open feedback dialog
   */
  async openFeedback() {
    try {
      await this.feedbackButton.click();
      await this.page.waitForTimeout(500);
    } catch {
      console.warn('[Mock Test] Feedback button not available');
    }
  }

  /**
   * Close success screen
   */
  async close() {
    try {
      await this.closeButton.click();
      await this.page.waitForTimeout(500);
    } catch {
      console.warn('[Mock Test] Close button not available');
    }
  }

  /**
   * Get file size display text
   */
  async getFileSize(): Promise<string> {
    try {
      const text = await this.sizeDisplay.textContent();
      return text || '';
    } catch {
      return '';
    }
  }

  /**
   * Get dimensions display text
   */
  async getDimensions(): Promise<string> {
    try {
      const text = await this.dimensionsDisplay.textContent();
      return text || '';
    } catch {
      return '';
    }
  }

  /**
   * Parse dimensions from display text
   */
  async getParsedDimensions(): Promise<{ width: number; height: number } | null> {
    const text = await this.getDimensions();
    // Parse text like "640x360" or "640 x 360"
    const match = text.match(/(\d+)\s*[xX×]\s*(\d+)/);
    if (match) {
      return {
        width: parseInt(match[1]),
        height: parseInt(match[2]),
      };
    }
    return null;
  }

  /**
   * Check if GIF preview is displayed
   */
  async isGifDisplayed(): Promise<boolean> {
    try {
      return await this.gifPreview.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Get GIF source attribute
   */
  async getGifSrc(): Promise<string | null> {
    try {
      return await this.gifPreview.getAttribute('src');
    } catch {
      return null;
    }
  }

  /**
   * Validate that a GIF was created successfully
   * Returns true if GIF is displayed and has a valid data URL or blob URL
   */
  async validateGifCreated(): Promise<boolean> {
    // Check if GIF is displayed
    if (!await this.isGifDisplayed()) {
      console.warn('[Mock Test] GIF preview not displayed');
      return false;
    }

    // Check if src is a data URL or blob URL
    const src = await this.getGifSrc();
    if (!src) {
      console.warn('[Mock Test] GIF src is null');
      return false;
    }

    const isValid = src.startsWith('data:image/gif') || src.startsWith('blob:');
    if (!isValid) {
      console.warn(`[Mock Test] GIF src has invalid format: ${src.substring(0, 50)}...`);
    }

    return isValid;
  }

  /**
   * Get comprehensive GIF metadata
   */
  async getGifMetadata(): Promise<{
    size: string;
    dimensions: string;
    isValid: boolean;
    url: string | null;
  }> {
    return {
      size: await this.getFileSize(),
      dimensions: await this.getDimensions(),
      isValid: await this.validateGifCreated(),
      url: await this.getGifUrl()
    };
  }

  /**
   * Wait for GIF to be fully loaded and displayed
   */
  async waitForGifReady(timeout: number = 10000) {
    await this.waitForScreen();
    await this.page.waitForFunction(
      () => {
        const img = document.querySelector('.ytgif-gif-preview img, .ytgif-success-preview-image') as HTMLImageElement;
        return img && img.complete && img.naturalWidth > 0;
      },
      { timeout }
    );
  }
}
