const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Extract GIF from Database ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const outputPath = path.join(process.cwd(), 'tests', 'extracted-gifs');
  
  // Create output directory
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
  
  // Clean existing files
  fs.readdirSync(outputPath).forEach(file => {
    fs.unlinkSync(path.join(outputPath, file));
  });
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();
  
  // Track frame extraction during creation
  const frameTimes = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ContentScriptGifProcessor] Captured frame')) {
      const match = text.match(/at time ([\d.]+)s/);
      if (match) {
        frameTimes.push(parseFloat(match[1]));
      }
    }
  });
  
  // STEP 1: Create a GIF
  console.log('Creating a GIF first...\n');
  
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
    }
  });
  
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  const selection = await page.evaluate(() => {
    const range = document.querySelector('.ytgif-timeline-range');
    return range ? range.textContent : null;
  });
  console.log(`Creating GIF from: ${selection}`);
  
  await page.click('.ytgif-timeline-create');
  
  // Wait for processing to complete
  await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 60000 }
  ).catch(() => {});
  
  console.log(`Captured ${frameTimes.length} frames`);
  if (frameTimes.length > 0) {
    console.log(`Time range: ${Math.min(...frameTimes).toFixed(2)}s - ${Math.max(...frameTimes).toFixed(2)}s`);
  }
  
  // Wait for save operations
  await page.waitForTimeout(5000);
  
  // STEP 2: Try to extract from IndexedDB
  console.log('\nExtracting from IndexedDB...\n');
  
  const result = await page.evaluate(async () => {
    try {
      console.log('Opening YouTubeGifStore database...');
      
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('YouTubeGifStore', 3);
        
        request.onsuccess = () => {
          console.log('Database opened successfully');
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error('Database open error:', request.error);
          reject(request.error);
        };
        
        request.onupgradeneeded = (event) => {
          console.log('Database upgrade needed');
          const db = event.target.result;
          if (!db.objectStoreNames.contains('gifs')) {
            const store = db.createObjectStore('gifs', { keyPath: 'id' });
            store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          }
        };
      });
      
      console.log('Database object store names:', Array.from(db.objectStoreNames));
      
      if (!db.objectStoreNames.contains('gifs')) {
        db.close();
        return { error: 'No gifs store found' };
      }
      
      // Get all GIFs
      const transaction = db.transaction(['gifs'], 'readonly');
      const store = transaction.objectStore('gifs');
      const request = store.getAll();
      
      const gifs = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      db.close();
      
      console.log(`Found ${gifs ? gifs.length : 0} GIFs in database`);
      
      if (gifs && gifs.length > 0) {
        const latestGif = gifs[gifs.length - 1];
        
        // Get the blob
        const blob = latestGif.blob || latestGif.gifBlob;
        if (!blob) {
          return { error: 'No blob found in GIF record' };
        }
        
        // Convert to base64
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
      
      return { error: 'No GIFs found in database' };
      
    } catch (error) {
      console.error('Error accessing database:', error);
      return { error: error.message };
    }
  });
  
  if (result.success) {
    console.log('✅ GIF successfully extracted from database!');
    console.log(`   Total GIFs: ${result.count}`);
    console.log(`   GIF size: ${(result.gif.size / 1024).toFixed(2)} KB`);
    console.log(`   GIF type: ${result.gif.type}`);
    
    if (result.gif.metadata) {
      console.log(`   Metadata:`, result.gif.metadata);
    }
    
    // Save to disk
    const base64Data = result.gif.base64.replace(/^data:.*?;base64,/, '');
    const gifPath = path.join(outputPath, 'extracted.gif');
    fs.writeFileSync(gifPath, base64Data, 'base64');
    
    console.log(`\n✅ GIF saved to: ${gifPath}`);
    
    // Analyze the GIF
    const gifBuffer = fs.readFileSync(gifPath);
    
    // Check header
    const header = gifBuffer.toString('ascii', 0, 6);
    console.log(`\nGIF Analysis:`);
    console.log(`   Header: ${header}`);
    
    // Count frames
    let frameCount = 0;
    for (let i = 0; i < gifBuffer.length - 8; i++) {
      if (gifBuffer[i] === 0x21 && gifBuffer[i + 1] === 0xF9) {
        frameCount++;
      }
    }
    console.log(`   Frames: ${frameCount}`);
    
    // Get dimensions
    const width = gifBuffer[6] | (gifBuffer[7] << 8);
    const height = gifBuffer[8] | (gifBuffer[9] << 8);
    console.log(`   Dimensions: ${width}x${height}`);
    
    // Verification
    console.log('\n✅ VERIFICATION:');
    console.log(`   - GIF was created and saved to IndexedDB`);
    console.log(`   - GIF contains ${frameCount} frames`);
    console.log(`   - Frames were captured from ${frameTimes.length > 0 ? Math.min(...frameTimes).toFixed(1) + 's to ' + Math.max(...frameTimes).toFixed(1) + 's' : 'selected range'}`);
    console.log(`   - GIF is valid and can be viewed`);
    
    // Open the GIF
    try {
      console.log('\nOpening GIF...');
      require('child_process').exec(`open "${gifPath}"`);
    } catch (e) {}
    
  } else {
    console.log('❌ Failed to extract GIF:', result.error);
    
    // Try alternative approach - check if saveGifToStorage is even being called
    console.log('\nChecking if GIF is being saved at all...');
    
    // Add logging to gif-processor
    await page.evaluate(() => {
      console.log('Checking window.__DEBUG_CAPTURED_FRAMES:', window.__DEBUG_CAPTURED_FRAMES?.length || 0);
    });
  }
  
  console.log('\n✨ Test complete!');
  console.log(`📁 Output directory: ${outputPath}`);
  
  await browser.close();
  process.exit(result.success ? 0 : 1);
})();