/**
 * UserProfile Page Object
 *
 * Represents the user profile view after login
 * Provides methods for accessing profile data and logout
 */

import { Page, Locator } from '@playwright/test';

export class UserProfilePage {
  readonly page: Page;
  readonly profileContainer: Locator;
  readonly usernameDisplay: Locator;
  readonly emailDisplay: Locator;
  readonly gifsCountDisplay: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.profileContainer = page.locator('[data-testid="user-profile"]');
    this.usernameDisplay = page.locator('[data-testid="username"]');
    this.emailDisplay = page.locator('[data-testid="email"]');
    this.gifsCountDisplay = page.locator('[data-testid="gifs-count"]');
    this.logoutButton = page.locator('[data-testid="logout-btn"]');
  }

  /**
   * Wait for profile to be visible
   */
  async waitForProfile(timeout: number = 10000) {
    await this.profileContainer.waitFor({ state: 'visible', timeout });
    console.log('[UserProfilePage] ✓ Profile visible');
  }

  /**
   * Check if profile is visible
   */
  async isProfileVisible(): Promise<boolean> {
    return await this.profileContainer.isVisible();
  }

  /**
   * Get username
   */
  async getUsername(): Promise<string> {
    const username = (await this.usernameDisplay.textContent()) || '';
    console.log(`[UserProfilePage] ✓ Username: ${username}`);
    return username;
  }

  /**
   * Get email
   */
  async getEmail(): Promise<string> {
    const email = (await this.emailDisplay.textContent()) || '';
    console.log(`[UserProfilePage] ✓ Email: ${email}`);
    return email;
  }

  /**
   * Get GIFs count
   */
  async getGifsCount(): Promise<number> {
    const text = (await this.gifsCountDisplay.textContent()) || '0';
    const count = parseInt(text, 10);
    console.log(`[UserProfilePage] ✓ GIFs count: ${count}`);
    return count;
  }

  /**
   * Click logout button
   */
  async clickLogout() {
    // Handle confirmation dialog
    this.page.on('dialog', async (dialog) => {
      console.log(`[UserProfilePage] Dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    await this.logoutButton.click();
    console.log('[UserProfilePage] ✓ Logout button clicked');

    // Wait for logout to process
    await this.page.waitForTimeout(1500);
  }

  /**
   * Get all profile data at once
   */
  async getUserProfile(): Promise<{
    username: string;
    email: string;
    gifsCount: number;
  }> {
    return {
      username: await this.getUsername(),
      email: await this.getEmail(),
      gifsCount: await this.getGifsCount(),
    };
  }

  /**
   * Check if logout button is visible
   */
  async hasLogoutButton(): Promise<boolean> {
    return await this.logoutButton.isVisible();
  }

  /**
   * Get logout button text (useful for checking loading state)
   */
  async getLogoutButtonText(): Promise<string> {
    return (await this.logoutButton.textContent()) || '';
  }
}
