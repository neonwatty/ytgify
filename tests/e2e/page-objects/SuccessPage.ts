import { Page, Locator } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Page Object Model for Success screen
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
    this.container = page.locator('.ytgif-success, .success-screen');
    this.gifPreview = page.locator('.ytgif-gif-preview img, .gif-preview img');
    this.downloadButton = page.locator('button:has-text("Download")');
    this.createAnotherButton = page.locator('button:has-text("Create Another"), button:has-text("New GIF")');
    this.feedbackButton = page.locator('button:has-text("Feedback"), button:has-text("Rate")');
    this.closeButton = page.locator('button:has-text("Close"), button:has-text("Done")');
    this.sizeDisplay = page.locator('.ytgif-size, .file-size');
    this.dimensionsDisplay = page.locator('.ytgif-dimensions, .gif-dimensions');
  }

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 15000 });
    await this.gifPreview.waitFor({ state: 'visible', timeout: 10000 });
  }

  async downloadGif(): Promise<string> {
    // Set up download promise before clicking
    const downloadPromise = this.page.waitForEvent('download');

    await this.downloadButton.click();

    const download = await downloadPromise;

    // Save to test outputs directory
    const fileName = `test-gif-${Date.now()}.gif`;
    const filePath = path.join(__dirname, '..', '..', 'downloads', fileName);

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Save the file
    await download.saveAs(filePath);

    return filePath;
  }

  async createAnother() {
    await this.createAnotherButton.click();
  }

  async openFeedback() {
    await this.feedbackButton.click();
  }

  async close() {
    await this.closeButton.click();
  }

  async getFileSize(): Promise<string> {
    const text = await this.sizeDisplay.textContent();
    return text || '';
  }

  async getDimensions(): Promise<string> {
    const text = await this.dimensionsDisplay.textContent();
    return text || '';
  }

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

  async isGifDisplayed(): Promise<boolean> {
    return await this.gifPreview.isVisible();
  }

  async getGifSrc(): Promise<string | null> {
    return await this.gifPreview.getAttribute('src');
  }

  async validateGifCreated(): Promise<boolean> {
    // Check if GIF is displayed
    if (!await this.isGifDisplayed()) return false;

    // Check if src is a data URL or blob URL
    const src = await this.getGifSrc();
    if (!src) return false;

    return src.startsWith('data:image/gif') || src.startsWith('blob:');
  }

  async getGifMetadata(): Promise<{
    size: string;
    dimensions: string;
    isValid: boolean;
  }> {
    return {
      size: await this.getFileSize(),
      dimensions: await this.getDimensions(),
      isValid: await this.validateGifCreated()
    };
  }
}