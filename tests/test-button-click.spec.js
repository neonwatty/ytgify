const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Testing GIF button click...');
  
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
  
  // Capture all console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('UI FIX DEBUG') || text.includes('[Content]') || text.includes('Timeline')) {
      console.log(`[CONSOLE ${msg.type()}]:`, text);
    }
  });
  
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]:', error.message);
  });
  
  // Navigate to YouTube
  console.log('Going to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Start video
  console.log('Starting video...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
    }
  });
  
  await page.waitForTimeout(2000);
  
  // Find and click GIF button
  console.log('Looking for GIF button...');
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
  
  if (gifButton) {
    console.log('✓ Found GIF button, clicking...');
    
    // Click the button
    await gifButton.click();
    console.log('✓ Button clicked');
    
    // Wait a bit for any async operations
    await page.waitForTimeout(2000);
    
    // Check what happened after click
    const afterClickState = await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      const button = document.querySelector('.ytgif-button');
      
      return {
        overlayExists: !!overlay,
        overlayVisible: overlay ? window.getComputedStyle(overlay).display !== 'none' : false,
        overlayHTML: overlay ? overlay.outerHTML.substring(0, 300) : null,
        buttonActive: button ? button.classList.contains('active') : false,
        buttonClasses: button ? button.className : null,
        bodyHTML: document.body.innerHTML.includes('ytgif-timeline'),
        allOverlays: Array.from(document.querySelectorAll('[id*="timeline"], [class*="timeline"], [id*="overlay"], [class*="overlay"]')).map(el => ({
          id: el.id,
          className: typeof el.className === 'string' ? el.className.substring(0, 100) : el.className.toString(),
          visible: window.getComputedStyle(el).display !== 'none'
        }))
      };
    });
    
    console.log('\nAfter click state:');
    console.log(JSON.stringify(afterClickState, null, 2));
    
    // Try clicking button again
    console.log('\nTrying to click button again...');
    await gifButton.click();
    await page.waitForTimeout(2000);
    
    const secondClickState = await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      return {
        overlayNow: !!overlay,
        overlayHTML: overlay ? overlay.innerHTML.substring(0, 300) : null
      };
    });
    
    console.log('After second click:', JSON.stringify(secondClickState, null, 2));
  }
  
  console.log('\nTest complete. Browser remains open.');
  await new Promise(() => {});
})();