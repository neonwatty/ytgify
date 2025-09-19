import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Text Overlay screen
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
    this.nextButton = page.locator('button:has-text("Create GIF"), button:has-text("Generate")');
    this.backButton = page.locator('button:has-text("Back")');
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

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
    await this.textInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  async addTextOverlay(text: string, position?: 'top' | 'middle' | 'bottom', style?: 'meme' | 'subtitle' | 'minimal') {
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
  }

  async selectPosition(position: 'top' | 'middle' | 'bottom') {
    await this.positionButtons[position].click();
    await this.page.waitForTimeout(200);
  }

  async selectStyle(style: 'meme' | 'subtitle' | 'minimal') {
    await this.styleButtons[style].click();
    await this.page.waitForTimeout(200);
  }

  async getOverlayCount(): Promise<number> {
    return await this.overlayItems.count();
  }

  async removeOverlay(index: number) {
    const items = await this.overlayItems.all();
    if (items[index]) {
      const deleteButton = items[index].locator('button[aria-label*="Delete"], button[aria-label*="Remove"], .delete-button');
      await deleteButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async editOverlay(index: number, newText: string) {
    const items = await this.overlayItems.all();
    if (items[index]) {
      const editButton = items[index].locator('button[aria-label*="Edit"], .edit-button');
      await editButton.click();
      await this.textInput.fill(newText);
      await this.addButton.click(); // Usually same button for add/update
      await this.page.waitForTimeout(300);
    }
  }

  async clickSkip() {
    await this.skipButton.click();
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  async isNextButtonEnabled(): Promise<boolean> {
    // Create GIF button is usually always enabled (can create without text)
    return await this.nextButton.isEnabled();
  }

  async getOverlayTexts(): Promise<string[]> {
    const items = await this.overlayItems.all();
    const texts: string[] = [];
    for (const item of items) {
      const text = await item.locator('.overlay-text, .text-content').textContent();
      if (text) texts.push(text.trim());
    }
    return texts;
  }

  async isPreviewVisible(): Promise<boolean> {
    return await this.preview.isVisible();
  }

  async dragOverlayInPreview(index: number, deltaX: number, deltaY: number) {
    const previewOverlays = this.preview.locator('.ytgif-preview-overlay, .preview-text');
    const overlay = previewOverlays.nth(index);

    const box = await overlay.boundingBox();
    if (!box) return;

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + box.width / 2 + deltaX, box.y + box.height / 2 + deltaY);
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }
}