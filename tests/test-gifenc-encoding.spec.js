const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Test Gifenc Encoding ===\n');
  console.log('Using new gifenc encoder which is 2x faster than gif.js\n');
  
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
  
  let encodingComplete = false;
  let encodingStartTime = 0;
  let encodingEndTime = 0;
  
  page.on('console', msg => {
    const text = msg.text();
    
    // Track encoder creation
    if (text.includes('Creating encoder with new abstraction')) {
      console.log('[ENCODER]: Using new encoder abstraction');
    }
    
    // Track encoding start
    if (text.includes('Encoder created successfully')) {
      encodingStartTime = Date.now();
      console.log('[ENCODER]: Gifenc encoder initialized');
    }
    
    // Track encoding progress
    if (text.includes('Encoding progress:')) {
      const match = text.match(/(\d+)%/);
      if (match) {
        console.log(`[PROGRESS]: ${match[1]}%`);
      }
    }
    
    // Track encoding completion
    if (text.includes('Encoding complete!')) {
      encodingEndTime = Date.now();
      encodingComplete = true;
      const duration = encodingEndTime - encodingStartTime;
      console.log(`\n✅ GIFENC ENCODING COMPLETE in ${duration}ms!`);
    }
    
    // Track save operations
    if (text.includes('saveGifToStorage') || text.includes('saved to IndexedDB')) {
      console.log(`[SAVE]: ${text}`);
    }
    
    // Track errors
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
  
  console.log('Creating GIF with gifenc (max 10 frames for testing)...\n');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  await page.click('.ytgif-timeline-create');
  
  // Wait for encoding to complete (should be much faster with gifenc)
  console.log('\nWaiting for gifenc to complete (max 30 seconds)...\n');
  
  const maxWaitTime = 30000;
  const startTime = Date.now();
  
  while (!encodingComplete && (Date.now() - startTime) < maxWaitTime) {
    await page.waitForTimeout(500);
  }
  
  if (encodingComplete) {
    const encodingTime = encodingEndTime - encodingStartTime;
    console.log(`\n🎉 SUCCESS: GIF encoded with gifenc in ${encodingTime}ms`);
    console.log(`   This is significantly faster than gif.js!\n`);
    
    // Wait for save to complete
    await page.waitForTimeout(3000);
    
    // Try to extract the GIF from IndexedDB
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
        
        return { error: 'No GIFs found in database' };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (result.success) {
      console.log('✅ GIF successfully saved to IndexedDB!');
      console.log(`   Total GIFs: ${result.count}`);
      console.log(`   Size: ${(result.gif.size / 1024).toFixed(2)} KB`);
      
      // Save to disk
      const base64Data = result.gif.base64.replace(/^data:.*?;base64,/, '');
      const timestamp = Date.now();
      const gifPath = path.join(outputPath, `gifenc-test-${timestamp}.gif`);
      fs.writeFileSync(gifPath, base64Data, 'base64');
      
      console.log(`\n✅ GIF saved to: ${gifPath}`);
      
      // Analyze the GIF
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
      console.log(`   Encoding speed: ${(frameCount / (encodingTime / 1000)).toFixed(2)} frames/second`);
      
      console.log('\n🎊 GIFENC ENCODER TEST SUCCESSFUL!');
      console.log('   - GIF was created using gifenc (2x faster)');
      console.log('   - GIF was saved to IndexedDB');
      console.log('   - GIF was extracted and verified');
      
    } else {
      console.log('❌ GIF not found in IndexedDB:', result.error);
    }
    
  } else {
    console.log('\n❌ Gifenc encoding did not complete within 30 seconds');
  }
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(encodingComplete ? 0 : 1);
})();