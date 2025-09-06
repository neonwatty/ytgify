const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Wait for GIF Encoding Test ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const outputPath = path.join(process.cwd(), 'tests', 'extracted-gifs');
  
  // Create output directory
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
  
  // Track encoding progress
  let encodingStarted = false;
  let encodingComplete = false;
  let lastProgress = 0;
  
  page.on('console', msg => {
    const text = msg.text();
    
    // Track encoding progress
    if (text.includes('GIF encoding finished')) {
      encodingComplete = true;
      console.log('✅ GIF encoding finished!');
    }
    
    if (text.includes('Starting GIF render')) {
      encodingStarted = true;
      console.log('🎬 GIF encoding started...');
    }
    
    if (text.includes('Encoding:')) {
      const match = text.match(/Encoding: (\d+)%/);
      if (match) {
        const progress = parseInt(match[1]);
        if (progress > lastProgress) {
          lastProgress = progress;
          console.log(`📊 Encoding progress: ${progress}%`);
        }
      }
    }
    
    // Log save operations
    if (text.includes('saveGifToStorage') || text.includes('Saving GIF') || text.includes('saved to IndexedDB')) {
      console.log(`💾 ${text}`);
    }
  });
  
  console.log('Opening YouTube...\n');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Set video to specific time
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
  
  // Get selection info
  const selection = await page.evaluate(() => {
    const range = document.querySelector('.ytgif-timeline-range');
    return range ? range.textContent : null;
  });
  console.log(`Selection: ${selection}\n`);
  
  // Start GIF creation
  await page.click('.ytgif-timeline-create');
  
  // Wait for encoding to start
  console.log('Waiting for encoding to start...\n');
  let attempts = 0;
  while (!encodingStarted && attempts < 30) {
    await page.waitForTimeout(1000);
    attempts++;
  }
  
  if (!encodingStarted) {
    console.log('❌ Encoding never started!');
  } else {
    console.log('Waiting for encoding to complete (max 3 minutes)...\n');
    
    // Wait for encoding to complete with timeout
    const maxWaitTime = 180000; // 3 minutes
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();
    
    while (!encodingComplete && (Date.now() - startTime) < maxWaitTime) {
      await page.waitForTimeout(checkInterval);
      
      // Check if still encoding
      const isStillEncoding = await page.evaluate(() => {
        return window.__DEBUG_CAPTURED_FRAMES ? window.__DEBUG_CAPTURED_FRAMES.length : 0;
      });
      
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (elapsed % 10 === 0) {
        console.log(`⏳ Still waiting... (${elapsed}s elapsed, ${isStillEncoding} frames captured)`);
      }
    }
    
    if (encodingComplete) {
      console.log('\n✅ GIF encoding completed successfully!\n');
      
      // Wait a bit more for save operations
      await page.waitForTimeout(5000);
      
      // Try to extract from IndexedDB
      console.log('Extracting GIF from IndexedDB...\n');
      
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
                  type: blob.type,
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
        console.log('✅ GIF found in IndexedDB!');
        console.log(`   Size: ${(result.gif.size / 1024).toFixed(2)} KB`);
        
        // Save to disk
        const base64Data = result.gif.base64.replace(/^data:.*?;base64,/, '');
        const gifPath = path.join(outputPath, `encoded-gif-${Date.now()}.gif`);
        fs.writeFileSync(gifPath, base64Data, 'base64');
        
        console.log(`\n✅ GIF saved to: ${gifPath}`);
        
        // Analyze
        const gifBuffer = fs.readFileSync(gifPath);
        const header = gifBuffer.toString('ascii', 0, 6);
        let frameCount = 0;
        for (let i = 0; i < gifBuffer.length - 8; i++) {
          if (gifBuffer[i] === 0x21 && gifBuffer[i + 1] === 0xF9) {
            frameCount++;
          }
        }
        
        console.log(`\nGIF Analysis:`);
        console.log(`   Header: ${header}`);
        console.log(`   Frames: ${frameCount}`);
        console.log(`   Size: ${gifBuffer.length} bytes`);
        
      } else {
        console.log('❌ GIF not found in IndexedDB:', result.error);
      }
      
    } else {
      console.log('\n❌ Encoding timed out after 3 minutes');
    }
  }
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(0);
})();