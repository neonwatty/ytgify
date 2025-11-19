import { Page, Locator } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Page Object Model for Success screen with Phase 2 upload status
 */
export class SuccessPage {
  readonly page: Page;
  readonly container: Locator;
  readonly gifPreview: Locator;
  readonly downloadButton: Locator;
  readonly uploadToCloudButton: Locator;
  readonly createAnotherButton: Locator;
  readonly feedbackButton: Locator;
  readonly closeButton: Locator;
  readonly sizeDisplay: Locator;
  readonly dimensionsDisplay: Locator;
  // Phase 2: Upload status elements
  readonly uploadStatusBadge: Locator;
  readonly uploadErrorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.ytgif-success-screen, .ytgif-success, .success-screen');
    this.gifPreview = page.locator('.ytgif-gif-preview img, .gif-preview img, .ytgif-success-screen img');
    this.downloadButton = page.locator('button:has-text("Download")');
    this.uploadToCloudButton = page.locator('button:has-text("Upload to Cloud")');
    this.createAnotherButton = page.locator(
      'button:has-text("Create Another"), button:has-text("New GIF")'
    );
    this.feedbackButton = page.locator('button:has-text("Feedback"), button:has-text("Rate")');
    this.closeButton = page.locator('button:has-text("Close"), button:has-text("Done")');
    this.sizeDisplay = page.locator('.ytgif-size, .file-size');
    this.dimensionsDisplay = page.locator('.ytgif-dimensions, .gif-dimensions');
    // Phase 2: Upload status
    this.uploadStatusBadge = page.locator('.ytgif-upload-status, .upload-status-badge, .status-badge, [data-testid="upload-status"]');
    this.uploadErrorMessage = page.locator('.upload-error, .error-message, [data-testid="upload-error"]');
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

  /**
   * Check if Upload to Cloud button is visible
   */
  async isUploadToCloudButtonVisible(): Promise<boolean> {
    try {
      return await this.uploadToCloudButton.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Click Upload to Cloud button to trigger manual upload
   */
  async clickUploadToCloud(): Promise<void> {
    await this.uploadToCloudButton.click();
    console.log('[SuccessPage] Clicked Upload to Cloud button');
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
    if (!(await this.isGifDisplayed())) return false;

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
      isValid: await this.validateGifCreated(),
    };
  }

  // ========================================
  // Phase 2: Upload Status Methods
  // ========================================

  /**
   * Get current upload status from UI
   * Returns one of: 'uploading' | 'success' | 'failed' | 'disabled' | null
   */
  async getUploadStatus(): Promise<'uploading' | 'success' | 'failed' | 'disabled' | null> {
    try {
      // Wait a bit for upload to start (async operation)
      await this.page.waitForTimeout(500);

      // Check if status badge exists
      const badgeCount = await this.uploadStatusBadge.count();
      if (badgeCount === 0) {
        return 'disabled'; // No badge means upload is disabled
      }

      const badgeText = await this.uploadStatusBadge.textContent();
      if (!badgeText) return null;

      const lowerText = badgeText.toLowerCase();

      // Match common status text patterns
      if (lowerText.includes('uploading') || lowerText.includes('upload in progress')) {
        return 'uploading';
      }
      if (lowerText.includes('uploaded') || lowerText.includes('upload success')) {
        return 'success';
      }
      if (lowerText.includes('failed') || lowerText.includes('error')) {
        return 'failed';
      }
      if (lowerText.includes('disabled') || lowerText.includes('not uploaded')) {
        return 'disabled';
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Wait for upload to complete (success or failure)
   * @param timeout Maximum time to wait in ms
   */
  async waitForUploadComplete(timeout: number = 10000): Promise<'success' | 'failed'> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const status = await this.getUploadStatus();

      if (status === 'success') {
        return 'success';
      }
      if (status === 'failed') {
        return 'failed';
      }

      // Wait before checking again
      await this.page.waitForTimeout(500);
    }

    throw new Error(`Upload did not complete within ${timeout}ms`);
  }

  /**
   * Check if upload status badge is visible
   */
  async isUploadStatusVisible(): Promise<boolean> {
    try {
      const count = await this.uploadStatusBadge.count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get upload error message if present
   * Error messages are shown in the upload status badge when status is 'failed'
   */
  async getUploadErrorMessage(): Promise<string | null> {
    try {
      const status = await this.getUploadStatus();
      if (status !== 'failed') return null;

      // Error message is shown in the status badge text
      const text = await this.uploadStatusBadge.textContent();
      return text;
    } catch {
      return null;
    }
  }

  /**
   * Verify upload status matches expected state
   */
  async verifyUploadStatus(
    expectedStatus: 'uploading' | 'success' | 'failed' | 'disabled'
  ): Promise<boolean> {
    const actualStatus = await this.getUploadStatus();
    return actualStatus === expectedStatus;
  }

  /**
   * Wait for specific upload status
   */
  async waitForUploadStatus(
    status: 'uploading' | 'success' | 'failed' | 'disabled',
    timeout: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const currentStatus = await this.getUploadStatus();

      if (currentStatus === status) {
        return true;
      }

      await this.page.waitForTimeout(500);
    }

    return false;
  }
}
