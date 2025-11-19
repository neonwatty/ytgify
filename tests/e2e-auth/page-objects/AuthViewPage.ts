/**
 * AuthView Page Object
 *
 * Represents the login form UI
 * Provides methods for filling in credentials and submitting login
 */

import { Page, Locator } from '@playwright/test';

export class AuthViewPage {
  readonly page: Page;
  readonly authView: Locator;
  readonly loginForm: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly createAccountButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.authView = page.locator('[data-testid="auth-view"]');
    this.loginForm = page.locator('[data-testid="login-form"]');
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-submit-btn"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
    this.createAccountButton = page.locator('[data-testid="create-account-btn"]');
  }

  /**
   * Wait for login form to be visible
   */
  async waitForLoginForm(timeout: number = 10000) {
    await this.loginForm.waitFor({ state: 'visible', timeout });
    console.log('[AuthViewPage] ✓ Login form visible');
  }

  /**
   * Check if login form is visible
   */
  async isLoginFormVisible(): Promise<boolean> {
    return await this.loginForm.isVisible();
  }

  /**
   * Fill email input
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
    console.log(`[AuthViewPage] ✓ Email filled: ${email}`);
  }

  /**
   * Fill password input
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
    console.log('[AuthViewPage] ✓ Password filled');
  }

  /**
   * Click login button
   */
  async clickLogin() {
    await this.loginButton.click();
    console.log('[AuthViewPage] ✓ Login button clicked');

    // Wait a moment for form submission
    await this.page.waitForTimeout(1000);
  }

  /**
   * Convenience method: Login with credentials
   */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
    console.log(`[AuthViewPage] ✓ Login submitted for: ${email}`);
  }

  /**
   * Wait for error message to appear
   */
  async waitForErrorMessage(timeout: number = 5000) {
    await this.errorMessage.waitFor({ state: 'visible', timeout });
    console.log('[AuthViewPage] ✓ Error message appeared');
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    const text = (await this.errorMessage.textContent()) || '';
    console.log(`[AuthViewPage] ✓ Error message: ${text}`);
    return text;
  }

  /**
   * Check if error message is visible
   */
  async hasErrorMessage(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Click forgot password link
   * Returns the new page that opens
   */
  async clickForgotPassword() {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.forgotPasswordLink.click(),
    ]);
    console.log('[AuthViewPage] ✓ Forgot password clicked, new page opened');
    return newPage;
  }

  /**
   * Click create account button
   * Returns the new page that opens
   */
  async clickCreateAccount() {
    const [newPage] = await Promise.all([
      this.page.context().waitForEvent('page'),
      this.createAccountButton.click(),
    ]);
    console.log('[AuthViewPage] ✓ Create account clicked, new page opened');
    return newPage;
  }

  /**
   * Get the button text (useful for checking loading state)
   */
  async getLoginButtonText(): Promise<string> {
    return (await this.loginButton.textContent()) || '';
  }

  /**
   * Check if login button is disabled
   */
  async isLoginButtonDisabled(): Promise<boolean> {
    return await this.loginButton.isDisabled();
  }
}
