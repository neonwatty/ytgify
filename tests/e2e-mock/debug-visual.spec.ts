/**
 * Visual Debugging Test - Mock Tests Comparison
 */
import { test } from './fixtures';
import { QuickCapturePage } from './page-objects/QuickCapturePage';

test.describe('Visual Debugging - Mock', () => {
  test('Mock test - screenshot at each step', async ({ page, mockServerUrl }) => {
    console.log('[Mock Debug] Starting visual debugging test');

    const quickCapture = new QuickCapturePage(page);
    const mockVideoUrl = `${mockServerUrl}/watch?v=mock-short`;

    // Navigate
    console.log('[Mock Debug] Navigating to', mockVideoUrl);
    await page.goto(mockVideoUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/debug-screenshots/mock-01-page-loaded.png', fullPage: true });

    // Wait for button
    const gifButton = page.locator('.ytgif-button, button:has-text("Create GIF")').first();
    await gifButton.waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: 'tests/debug-screenshots/mock-02-button-visible.png', fullPage: true });

    // Click button
    await gifButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/debug-screenshots/mock-03-after-click.png', fullPage: true });

    // Wait for wizard
    await quickCapture.waitForScreen(15000);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/debug-screenshots/mock-04-wizard-appeared.png', fullPage: true });

    // Check Next button
    const nextButton = page.locator('.ytgif-button-primary, button:has-text("Next")').first();
    await nextButton.waitFor({ state: 'visible', timeout: 5000 });

    const buttonBox = await nextButton.boundingBox();
    const viewportSize = page.viewportSize();
    console.log('[Mock Debug] Button bounding box:', JSON.stringify(buttonBox));
    console.log('[Mock Debug] Viewport size:', JSON.stringify(viewportSize));

    // Check if button is in viewport
    const isInViewport = await page.evaluate(() => {
      const btn = document.querySelector('.ytgif-button-primary');
      if (!btn) return false;
      const rect = btn.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= viewportHeight &&
        rect.right <= viewportWidth
      );
    });

    console.log('[Mock Debug] Is button in viewport (JS check):', isInViewport);

    // Highlight button
    await page.evaluate(() => {
      const btn = document.querySelector('.ytgif-button-primary');
      if (btn) {
        (btn as HTMLElement).style.border = '5px solid red';
        (btn as HTMLElement).style.outline = '5px solid yellow';
      }
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/debug-screenshots/mock-05-button-highlighted.png', fullPage: true });

    // Try to click
    console.log('[Mock Debug] Attempting click');
    await nextButton.click({ timeout: 5000 });
    console.log('[Mock Debug] ✓ Click succeeded!');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/debug-screenshots/mock-06-after-click.png', fullPage: true });
  });
});
