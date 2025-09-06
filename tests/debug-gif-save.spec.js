const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('=== Debug GIF Save Test ===\n');
  
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
  
  // Capture ALL console logs
  page.on('console', msg => {
    console.log(`[${msg.type().toUpperCase()}]: ${msg.text()}`);
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
  
  console.log('\nClicking GIF button...\n');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  console.log('\nCreating GIF...\n');
  await page.click('.ytgif-timeline-create');
  
  // Wait for completion
  console.log('\nWaiting for processing to complete...\n');
  await page.waitForTimeout(30000); // Wait 30 seconds to see all logs
  
  console.log('\n=== Test complete - check logs above for errors ===');
  
  await browser.close();
  process.exit(0);
})();