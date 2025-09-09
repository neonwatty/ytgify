const { test, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Check Scrubber Elements', () => {
  let browser;
  let page;

  test('Check what time elements are visible', async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '../dist');
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    page = browser.pages()[0] || await browser.newPage();
    
    // Navigate to a YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video to load
    await page.waitForSelector('.html5-video-player', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Try keyboard shortcut to open wizard
    await page.keyboard.down('Control');
    await page.keyboard.down('Shift');
    await page.keyboard.press('G');
    await page.keyboard.up('Shift');
    await page.keyboard.up('Control');
    
    await page.waitForTimeout(2000);
    
    // Check if wizard opened
    const wizard = await page.$('.ytgif-wizard-overlay');
    if (wizard) {
      console.log('Wizard opened!');
      
      // Click Quick Capture
      const actionCard = await page.$('.ytgif-action-card');
      if (actionCard) {
        await actionCard.click();
        await page.waitForTimeout(1500);
        
        // Check scrubber elements
        const scrubber = await page.$('.ytgif-timeline-scrubber');
        if (scrubber) {
          // Get all visible text elements
          const currentIndicator = await page.$('.ytgif-timeline-current');
          const tooltip = await page.$('.ytgif-timeline-tooltip');
          const labels = await page.$('.ytgif-timeline-labels');
          const duration = await page.$('.ytgif-selection-duration');
          
          console.log('Elements found:');
          console.log('- Current indicator:', currentIndicator ? 'FOUND' : 'not found');
          console.log('- Tooltip:', tooltip ? 'FOUND' : 'not found');
          console.log('- Labels:', labels ? 'FOUND' : 'not found');
          console.log('- Duration:', duration ? 'FOUND' : 'not found');
          
          // Check visibility
          if (currentIndicator) {
            const isVisible = await currentIndicator.isVisible();
            const styles = await currentIndicator.evaluate(el => window.getComputedStyle(el).display);
            console.log('Current indicator visible:', isVisible, 'display:', styles);
          }
          
          if (tooltip) {
            const isVisible = await tooltip.isVisible();
            const text = await tooltip.textContent();
            console.log('Tooltip visible:', isVisible, 'text:', text);
          }
          
          if (labels) {
            const text = await labels.textContent();
            console.log('Labels text:', text);
          }
          
          // Take screenshot
          await scrubber.screenshot({ path: 'tests/screenshots/scrubber-elements.png' });
          console.log('Screenshot saved to tests/screenshots/scrubber-elements.png');
        }
      }
    } else {
      console.log('Wizard not opened');
      await page.screenshot({ path: 'tests/screenshots/no-wizard.png' });
    }
    
    await browser.close();
  });
});