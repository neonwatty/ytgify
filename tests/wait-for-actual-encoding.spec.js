const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Wait for Actual GIF Encoding ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const outputPath = path.join(process.cwd(), 'tests', 'extracted-gifs');
  
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
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
  
  let renderStarted = false;
  let gifFinished = false;
  let lastLogTime = Date.now();
  
  page.on('console', msg => {
    const text = msg.text();
    const now = Date.now();
    const elapsed = now - lastLogTime;
    lastLogTime = now;
    
    // Log everything with timing
    if (text.includes('GIF') || text.includes('render') || text.includes('Encoding')) {
      console.log(`[${elapsed}ms] ${text}`);
    }
    
    if (text.includes('Starting GIF render')) {
      renderStarted = true;
      console.log('✅ GIF render started!');
    }
    
    if (text.includes('GIF encoding finished')) {
      gifFinished = true;
      console.log('✅ GIF encoding finished!');
    }
    
    // Debug logs from gif.js
    if (text.includes('spawning worker') || text.includes('frame') || text.includes('finished')) {
      console.log(`[GIF.JS] ${text}`);
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
  
  // Wait longer and monitor
  console.log('\nMonitoring GIF encoding process...\n');
  
  const maxWait = 120000; // 2 minutes
  const checkInterval = 1000; // 1 second
  const startTime = Date.now();
  
  while (!gifFinished && (Date.now() - startTime) < maxWait) {
    await page.waitForTimeout(checkInterval);
    
    // Check if gif.js is still running
    const gifStatus = await page.evaluate(() => {
      // Try to check if there's a GIF instance
      const debugFrames = window.__DEBUG_CAPTURED_FRAMES;
      return {
        capturedFrames: debugFrames ? debugFrames.length : 0,
        timestamp: Date.now()
      };
    });
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 5 === 0) {
      console.log(`⏳ Still waiting... ${elapsed}s elapsed, ${gifStatus.capturedFrames} debug frames`);
    }
  }
  
  if (gifFinished) {
    console.log('\n✅ SUCCESS: GIF encoding completed!\n');
    
    // Try to extract the GIF
    const result = await page.evaluate(async () => {
      try {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('YouTubeGifStore', 3);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        if (db.objectStoreNames.contains('gifs')) {
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const gifs = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          
          db.close();
          return { success: true, count: gifs.length };
        }
        
        db.close();
        return { success: false, error: 'No gifs store' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('IndexedDB check:', result);
  } else {
    console.log('\n❌ TIMEOUT: GIF encoding did not complete in 2 minutes\n');
    console.log(`Render started: ${renderStarted}`);
  }
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(gifFinished ? 0 : 1);
})();