const { test, chromium } = require('@playwright/test');
const path = require('path');

test('Debug progress updates', async () => {
  test.setTimeout(120000);
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${path.join(__dirname, '..', 'dist')}`,
      `--load-extension=${path.join(__dirname, '..', 'dist')}`,
    ],
    viewport: { width: 1400, height: 800 },
  });

  const page = await browser.newPage();
  
  // Capture ALL console logs
  page.on('console', msg => {
    console.log('PAGE:', msg.text());
  });

  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
    waitUntil: 'domcontentloaded' 
  });

  await page.waitForSelector('video', { timeout: 15000 });
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
    }
  });
  
  await page.waitForTimeout(3000);

  // Find and click GIF button
  const gifButton = await page.$('.ytgif-button, .ytp-button[aria-label*="GIF"]');
  if (gifButton) {
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    // Click create
    const createButton = await page.$('.ytgif-timeline-create');
    if (createButton) {
      console.log('\n=== CLICKING CREATE GIF ===\n');
      await createButton.click();
      
      // Wait and monitor
      await page.waitForTimeout(10000);
    }
  }
  
  await browser.close();
});