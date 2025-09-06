const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Download Created GIF ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadsPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Clean up downloads directory
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    downloadsPath: downloadsPath
  });

  const page = await browser.newPage();
  
  let encodingComplete = false;
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Encoding complete!')) {
      encodingComplete = true;
      console.log('✅ GIF encoding complete');
    }
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
  
  console.log('Creating GIF with gifenc...\n');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  await page.click('.ytgif-timeline-create');
  
  // Wait for encoding
  console.log('Waiting for encoding to complete...\n');
  const startTime = Date.now();
  while (!encodingComplete && (Date.now() - startTime) < 15000) {
    await page.waitForTimeout(500);
  }
  
  if (encodingComplete) {
    console.log('GIF created successfully!\n');
    
    // Wait for save to complete
    await page.waitForTimeout(2000);
    
    // Now trigger download through Chrome API
    console.log('Triggering download through Chrome extension...\n');
    
    // Get the GIF from IndexedDB and trigger download
    const downloadResult = await page.evaluate(async () => {
      try {
        // Open IndexedDB
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open('YouTubeGifStore', 3);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        
        if (!db.objectStoreNames.contains('gifs')) {
          return { error: 'No gifs store' };
        }
        
        // Get the latest GIF
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
            // Create object URL and trigger download
            const url = URL.createObjectURL(blob);
            const filename = `youtube-gif-${Date.now()}.gif`;
            
            // Create download link
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up after a delay
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            return { 
              success: true, 
              filename: filename,
              size: blob.size 
            };
          }
        }
        
        return { error: 'No GIF found' };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (downloadResult.success) {
      console.log(`✅ Download triggered: ${downloadResult.filename}`);
      console.log(`   Size: ${(downloadResult.size / 1024).toFixed(2)} KB`);
      
      // Wait for download to complete
      await page.waitForTimeout(3000);
      
      // Check downloads folder
      const files = fs.readdirSync(downloadsPath);
      const gifFiles = files.filter(f => f.endsWith('.gif'));
      
      if (gifFiles.length > 0) {
        console.log('\n✅ GIF successfully downloaded to:', path.join(downloadsPath, gifFiles[0]));
        console.log('\n🎉 SUCCESS! The GIF was:');
        console.log('   1. Created with gifenc (fast encoder)');
        console.log('   2. Saved to IndexedDB');
        console.log('   3. Downloaded to disk');
      } else {
        console.log('\n⚠️  Download triggered but file not found in downloads folder');
        console.log('   The download may have gone to your default Downloads folder');
      }
      
    } else {
      console.log('❌ Failed to trigger download:', downloadResult.error);
    }
    
  } else {
    console.log('❌ GIF encoding did not complete');
  }
  
  console.log('\n✨ Test complete!');
  
  await browser.close();
  process.exit(0);
})();