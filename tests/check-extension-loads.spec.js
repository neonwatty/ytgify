const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Checking if extension loads...');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  console.log('Extension path:', extensionPath);
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 }
  });

  // Check extensions page
  const page = await browser.newPage();
  await page.goto('chrome://extensions/');
  await page.waitForTimeout(2000);
  
  // Navigate to YouTube
  console.log('Going to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(5000);
  
  // Check for any signs of the extension
  const extensionLoaded = await page.evaluate(() => {
    return {
      hasGifButton: !!document.querySelector('#ytgif-button, .ytgif-button, button[aria-label*="GIF"]'),
      hasContentScript: !!window.__YTGIF_CONTENT_LOADED__,
      bodyClasses: document.body.className,
      playerControlsExist: !!document.querySelector('.ytp-right-controls'),
      allButtons: Array.from(document.querySelectorAll('.ytp-right-controls button')).map(b => ({
        label: b.getAttribute('aria-label'),
        title: b.title,
        className: b.className
      }))
    };
  });
  
  console.log('Extension check:', JSON.stringify(extensionLoaded, null, 2));
  
  // Try injecting the button manually to test
  if (!extensionLoaded.hasGifButton && extensionLoaded.playerControlsExist) {
    console.log('Trying to manually inject button...');
    await page.evaluate(() => {
      const controls = document.querySelector('.ytp-right-controls');
      if (controls) {
        const button = document.createElement('button');
        button.id = 'ytgif-button-manual';
        button.className = 'ytp-button';
        button.innerHTML = 'GIF';
        button.style.cssText = 'color: white; padding: 0 8px;';
        controls.insertBefore(button, controls.firstChild);
        return true;
      }
      return false;
    });
    
    const manualButton = await page.$('#ytgif-button-manual');
    if (manualButton) {
      console.log('✓ Manual button injection works');
    }
  }
  
  await page.waitForTimeout(5000);
  process.exit(0);
})();