import { test, expect } from '@playwright/test';
import { DEMO_VIDEO_EMBED_URL } from '../lib/constants';

test.describe('Landing Page Smoke Tests', () => {
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/YTgify/);
  });

  test('headline is visible', async ({ page }) => {
    await page.goto('/');
    const headline = page.getByRole('heading', { name: /YouTube to GIF Converter/i });
    await expect(headline).toBeVisible();
  });

  test('Chrome Store badge links correctly', async ({ page }) => {
    await page.goto('/');
    const badges = page.locator('a[href*="chromewebstore.google.com"]');
    await expect(badges.first()).toBeVisible();
    // Verify we have multiple Chrome Store CTAs (top, after video, footer)
    await expect(badges).toHaveCount(3);
  });

  test('Firefox Add-on badge links correctly', async ({ page }) => {
    await page.goto('/');
    const badges = page.locator('a[href*="addons.mozilla.org"]');
    await expect(badges.first()).toBeVisible();
    // Verify we have multiple Firefox Add-on CTAs (after video, footer)
    await expect(badges).toHaveCount(2);
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
    const featuresHeading = page.getByRole('heading', { name: /See it in action/i });
    await expect(featuresHeading).toBeVisible();
  });

  test('GitHub social link is visible and correct', async ({ page }) => {
    await page.goto('/');
    const githubLink = page.getByRole('link', { name: /GitHub/i });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/neonwatty');
    await expect(githubLink).toHaveAttribute('target', '_blank');
  });

  test('X (Twitter) social link is visible and correct', async ({ page }) => {
    await page.goto('/');
    const xLink = page.getByRole('link', { name: /X \(Twitter\)/i });
    await expect(xLink).toBeVisible();
    await expect(xLink).toHaveAttribute('href', 'https://x.com/neonwatty');
    await expect(xLink).toHaveAttribute('target', '_blank');
  });

  test('external Blog social link is visible and correct', async ({ page }) => {
    await page.goto('/');
    const blogLink = page.locator('footer a[href="https://neonwatty.com/"]');
    await expect(blogLink).toBeVisible();
    await expect(blogLink).toHaveAttribute('target', '_blank');
  });

  test('internal Blog link is visible', async ({ page }) => {
    await page.goto('/');
    const blogLink = page.locator('footer a[href="/blog"]');
    await expect(blogLink).toBeVisible();
  });

  test('all social links have security attributes', async ({ page }) => {
    await page.goto('/');
    const socialLinks = page.locator('footer a[target="_blank"][rel="noopener noreferrer"]').filter({
      has: page.locator('svg')
    });
    await expect(socialLinks).toHaveCount(3);
  });
});
