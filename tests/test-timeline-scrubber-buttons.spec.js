const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Timeline Scrubber Preset Buttons', () => {
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

  test('10s button in TimelineScrubber sets duration correctly', async () => {
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
      // Look for the TimelineScrubber preset buttons
      const getPresetButtonsInfo = async () => {
        return await page.evaluate(() => {
          const presetButtons = Array.from(document.querySelectorAll('.ytgif-preset-btn'));
          const infoValues = Array.from(document.querySelectorAll('.ytgif-info-value'));
          
          return {
            buttons: presetButtons.map(btn => btn.textContent?.trim()),
            duration: infoValues[0]?.textContent || 'not found',
            hasScrubber: !!document.querySelector('.ytgif-timeline-scrubber')
          };
        });
      };
      
      let info = await getPresetButtonsInfo();
      console.log('Initial state:', info);
      
      // Click the 10s button in the TimelineScrubber
      const tenSecButton = await page.locator('.ytgif-preset-btn:has-text("10s")').first();
      if (await tenSecButton.isVisible()) {
        console.log('Found 10s button in TimelineScrubber');
        
        // Click once
        await tenSecButton.click();
        await page.waitForTimeout(500);
        
        const afterFirst = await getPresetButtonsInfo();
        console.log('After first click:', afterFirst);
        
        // Click again
        await tenSecButton.click();
        await page.waitForTimeout(500);
        
        const afterSecond = await getPresetButtonsInfo();
        console.log('After second click:', afterSecond);
        
        // Parse durations
        const parseDuration = (str) => {
          if (!str || str === 'not found') return 0;
          return parseFloat(str.replace('s', '').replace('~', ''));
        };
        
        const dur1 = parseDuration(afterFirst.duration);
        const dur2 = parseDuration(afterSecond.duration);
        
        console.log('\n=== TEST RESULTS ===');
        console.log(`Duration after first click: ${dur1}s`);
        console.log(`Duration after second click: ${dur2}s`);
        console.log(`Durations are equal: ${dur1 === dur2}`);
        console.log(`Duration is ~10s: ${Math.abs(dur1 - 10) < 0.5}`);
        
        // Take screenshot
        await page.screenshot({ path: 'tests/screenshots/timeline-scrubber-test.png' });
        console.log('Screenshot saved to tests/screenshots/timeline-scrubber-test.png');
        
        // Assert that the duration is stable and close to 10s
        expect(dur1).toBeCloseTo(dur2, 1);
        expect(dur1).toBeCloseTo(10, 0);
      } else {
        console.log('10s button not found in TimelineScrubber');
      }
    } else {
      console.log('Not on Quick Capture screen');
    }
  });
});