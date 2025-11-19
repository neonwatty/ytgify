/**
 * Visual Debugging Test - Takes screenshots at each step
 */
import { test } from './fixtures';
import { QuickCapturePage } from '../e2e-mock/page-objects/QuickCapturePage';

test.describe('Visual Debugging', () => {
  test('Anonymous user - screenshot at each step', async ({ page, context, extensionId, mockServerUrl }) => {
    console.log('[Debug] Starting visual debugging test');
    console.log('[Debug] Extension ID:', extensionId);

    const quickCapture = new QuickCapturePage(page);
    const mockVideoUrl = `${mockServerUrl}/watch?v=mock-short`;

    // Step 1: Navigate to video page
    console.log('[Debug] Step 1: Navigating to', mockVideoUrl);
    await page.goto(mockVideoUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/debug-screenshots/01-page-loaded.png', fullPage: true });
    console.log('[Debug] ✓ Screenshot saved: 01-page-loaded.png');

    // Step 2: Wait for extension button
    console.log('[Debug] Step 2: Waiting for GIF button');
    const gifButton = page.locator('.ytgif-button, button:has-text("Create GIF")').first();
    await gifButton.waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: 'tests/debug-screenshots/02-button-visible.png', fullPage: true });
    console.log('[Debug] ✓ Screenshot saved: 02-button-visible.png');

    // Step 3: Click GIF button
    console.log('[Debug] Step 3: Clicking GIF button');
    await gifButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/debug-screenshots/03-after-button-click.png', fullPage: true });
    console.log('[Debug] ✓ Screenshot saved: 03-after-button-click.png');

    // Step 4: Wait for wizard to appear
    console.log('[Debug] Step 4: Waiting for wizard');
    await quickCapture.waitForScreen(15000);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/debug-screenshots/04-wizard-appeared.png', fullPage: true });
    console.log('[Debug] ✓ Screenshot saved: 04-wizard-appeared.png');

    // Step 5: Check Next button
    console.log('[Debug] Step 5: Locating Next button');
    const nextButton = page.locator('.ytgif-button-primary, button:has-text("Next")').first();
    await nextButton.waitFor({ state: 'visible', timeout: 5000 });

    // Get button position and viewport info
    const buttonBox = await nextButton.boundingBox();
    const viewportSize = page.viewportSize();
    console.log('[Debug] Button bounding box:', JSON.stringify(buttonBox));
    console.log('[Debug] Viewport size:', JSON.stringify(viewportSize));

    // Highlight the button visually
    await page.evaluate((selector) => {
      const btn = document.querySelector(selector);
      if (btn) {
        (btn as HTMLElement).style.border = '5px solid red';
        (btn as HTMLElement).style.outline = '5px solid yellow';
      }
    }, '.ytgif-button-primary');

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/debug-screenshots/05-button-highlighted.png', fullPage: true });
    console.log('[Debug] ✓ Screenshot saved: 05-button-highlighted.png');

    // Step 6: Check if button is in viewport
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

    console.log('[Debug] Is button in viewport (JS check):', isInViewport);

    // Get computed styles
    const buttonStyles = await page.evaluate(() => {
      const btn = document.querySelector('.ytgif-button-primary');
      if (!btn) return null;

      const styles = window.getComputedStyle(btn);
      const parent = btn.parentElement;
      const parentStyles = parent ? window.getComputedStyle(parent) : null;

      return {
        button: {
          position: styles.position,
          top: styles.top,
          left: styles.left,
          transform: styles.transform,
          zIndex: styles.zIndex,
          display: styles.display,
          visibility: styles.visibility,
        },
        parent: parentStyles ? {
          position: parentStyles.position,
          top: parentStyles.top,
          left: parentStyles.left,
          transform: parentStyles.transform,
          overflow: parentStyles.overflow,
        } : null,
      };
    });

    console.log('[Debug] Button styles:', JSON.stringify(buttonStyles, null, 2));

    // Step 7: Scroll button into view
    console.log('[Debug] Step 7: Scrolling button into view');
    await nextButton.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/debug-screenshots/06-after-scroll.png', fullPage: true });
    console.log('[Debug] ✓ Screenshot saved: 06-after-scroll.png');

    // Step 8: Try to click
    console.log('[Debug] Step 8: Attempting click');
    try {
      await nextButton.click({ timeout: 5000 });
      console.log('[Debug] ✓ Click succeeded!');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/debug-screenshots/07-after-click-success.png', fullPage: true });
    } catch (error) {
      console.log('[Debug] ✗ Click failed:', error instanceof Error ? error.message : String(error));
      await page.screenshot({ path: 'tests/debug-screenshots/07-click-failed.png', fullPage: true });
      throw error;
    }
  });
});
