import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Feedback screen
 */
export class FeedbackPage {
  readonly page: Page;
  readonly container: Locator;
  readonly ratingStars: Locator;
  readonly commentTextarea: Locator;
  readonly submitButton: Locator;
  readonly skipButton: Locator;
  readonly backButton: Locator;
  readonly thankYouMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('.ytgif-feedback, .feedback-screen');
    this.ratingStars = page.locator('.ytgif-rating-star, .rating-star');
    this.commentTextarea = page.locator('textarea[placeholder*="feedback"], textarea[placeholder*="comment"]');
    this.submitButton = page.locator('button:has-text("Submit")');
    this.skipButton = page.locator('button:has-text("Skip")');
    this.backButton = page.locator('button:has-text("Back")');
    this.thankYouMessage = page.locator('.ytgif-thank-you, .thank-you-message');
  }

  async waitForScreen() {
    await this.container.waitFor({ state: 'visible', timeout: 10000 });
  }

  async setRating(stars: number) {
    if (stars < 1 || stars > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const star = this.ratingStars.nth(stars - 1);
    await star.click();
    await this.page.waitForTimeout(300);
  }

  async enterComment(text: string) {
    await this.commentTextarea.fill(text);
  }

  async submitFeedback() {
    await this.submitButton.click();
    await this.page.waitForTimeout(500);
  }

  async skip() {
    await this.skipButton.click();
  }

  async goBack() {
    await this.backButton.click();
  }

  async isThankYouVisible(): Promise<boolean> {
    return await this.thankYouMessage.isVisible();
  }

  async getSelectedRating(): Promise<number> {
    const stars = await this.ratingStars.all();
    let rating = 0;

    for (let i = 0; i < stars.length; i++) {
      const isActive = await stars[i].evaluate((el) =>
        el.classList.contains('active') || el.classList.contains('selected')
      );
      if (isActive) {
        rating = i + 1;
      } else {
        break;
      }
    }

    return rating;
  }

  async submitFullFeedback(rating: number, comment: string) {
    await this.setRating(rating);
    await this.enterComment(comment);
    await this.submitFeedback();
  }
}