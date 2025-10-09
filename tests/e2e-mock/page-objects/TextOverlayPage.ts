import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Text Overlay screen (Mock E2E)
 */
export class TextOverlayPage {
  readonly page: Page;
  readonly container: Locator;
  readonly textInput: Locator;
  readonly addButton: Locator;
  readonly skipButton: Locator;
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly preview: Locator;
  readonly overlayItems: Locator;
  readonly positionButtons: {
    top: Locator;
    middle: Locator;
    bottom: Locator;
  };
  readonly styleButtons: {
    meme: Locator;
    subtitle: Locator;
    minimal: Locator;
  };

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.ytgif-text-overlay-screen');
    this.textInput = page.locator('input[placeholder*="text"], textarea[placeholder*="text"]');
    this.addButton = page.locator('button:has-text("Add"), button:has-text("Add Text")');
    this.skipButton = page.locator('button:has-text("Skip")');
    this.nextButton = page.locator('.ytgif-button-primary, button:has-text("Create GIF"), button:has-text("Generate")');
    this.backButton = page.locator('.ytgif-back-button, button:has-text("Back")');
    this.preview = page.locator('.ytgif-text-preview, .preview-container');
    this.overlayItems = page.locator('.ytgif-overlay-item, .text-overlay-item');
    this.positionButtons = {
      top: page.locator('button[data-position="top"], button:has-text("Top")'),
      middle: page.locator('button[data-position="middle"], button:has-text("Middle")'),
      bottom: page.locator('button[data-position="bottom"], button:has-text("Bottom")'),
    };
    this.styleButtons = {
      meme: page.locator('button[data-style="meme"], button:has-text("Meme")'),
      subtitle: page.locator('button[data-style="subtitle"], button:has-text("Subtitle")'),
      minimal: page.locator('button[data-style="minimal"], button:has-text("Minimal")'),
    };
  }

  async waitForScreen(timeout: number = 10000) {
    await this.container.waitFor({ state: 'visible', timeout });
  }

  async addTextOverlay(text: string, position?: 'top' | 'middle' | 'bottom', style?: 'meme' | 'subtitle' | 'minimal') {
    try {
      // Enter text
      await this.textInput.fill(text);

      // Select position if specified
      if (position) {
        await this.selectPosition(position);
      }

      // Select style if specified
      if (style) {
        await this.selectStyle(style);
      }

      // Click add button
      await this.addButton.click();
      await this.page.waitForTimeout(300);
    } catch (e) {
      console.warn('[Mock Test] Failed to add text overlay:', e);
    }
  }

  async selectPosition(position: 'top' | 'middle' | 'bottom') {
    try {
      await this.positionButtons[position].click();
      await this.page.waitForTimeout(200);
    } catch (e) {
      console.warn(`[Mock Test] Failed to select position ${position}`);
    }
  }

  async selectStyle(style: 'meme' | 'subtitle' | 'minimal') {
    try {
      await this.styleButtons[style].click();
      await this.page.waitForTimeout(200);
    } catch (e) {
      console.warn(`[Mock Test] Failed to select style ${style}`);
    }
  }

  async getOverlayCount(): Promise<number> {
    try {
      return await this.overlayItems.count();
    } catch {
      return 0;
    }
  }

  async removeOverlay(index: number) {
    try {
      const items = await this.overlayItems.all();
      if (items[index]) {
        const deleteButton = items[index].locator('button[aria-label*="Delete"], button[aria-label*="Remove"], .delete-button');
        await deleteButton.click();
        await this.page.waitForTimeout(300);
      }
    } catch (e) {
      console.warn(`[Mock Test] Failed to remove overlay at index ${index}`);
    }
  }

  async editOverlay(index: number, newText: string) {
    try {
      const items = await this.overlayItems.all();
      if (items[index]) {
        const editButton = items[index].locator('button[aria-label*="Edit"], .edit-button');
        await editButton.click();
        await this.textInput.fill(newText);
        await this.addButton.click();
        await this.page.waitForTimeout(300);
      }
    } catch (e) {
      console.warn(`[Mock Test] Failed to edit overlay at index ${index}`);
    }
  }

  async clickSkip() {
    await this.skipButton.click();
    await this.page.waitForTimeout(500);
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
    try {
      return await this.nextButton.isEnabled();
    } catch {
      return false;
    }
  }

  async getOverlayTexts(): Promise<string[]> {
    try {
      const items = await this.overlayItems.all();
      const texts: string[] = [];
      for (const item of items) {
        const text = await item.locator('.overlay-text, .text-content').textContent();
        if (text) texts.push(text.trim());
      }
      return texts;
    } catch {
      return [];
    }
  }

  async isPreviewVisible(): Promise<boolean> {
    try {
      return await this.preview.isVisible();
    } catch {
      return false;
    }
  }
}
