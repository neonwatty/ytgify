import { test, expect } from '@playwright/test';
import { CHROME_EXTENSION_URL, DEMO_VIDEO_EMBED_URL } from '../lib/constants';

test.describe('Landing Page Smoke Tests', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/YTgify/);
  });

  test('headline is visible', async ({ page }) => {
    await page.goto('/');
    const headline = page.getByRole('heading', { name: /Turn your favorite YouTube moments into GIFs/i });
    await expect(headline).toBeVisible();
  });

  test('Chrome Store badge links correctly', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('a[href*="chromewebstore.google.com"]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('href', CHROME_EXTENSION_URL);
  });

  test('demo video iframe is present', async ({ page }) => {
    await page.goto('/');
    const iframe = page.locator('iframe[src*="youtube.com/embed"]');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', DEMO_VIDEO_EMBED_URL);
  });

  test('privacy policy link works', async ({ page }) => {
    await page.goto('/');
    const privacyLink = page.getByRole('link', { name: /Privacy Policy/i });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', /privacy-policy/);
  });

  test('features section is visible', async ({ page }) => {
    await page.goto('/');
    const featuresHeading = page.getByRole('heading', { name: /Features/i });
    await expect(featuresHeading).toBeVisible();
  });
});
