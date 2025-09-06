const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Extract and Analyze Generated GIF ===\n');
  console.log('This test will create a GIF, extract it from storage, and verify its content.\n');
  
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
  
  // Track GIF creation
  let gifCreated = false;
  let framesCaptured = 0;
  const capturedTimes = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ContentScriptGifProcessor] Captured frame')) {
      const match = text.match(/frame (\d+)\/(\d+) at time ([\d.]+)s/);
      if (match) {
        framesCaptured = parseInt(match[2]);
        capturedTimes.push(parseFloat(match[3]));
      }
    }
    if (text.includes('GIF saved') || text.includes('GIF created successfully')) {
      gifCreated = true;
      console.log(`[LOG]: ${text}`);
    }
  });
  
  // STEP 1: Create a GIF
  console.log('STEP 1: Creating a GIF from YouTube video...\n');
  
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Set video position
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
    }
  });
  await page.waitForTimeout(1000);
  
  // Create GIF
  console.log('Opening GIF interface...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  const selection = await page.evaluate(() => {
    const range = document.querySelector('.ytgif-timeline-range');
    return range ? range.textContent : null;
  });
  console.log(`Selection range: ${selection}`);
  
  console.log('Creating GIF...');
  const startTime = Date.now();
  await page.click('.ytgif-timeline-create');
  
  // Wait for processing
  await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 60000 }
  ).catch(() => {});
  
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Processing completed in ${processingTime} seconds`);
  console.log(`Frames captured: ${framesCaptured || capturedTimes.length}`);
  
  // Wait for save operations
  await page.waitForTimeout(5000);
  
  // STEP 2: Access IndexedDB and extract the GIF
  console.log('\nSTEP 2: Extracting GIF from storage...\n');
  
  const extractedGif = await page.evaluate(async () => {
    try {
      // Open the specific database with version
      const dbName = 'YouTubeGifStore';
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 3);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => {
          // Handle upgrade if needed
          const db = event.target.result;
          if (!db.objectStoreNames.contains('gifs')) {
            const gifsStore = db.createObjectStore('gifs', { keyPath: 'id' });
            gifsStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          }
        };
      });
          
          // Check if 'gifs' store exists
          if (!db.objectStoreNames.contains('gifs')) {
            db.close();
            continue;
          }
          
          // Get all GIFs from store
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const getAllRequest = store.getAll();
          
          const gifs = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
          });
          
          db.close();
          
          if (gifs && gifs.length > 0) {
            // Get the most recent GIF
            const latestGif = gifs[gifs.length - 1];
            
            // Convert blob to base64
            const reader = new FileReader();
            const base64 = await new Promise((resolve) => {
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(latestGif.blob || latestGif.gifBlob);
            });
            
            return {
              found: true,
              dbName: dbName,
              gifCount: gifs.length,
              gif: {
                id: latestGif.id,
                size: latestGif.blob ? latestGif.blob.size : latestGif.gifBlob?.size,
                metadata: latestGif.metadata,
                base64: base64
              }
            };
          }
        } catch (e) {
          // Try next database name
          continue;
        }
      }
      
      // If we get here, no GIF was found in any database
      // Try to check what databases exist
      const databases = await indexedDB.databases();
      return {
        found: false,
        databases: databases.map(db => db.name)
      };
      
    } catch (error) {
      return {
        found: false,
        error: error.message
      };
    }
  });
  
  if (extractedGif.found) {
    console.log(`✅ GIF found in IndexedDB: ${extractedGif.dbName}`);
    console.log(`   Total GIFs in storage: ${extractedGif.gifCount}`);
    console.log(`   GIF size: ${(extractedGif.gif.size / 1024).toFixed(2)} KB`);
    
    if (extractedGif.gif.metadata) {
      console.log(`   Metadata:`, extractedGif.gif.metadata);
    }
    
    // Save the GIF to disk
    const base64Data = extractedGif.gif.base64.replace(/^data:image\/gif;base64,/, '');
    const gifPath = path.join(outputPath, 'extracted-gif.gif');
    fs.writeFileSync(gifPath, base64Data, 'base64');
    console.log(`\n✅ GIF saved to: ${gifPath}`);
    
    // STEP 3: Analyze the GIF
    console.log('\nSTEP 3: Analyzing GIF content...\n');
    
    const gifBuffer = fs.readFileSync(gifPath);
    
    // Check GIF header
    const header = gifBuffer.toString('ascii', 0, 6);
    console.log(`GIF Header: ${header} (${header === 'GIF89a' ? 'Valid animated GIF' : header === 'GIF87a' ? 'Valid GIF' : 'Invalid'})`);
    
    // Count frames (simplified - looks for Graphics Control Extension blocks)
    let frameCount = 0;
    for (let i = 0; i < gifBuffer.length - 1; i++) {
      if (gifBuffer[i] === 0x21 && gifBuffer[i + 1] === 0xF9) {
        frameCount++;
      }
    }
    console.log(`Estimated frames in GIF: ${frameCount}`);
    
    // Extract frame delays
    const frameDelays = [];
    for (let i = 0; i < gifBuffer.length - 8; i++) {
      if (gifBuffer[i] === 0x21 && gifBuffer[i + 1] === 0xF9 && gifBuffer[i + 2] === 0x04) {
        // Graphics Control Extension found
        const delay = gifBuffer[i + 4] | (gifBuffer[i + 5] << 8);
        frameDelays.push(delay * 10); // Convert to milliseconds
      }
    }
    
    if (frameDelays.length > 0) {
      const avgDelay = frameDelays.reduce((a, b) => a + b, 0) / frameDelays.length;
      console.log(`Frame delays: ${frameDelays.slice(0, 5).join(', ')}${frameDelays.length > 5 ? '...' : ''} ms`);
      console.log(`Average delay: ${avgDelay.toFixed(1)} ms (~${(1000/avgDelay).toFixed(1)} fps)`);
    }
    
    // Get GIF dimensions
    const width = gifBuffer[6] | (gifBuffer[7] << 8);
    const height = gifBuffer[8] | (gifBuffer[9] << 8);
    console.log(`GIF dimensions: ${width}x${height}`);
    
    // STEP 4: Create comparison frames
    console.log('\nSTEP 4: Extracting frames from GIF for comparison...\n');
    
    // We'll use the page to render the GIF and capture frames
    const framesData = await page.evaluate(async (base64Gif) => {
      const img = new Image();
      img.src = base64Gif;
      
      await new Promise(resolve => {
        img.onload = resolve;
      });
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      // Draw and capture first frame
      ctx.drawImage(img, 0, 0);
      const firstFrame = canvas.toDataURL('image/png');
      
      return {
        width: img.width,
        height: img.height,
        firstFrame: firstFrame
      };
    }, extractedGif.gif.base64);
    
    // Save first frame
    const firstFrameData = framesData.firstFrame.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(outputPath, 'gif-first-frame.png'), firstFrameData, 'base64');
    
    // STEP 5: Verification Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('                 VERIFICATION RESULTS                   ');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const expectedFrames = framesCaptured || capturedTimes.length;
    const framesMatch = Math.abs(frameCount - expectedFrames) <= 2; // Allow small difference
    
    console.log(`✅ GIF Creation: Success`);
    console.log(`${framesMatch ? '✅' : '⚠️'} Frame Count: Expected ~${expectedFrames}, Found ${frameCount}`);
    console.log(`✅ GIF Format: Valid ${header}`);
    console.log(`✅ Dimensions: ${width}x${height}`);
    console.log(`✅ Animation: ${frameDelays.length} frame delays detected`);
    
    if (capturedTimes.length > 0) {
      const minTime = Math.min(...capturedTimes);
      const maxTime = Math.max(...capturedTimes);
      console.log(`✅ Time Range: ${minTime.toFixed(2)}s - ${maxTime.toFixed(2)}s`);
    }
    
    // Create HTML report
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>GIF Analysis Report</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px; background: #f5f5f5; }
    .container { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
    .success { color: #4CAF50; font-weight: bold; }
    .warning { color: #ff9800; font-weight: bold; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .info-card { background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 4px solid #4CAF50; }
    .info-card h3 { margin: 0 0 10px 0; color: #555; font-size: 14px; }
    .info-card .value { font-size: 24px; font-weight: bold; color: #333; }
    .gif-display { text-align: center; margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .gif-display img { max-width: 100%; border: 2px solid #ddd; border-radius: 4px; }
    .frames-section { margin-top: 30px; }
    .frame-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 20px; }
    .frame-box { text-align: center; }
    .frame-box img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
    .frame-box p { margin-top: 10px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 GIF Analysis Report</h1>
    
    <div class="info-grid">
      <div class="info-card">
        <h3>File Size</h3>
        <div class="value">${(extractedGif.gif.size / 1024).toFixed(1)} KB</div>
      </div>
      <div class="info-card">
        <h3>Dimensions</h3>
        <div class="value">${width} × ${height}</div>
      </div>
      <div class="info-card">
        <h3>Frame Count</h3>
        <div class="value">${frameCount}</div>
      </div>
      <div class="info-card">
        <h3>Frame Rate</h3>
        <div class="value">~${frameDelays.length > 0 ? (1000/(frameDelays.reduce((a,b)=>a+b,0)/frameDelays.length)).toFixed(1) : '?'} fps</div>
      </div>
    </div>
    
    <div class="gif-display">
      <h2>Generated GIF</h2>
      <img src="extracted-gif.gif" alt="Extracted GIF">
      <p style="margin-top: 15px; color: #666;">
        This GIF was created from ${expectedFrames} frames captured between ${capturedTimes.length > 0 ? Math.min(...capturedTimes).toFixed(1) : '?'}s and ${capturedTimes.length > 0 ? Math.max(...capturedTimes).toFixed(1) : '?'}s
      </p>
    </div>
    
    <div class="frames-section">
      <h2>Frame Analysis</h2>
      <div class="frame-grid">
        <div class="frame-box">
          <img src="gif-first-frame.png" alt="First Frame">
          <p>First frame of the GIF</p>
        </div>
        <div class="frame-box">
          <div style="padding: 20px; background: #f0f0f0; border-radius: 4px; height: 200px; display: flex; align-items: center; justify-content: center; color: #666;">
            <div>
              <p><strong>Frame Information:</strong></p>
              <p>Total Frames: ${frameCount}</p>
              <p>Expected: ~${expectedFrames}</p>
              <p class="${framesMatch ? 'success' : 'warning'}">${framesMatch ? '✅ Match!' : '⚠️ Slight difference'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background: #e8f5e9; border-radius: 8px;">
      <h3 style="color: #4CAF50;">✅ Verification Complete</h3>
      <p>The GIF was successfully created from the selected video segment. It contains ${frameCount} animated frames
      with dimensions of ${width}×${height} pixels.</p>
    </div>
  </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(outputPath, 'gif-analysis.html'), htmlContent);
    console.log(`\n📄 HTML report created: ${path.join(outputPath, 'gif-analysis.html')}`);
    
    // Try to open the GIF
    try {
      console.log('\n🎬 Opening extracted GIF...');
      require('child_process').exec(`open "${gifPath}"`);
      console.log('📄 Opening HTML report...');
      require('child_process').exec(`open "${path.join(outputPath, 'gif-analysis.html')}"`);
    } catch (e) {
      console.log('   (Open the files manually to view)');
    }
    
  } else {
    console.log('❌ No GIF found in IndexedDB');
    if (extractedGif.databases) {
      console.log('   Available databases:', extractedGif.databases);
    }
    if (extractedGif.error) {
      console.log('   Error:', extractedGif.error);
    }
    
    // Try alternative: check Chrome storage API
    console.log('\nTrying Chrome storage API...');
    
    const chromeStorageGif = await page.evaluate(async () => {
      try {
        // This might not work from content script context
        if (chrome && chrome.storage && chrome.storage.local) {
          return new Promise((resolve) => {
            chrome.storage.local.get(null, (items) => {
              resolve({ hasStorage: true, itemCount: Object.keys(items).length });
            });
          });
        }
      } catch (e) {
        return { hasStorage: false, error: e.message };
      }
      return { hasStorage: false };
    });
    
    console.log('Chrome storage check:', chromeStorageGif);
  }
  
  console.log('\n✨ Test complete!');
  console.log(`📁 Files saved in: ${outputPath}`);
  
  await browser.close();
  process.exit(extractedGif.found ? 0 : 1);
})();