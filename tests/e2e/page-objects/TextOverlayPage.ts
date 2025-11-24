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
    // TextOverlayScreenV2 has separate top and bottom text inputs
    this.textInput = page.locator('input.ytgif-text-input').first();
    // Primary button is "Apply Text & Continue" or "Create GIF Without Text"
    // Scope to container to avoid clicking buttons from other screens
    this.addButton = this.container.locator('button.ytgif-button-primary');
    this.skipButton = this.container.locator('button.ytgif-button-secondary');
    this.nextButton = this.container.locator('button.ytgif-button-primary');
    this.backButton = page.locator('button.ytgif-back-button');
    this.preview = page.locator('.ytgif-frame-preview, .ytgif-preview-placeholder');
    this.overlayItems = page.locator('.ytgif-text-preview-overlay');
    // TextOverlayScreenV2 doesn't have position buttons - it has fixed top/bottom inputs
    this.positionButtons = {
      top: page.locator('input.ytgif-text-input').first(),
      middle: page.locator('input.ytgif-text-input').first(), // Map to top for compatibility
      bottom: page.locator('input.ytgif-text-input').last(),
    };
    // TextOverlayScreenV2 doesn't have style buttons - it has advanced toggles
    this.styleButtons = {
      meme: page.locator('button.ytgif-advanced-toggle').first(),
      subtitle: page.locator('button.ytgif-advanced-toggle').last(),
      minimal: page.locator('button.ytgif-advanced-toggle').first(),
    };
  }

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
    await this.textInput.waitFor({ state: 'visible', timeout: 5000 });
  }

  async addTextOverlay(text: string, position?: 'top' | 'middle' | 'bottom', style?: 'meme' | 'subtitle' | 'minimal') {
    // TextOverlayScreenV2 has separate top/bottom inputs, not position buttons
    // Map position to appropriate input field
    const inputLocator = position === 'bottom'
      ? this.page.locator('input.ytgif-text-input').last()
      : this.page.locator('input.ytgif-text-input').first();

    // Enter text in appropriate field
    await inputLocator.fill(text);

    // Style is ignored in V2 (no style buttons, just advanced options)
    // Clicking style just opens/closes advanced section, doesn't change behavior
    if (style) {
      // No-op for compatibility
    }

    // DO NOT click primary button here - tests will call clickNext() when ready to proceed
    // This allows tests to add multiple text overlays without navigating away
    await this.page.waitForTimeout(300);
  }

  async selectPosition(position: 'top' | 'middle' | 'bottom') {
    // TextOverlayScreenV2 doesn't have position buttons
    // Position is determined by which input field you use
    // This is a no-op for compatibility
    await this.page.waitForTimeout(50);
  }

  async selectStyle(style: 'meme' | 'subtitle' | 'minimal') {
    // TextOverlayScreenV2 doesn't have style buttons
    // This is a no-op for compatibility
    await this.page.waitForTimeout(50);
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
    await this.nextButton.click({ clickCount: 1, delay: 100 });
  }

  async clickBack() {
    await this.backButton.click();
  }

  async isNextButtonEnabled(): Promise<boolean> {
    // Create GIF button is usually always enabled (can create without text)
    return await this.nextButton.isEnabled();
  }

  async getOverlayTexts(): Promise<string[]> {
    // TextOverlayScreenV2 shows text previews when text is entered
    const texts: string[] = [];

    // Check top text input
    const topInput = this.page.locator('input.ytgif-text-input').first();
    const topValue = await topInput.inputValue();
    if (topValue.trim()) texts.push(topValue.trim());

    // Check bottom text input
    const bottomInput = this.page.locator('input.ytgif-text-input').last();
    const bottomValue = await bottomInput.inputValue();
    if (bottomValue.trim() && bottomValue !== topValue) texts.push(bottomValue.trim());

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