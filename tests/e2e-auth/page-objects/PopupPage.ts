/**
 * Popup Page Object
 *
 * Represents the extension popup window
 * Provides methods for opening, closing, and navigating the popup
 */

import { Page } from '@playwright/test';

export class PopupPage {
  readonly page: Page;
  readonly extensionId: string;

  constructor(page: Page, extensionId: string) {
    this.page = page;
    this.extensionId = extensionId;
  }

  /**
   * Open the extension popup
   */
  async open() {
    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    await this.page.goto(popupUrl);
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for React to render
    await this.page.waitForTimeout(500);

    console.log('[PopupPage] ✓ Popup opened');
  }

  /**
   * Close the popup
   */
  async close() {
    await this.page.close();
    console.log('[PopupPage] ✓ Popup closed');
  }

  /**
   * Reload the popup
   */
  async reload() {
    await this.page.reload();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(500);
    console.log('[PopupPage] ✓ Popup reloaded');
  }

  /**
   * Take a screenshot
   */
  async screenshot(path?: string) {
    if (path) {
      await this.page.screenshot({ path });
    } else {
      return await this.page.screenshot();
    }
  }

  /**
   * Wait for specific element to be visible
   */
  async waitForElement(selector: string, timeoutMs: number = 10000) {
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout: timeoutMs,
    });
  }

  /**
   * Check if element exists
   */
  async hasElement(selector: string): Promise<boolean> {
    return (await this.page.$(selector)) !== null;
  }

  /**
   * Get popup URL
   */
  getUrl(): string {
    return this.page.url();
  }
}
