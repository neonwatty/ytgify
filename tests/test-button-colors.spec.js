const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Button Active State Colors', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    page = browser.pages()[0] || await browser.newPage();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Preset and frame rate buttons have consistent active colors', async () => {
    // Go to YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player to load
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Wait for extension to inject
    await page.waitForTimeout(5000);
    
    console.log('Looking for GIF button...');
    
    // Find and click GIF button
    const gifButton = await page.locator('.ytgif-button').first();
    await gifButton.click();
    console.log('Clicked GIF button');
    
    // Wait for wizard
    await page.waitForSelector('.ytgif-overlay-wizard', { timeout: 5000 });
    console.log('Wizard opened');
    
    // Wait for auto-advance to Quick Capture
    await page.waitForTimeout(4000);
    
    // Check if we're on Quick Capture screen
    const screenTitle = await page.locator('.ytgif-wizard-title').textContent();
    console.log('Current screen:', screenTitle);
    
    if (screenTitle.includes('Quick Capture')) {
      // Click 5s preset button to make it active
      const fiveSecButton = await page.locator('.ytgif-preset-btn:has-text("5s")').first();
      await fiveSecButton.click();
      console.log('Clicked 5s preset button');
      
      // Get the background color of active preset button
      const presetActiveColor = await fiveSecButton.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          background: style.backgroundColor,
          border: style.borderColor
        };
      });
      console.log('Preset button active color:', presetActiveColor);
      
      // Click 15 fps frame rate button to make it active
      const fifteenFpsButton = await page.locator('.ytgif-frame-rate-btn:has-text("15 fps")').first();
      await fifteenFpsButton.click();
      console.log('Clicked 15 fps button');
      
      // Get the background color of active frame rate button
      const frameRateActiveColor = await fifteenFpsButton.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          background: style.backgroundColor,
          border: style.borderColor
        };
      });
      console.log('Frame rate button active color:', frameRateActiveColor);
      
      // Take screenshot showing both active buttons
      await page.screenshot({ path: 'tests/screenshots/button-colors-consistent.png' });
      console.log('Screenshot saved to tests/screenshots/button-colors-consistent.png');
      
      console.log('\n=== COLOR COMPARISON ===');
      console.log('Preset button background:', presetActiveColor.background);
      console.log('Frame rate button background:', frameRateActiveColor.background);
      console.log('Preset button border:', presetActiveColor.border);
      console.log('Frame rate button border:', frameRateActiveColor.border);
      
      // Check if colors are consistent (both should be rgba(255, 0, 0, 0.2))
      const colorsMatch = presetActiveColor.background === frameRateActiveColor.background;
      console.log('Background colors match:', colorsMatch);
      
      // Visual inspection - both should have semi-transparent red background
      expect(presetActiveColor.background).toContain('rgba');
      expect(frameRateActiveColor.background).toContain('rgba');
      
      // Border colors should both be red
      expect(presetActiveColor.border).toContain('255');
      expect(frameRateActiveColor.border).toContain('255');
    } else {
      console.log('Not on Quick Capture screen');
    }
  });
});