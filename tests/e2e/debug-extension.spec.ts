import { test, expect } from './fixtures';

test('Extension loads with persistent context', async ({ page, context, extensionId }) => {
  console.log('Extension ID:', extensionId);

  // Check service workers
  const serviceWorkers = context.serviceWorkers();
  console.log('Service workers:', serviceWorkers.length);

  // Navigate to YouTube
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');

  // Wait for video to load
  await page.waitForSelector('video', { timeout: 30000 });
  console.log('Video loaded');

  // Wait a bit for extension to inject
  await page.waitForTimeout(5000);

  // Look for GIF button
  const gifButton = await page.$('.ytgif-button, [aria-label*="GIF"], button:has-text("GIF")');
  console.log('GIF button found:', !!gifButton);

  // Check all buttons in player controls
  const buttons = await page.$$('.ytp-right-controls button');
  console.log('Total buttons in player controls:', buttons.length);

  // Take screenshot
  await page.screenshot({ path: 'tests/test-results/extension-loaded.png' });

  expect(serviceWorkers.length).toBeGreaterThan(0);
});