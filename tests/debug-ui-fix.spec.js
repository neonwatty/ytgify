const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Starting UI fix debug test...');
  
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
  
  // Listen to console messages
  page.on('console', msg => {
    if (msg.text().includes('UI FIX DEBUG')) {
      console.log('🔍 DEBUG:', msg.text());
    }
  });
  
  // Navigate to a short YouTube video
  console.log('Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });

  // Wait for video player to be ready
  await page.waitForTimeout(3000);
  
  // Start video playback
  console.log('Starting video...');
  const videoElement = await page.waitForSelector('video', { timeout: 10000 });
  await videoElement.evaluate(video => {
    video.play();
    video.currentTime = 5;
  });
  
  await page.waitForTimeout(2000);

  // Look for GIF button
  console.log('Looking for GIF button...');
  const gifButton = await page.waitForSelector('#ytgif-button, .ytgif-button', { 
    timeout: 10000 
  }).catch(() => null);
  
  if (gifButton) {
    console.log('✓ Found GIF button');
    
    // Check if button is visible
    const buttonVisible = await gifButton.isVisible();
    console.log(`Button visible: ${buttonVisible}`);
    
    if (buttonVisible) {
      console.log('Clicking GIF button...');
      await gifButton.click();
      
      // Wait for console logs
      await page.waitForTimeout(2000);
      
      // Check DOM for overlay
      const overlayInfo = await page.evaluate(() => {
        const overlay = document.querySelector('#ytgif-timeline-overlay');
        if (overlay) {
          const styles = window.getComputedStyle(overlay);
          return {
            found: true,
            display: styles.display,
            visibility: styles.visibility,
            zIndex: styles.zIndex,
            position: styles.position,
            width: overlay.offsetWidth,
            height: overlay.offsetHeight,
            inlineStyles: overlay.style.cssText,
            innerHTML: overlay.innerHTML.substring(0, 200)
          };
        }
        return { found: false };
      });
      
      console.log('Overlay info:', JSON.stringify(overlayInfo, null, 2));
      
      if (overlayInfo.found) {
        console.log('✅ Overlay found in DOM!');
        
        // Check if React component rendered
        const hasReactContent = await page.evaluate(() => {
          const overlay = document.querySelector('#ytgif-timeline-overlay');
          return overlay && overlay.children.length > 0;
        });
        
        console.log(`React content rendered: ${hasReactContent}`);
      } else {
        console.log('❌ Overlay not found in DOM');
      }
    }
  } else {
    console.log('❌ GIF button not found');
  }

  console.log('\nTest complete. Check console for debug messages.');
  console.log('Press Ctrl+C to exit...');
  
  await new Promise(() => {});
})();