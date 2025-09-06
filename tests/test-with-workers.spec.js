const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Test GIF with Workers ===\n');
  
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
  
  let gifFinished = false;
  
  page.on('console', msg => {
    const text = msg.text();
    // Log debug messages from gif.js
    if (text.includes('spawning worker')) {
      console.log(`[WORKER]: ${text}`);
    }
    if (text.includes('frame') && text.includes('finished')) {
      console.log(`[FRAME]: ${text}`);
    }
    if (text.includes('rendering finished')) {
      console.log(`[RENDERING]: ${text}`);
    }
    if (text.includes('GIF encoding finished')) {
      gifFinished = true;
      console.log(`✅ GIF FINISHED: ${text}`);
    }
    if (text.includes('saveGifToStorage')) {
      console.log(`[SAVE]: ${text}`);
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
  
  console.log('Creating 2-second GIF for faster testing...\n');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  // Adjust timeline to only 2 seconds
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video && window.ytGifMaker) {
      // Try to set a shorter duration if possible
      console.log('Video duration:', video.duration);
    }
  });
  
  await page.click('.ytgif-timeline-create');
  
  // Wait for completion
  console.log('\nWaiting for GIF encoding (max 60 seconds)...\n');
  
  const startTime = Date.now();
  while (!gifFinished && (Date.now() - startTime) < 60000) {
    await page.waitForTimeout(1000);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed % 5 === 0) {
      console.log(`⏳ ${elapsed}s elapsed...`);
    }
  }
  
  if (gifFinished) {
    console.log('\n✅ GIF encoding completed!\n');
    
    // Wait for save
    await page.waitForTimeout(5000);
    
    // Extract from IndexedDB
    const result = await page.evaluate(async () => {
      try {
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('YouTubeGifStore', 3);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('gifs')) {
              const store = db.createObjectStore('gifs', { keyPath: 'id' });
              store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
            }
          };
        });
        
        if (!db.objectStoreNames.contains('gifs')) {
          db.close();
          return { error: 'No gifs store found' };
        }
        
        const transaction = db.transaction(['gifs'], 'readonly');
        const store = transaction.objectStore('gifs');
        const gifs = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        db.close();
        
        if (gifs && gifs.length > 0) {
          const latestGif = gifs[gifs.length - 1];
          const blob = latestGif.blob || latestGif.gifBlob;
          
          if (blob) {
            const reader = new FileReader();
            const base64 = await new Promise(resolve => {
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            
            return {
              success: true,
              count: gifs.length,
              gif: {
                id: latestGif.id,
                size: blob.size,
                metadata: latestGif.metadata,
                base64: base64
              }
            };
          }
        }
        
        return { error: 'No GIFs found' };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (result.success) {
      console.log('✅ GIF found in IndexedDB!');
      console.log(`   Size: ${(result.gif.size / 1024).toFixed(2)} KB`);
      
      // Save to disk
      const base64Data = result.gif.base64.replace(/^data:.*?;base64,/, '');
      const gifPath = path.join(outputPath, `final-gif-${Date.now()}.gif`);
      fs.writeFileSync(gifPath, base64Data, 'base64');
      
      console.log(`\n✅ GIF saved to: ${gifPath}`);
      
      // Quick analysis
      const gifBuffer = fs.readFileSync(gifPath);
      let frameCount = 0;
      for (let i = 0; i < gifBuffer.length - 8; i++) {
        if (gifBuffer[i] === 0x21 && gifBuffer[i + 1] === 0xF9) {
          frameCount++;
        }
      }
      
      console.log(`\nGIF Analysis:`);
      console.log(`   Frames: ${frameCount}`);
      console.log(`   Size: ${gifBuffer.length} bytes`);
      
      console.log('\n🎉 SUCCESS! GIF was created, saved to IndexedDB, and extracted!');
    } else {
      console.log('❌ GIF not found in IndexedDB:', result.error);
    }
  } else {
    console.log('\n❌ GIF encoding did not complete');
  }
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(gifFinished ? 0 : 1);
})();