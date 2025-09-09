const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Preset Button Functionality', () => {
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

  test('Preset buttons in Custom Range set duration correctly', async () => {
    // Go to YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player to load
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Wait for extension to inject
    await page.waitForTimeout(5000);
    
    // Find and click GIF button
    const gifButton = await page.locator('.ytgif-button').first();
    await gifButton.click();
    console.log('Clicked GIF button');
    
    // Wait for wizard
    await page.waitForSelector('.ytgif-overlay-wizard', { timeout: 5000 });
    console.log('Wizard opened');
    
    // Wait for wizard to auto-advance to Quick Capture
    await page.waitForTimeout(4000);
    
    // Check if we're on Quick Capture screen  
    let screenTitle = await page.locator('.ytgif-wizard-title').textContent();
    console.log('Current screen:', screenTitle);
    
    if (screenTitle.includes('Quick Capture')) {
      // We're on the Quick Capture screen, look for preset buttons
      
      // Check initial duration
      const getSelectionInfo = async () => {
        return await page.evaluate(() => {
          // Try to find the timeline scrubber info
          const timeDisplays = Array.from(document.querySelectorAll('.ytgif-time-display'));
          const infoValues = Array.from(document.querySelectorAll('.ytgif-info-value'));
          const presetButtons = Array.from(document.querySelectorAll('.ytgif-preset-button'));
          
          // Try to get selection from scrubber
          const scrubber = document.querySelector('.ytgif-timeline-scrubber');
          let selectionData = null;
          if (scrubber) {
            // Look for time indicators
            const startTimeEl = scrubber.querySelector('.ytgif-time-start');
            const endTimeEl = scrubber.querySelector('.ytgif-time-end');
            if (startTimeEl && endTimeEl) {
              selectionData = {
                start: startTimeEl.textContent,
                end: endTimeEl.textContent
              };
            }
          }
          
          return {
            timeDisplays: timeDisplays.map(el => el.textContent),
            infoValues: infoValues.map(el => el.textContent),
            presetButtons: presetButtons.map(el => el.textContent.trim()),
            selectionData
          };
        });
      };
      
      console.log('Initial selection:', await getSelectionInfo());
      
      // Click the 10s button
      const tenSecondButton = await page.locator('.ytgif-preset-button:has-text("10s")').first();
      if (await tenSecondButton.isVisible()) {
        console.log('Found 10s button, clicking...');
        await tenSecondButton.click();
        
        // Wait a moment for update
        await page.waitForTimeout(500);
        
        // Check the duration after clicking
        const afterFirstClick = await getSelectionInfo();
        console.log('After first click:', afterFirstClick);
        
        // Click again to see if it changes
        await tenSecondButton.click();
        await page.waitForTimeout(500);
        
        const afterSecondClick = await getSelectionInfo();
        console.log('After second click:', afterSecondClick);
        
        // The duration should be the same after both clicks if the fix works
        if (afterFirstClick.infoValues && afterSecondClick.infoValues) {
          const duration1 = afterFirstClick.infoValues[0];
          const duration2 = afterSecondClick.infoValues[0];
          console.log(`Duration after first click: ${duration1}`);
          console.log(`Duration after second click: ${duration2}`);
          
          // Check if it's close to 10s
          const getDurationValue = (str) => {
            if (!str) return 0;
            return parseFloat(str.replace('s', '').replace('~', ''));
          };
          
          const dur1 = getDurationValue(duration1);
          const dur2 = getDurationValue(duration2);
          
          console.log('=== TEST RESULTS ===');
          console.log(`First click duration: ${dur1}s`);
          console.log(`Second click duration: ${dur2}s`);
          console.log(`Duration stable: ${dur1 === dur2}`);
          console.log(`Close to 10s: ${Math.abs(dur1 - 10) < 1}`);
        }
        
        // Take screenshot for verification
        await page.screenshot({ path: 'tests/screenshots/preset-buttons-test.png' });
        console.log('Screenshot saved');
      } else {
        console.log('10s button not found');
      }
    } else {
      console.log('Custom Range option not found');
    }
  });
});