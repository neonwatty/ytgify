const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Simple overlay test...');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const page = await browser.newPage();
  
  // Log console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}]:`, msg.text());
  });
  
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Start video
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) { video.play(); video.currentTime = 5; }
  });
  
  await page.waitForTimeout(1000);
  
  // Click button
  const button = await page.$('.ytgif-button');
  if (button) {
    console.log('Clicking button...');
    await button.click();
    await page.waitForTimeout(3000);
    
    // Check for overlay
    const hasOverlay = await page.evaluate(() => {
      return !!document.querySelector('#ytgif-timeline-overlay');
    });
    
    console.log('Overlay present:', hasOverlay);
    
    if (!hasOverlay) {
      // Try to manually call showTimelineOverlay
      console.log('Trying manual overlay creation...');
      const created = await page.evaluate(() => {
        // Try to create overlay manually
        const overlay = document.createElement('div');
        overlay.id = 'ytgif-timeline-overlay-test';
        overlay.style.cssText = `
          position: fixed !important;
          bottom: 100px !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          width: 400px !important;
          height: 200px !important;
          background: red !important;
          z-index: 2147483647 !important;
          display: block !important;
        `;
        overlay.innerHTML = '<h1 style="color:white">TEST OVERLAY</h1>';
        document.body.appendChild(overlay);
        return true;
      });
      
      if (created) {
        console.log('Manual overlay created - checking visibility...');
        const isVisible = await page.$('#ytgif-timeline-overlay-test');
        console.log('Manual overlay visible:', !!isVisible);
      }
    }
  }
  
  console.log('Done - keeping browser open');
  await new Promise(() => {});
})();