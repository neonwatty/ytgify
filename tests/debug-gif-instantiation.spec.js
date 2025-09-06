const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('=== Debug GIF Instantiation ===\n');
  
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
  
  // Catch ALL errors
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]:', error.message);
  });
  
  page.on('console', msg => {
    const text = msg.text();
    // Log everything related to GIF
    if (text.includes('GIF') || text.includes('gif') || text.includes('encoding') || text.includes('render')) {
      console.log(`[${msg.type().toUpperCase()}]: ${text}`);
    }
  });
  
  console.log('Opening YouTube...\n');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Test GIF.js directly in the page
  console.log('Testing GIF.js availability in page context...\n');
  
  const gifTest = await page.evaluate(() => {
    try {
      // Check if GIF is available
      if (typeof window.GIF !== 'undefined') {
        return { success: true, message: 'GIF constructor found in window' };
      }
      
      // Try to import it
      const GIF = window.GIF || null;
      if (!GIF) {
        return { success: false, message: 'GIF not available in window' };
      }
      
      // Try to create an instance
      const gif = new GIF({ workers: 0, width: 100, height: 100 });
      return { success: true, message: 'GIF instance created successfully' };
      
    } catch (error) {
      return { success: false, message: error.message, stack: error.stack };
    }
  });
  
  console.log('GIF.js test result:', gifTest);
  
  // Now try the actual GIF creation flow
  console.log('\nTesting actual GIF creation...\n');
  
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
    }
  });
  
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  await page.click('.ytgif-timeline-create');
  
  // Wait and see what happens
  await page.waitForTimeout(10000);
  
  // Check if there were any captured frames
  const debugInfo = await page.evaluate(() => {
    return {
      hasCapturedFrames: typeof window.__DEBUG_CAPTURED_FRAMES !== 'undefined',
      frameCount: window.__DEBUG_CAPTURED_FRAMES ? window.__DEBUG_CAPTURED_FRAMES.length : 0
    };
  });
  
  console.log('\nDebug info:', debugInfo);
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(0);
})();