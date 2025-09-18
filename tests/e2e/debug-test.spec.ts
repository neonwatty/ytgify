import { test, expect } from '@playwright/test';

test('Debug: Extension loads on YouTube', async ({ page, context }) => {
  // Check service workers
  const serviceWorkers = context.serviceWorkers();
  console.log('Service workers found:', serviceWorkers.length);
  for (const sw of serviceWorkers) {
    console.log('Service worker URL:', sw.url());
  }

  // Check if extension ID exists
  let extensionId = null;
  if (serviceWorkers.length > 0) {
    const url = serviceWorkers[0].url();
    const match = url.match(/chrome-extension:\/\/([^\/]+)/);
    if (match) {
      extensionId = match[1];
      console.log('Extension ID:', extensionId);
    }
  }
  // Navigate to YouTube
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');

  // Wait for page to load
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: 'tests/test-results/debug-youtube-load.png', fullPage: true });

  // Check for video element
  const videoExists = await page.locator('video').isVisible();
  console.log('Video element exists:', videoExists);

  // Check for any extension elements
  const extensionElements = await page.$$('.ytgif-button, [aria-label*="GIF"], .gif-button');
  console.log('Extension elements found:', extensionElements.length);

  // Check console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Wait a bit more
  await page.waitForTimeout(10000);

  // Take another screenshot
  await page.screenshot({ path: 'tests/test-results/debug-after-wait.png', fullPage: true });

  // Try to find the button with various selectors
  const selectors = [
    '.ytgif-button',
    '.gif-button',
    'button:has-text("GIF")',
    '.ytp-right-controls button'
  ];

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    console.log(`Selector "${selector}" found:`, elements.length, 'elements');
  }

  // List all buttons in player controls
  const playerButtons = await page.$$('.ytp-right-controls button');
  for (let i = 0; i < playerButtons.length; i++) {
    const text = await playerButtons[i].textContent();
    const ariaLabel = await playerButtons[i].getAttribute('aria-label');
    console.log(`Button ${i}: text="${text}", aria-label="${ariaLabel}"`);
  }
});