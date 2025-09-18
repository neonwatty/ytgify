import { test, expect } from './fixtures';

test('Simple test - GIF button appears on YouTube', async ({ page, context, extensionId }) => {
  console.log('Extension ID:', extensionId);
  expect(extensionId).toBeTruthy();

  // Navigate to YouTube
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');

  // Wait for video element
  await page.waitForSelector('video', { timeout: 30000 });

  // Wait longer for extension to initialize and inject button
  await page.waitForTimeout(10000);

  // Try multiple selectors for the GIF button
  const selectors = [
    '.ytgif-button',
    '.gif-button',
    'button[aria-label*="GIF"]',
    'button[aria-label*="Create GIF"]',
    '.ytp-right-controls button:has-text("GIF")'
  ];

  let gifButton = null;
  for (const selector of selectors) {
    try {
      gifButton = await page.waitForSelector(selector, { timeout: 5000 });
      if (gifButton) {
        console.log(`Found GIF button with selector: ${selector}`);
        break;
      }
    } catch {
      // Continue to next selector
    }
  }

  // Take screenshot for debugging
  await page.screenshot({ path: 'tests/test-results/simple-test.png', fullPage: false });

  // Check if button was found
  if (!gifButton) {
    // Log all buttons for debugging
    const buttons = await page.$$eval('.ytp-right-controls button', buttons =>
      buttons.map(b => ({
        text: b.textContent,
        ariaLabel: b.getAttribute('aria-label'),
        className: b.className
      }))
    );
    console.log('All buttons in player controls:', JSON.stringify(buttons, null, 2));
  }

  expect(gifButton).toBeTruthy();
});