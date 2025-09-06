const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Test GIF Render ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs'
    ],
    viewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    // Log everything related to render
    if (text.includes('render') || text.includes('Render') || text.includes('RENDER')) {
      console.log(`[RENDER LOG]: ${text}`);
    }
    if (text.includes('finished') || text.includes('encoding finished')) {
      console.log(`[FINISHED]: ${text}`);
    }
    if (text.includes('error') || text.includes('Error')) {
      console.log(`[ERROR]: ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]:', error.message);
  });
  
  console.log('Opening YouTube...\n');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
    }
  });
  
  console.log('Creating GIF...\n');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  await page.click('.ytgif-timeline-create');
  
  // Wait for 30 seconds to see what happens
  console.log('\nWaiting 30 seconds to monitor process...\n');
  await page.waitForTimeout(30000);
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(0);
})();