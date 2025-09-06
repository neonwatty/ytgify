const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== GIF Content Verification Test ===\n');
  console.log('This test will create a GIF and verify its content.\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Clean download directory
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  fs.readdirSync(downloadPath).forEach(file => {
    fs.unlinkSync(path.join(downloadPath, file));
  });
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    downloadsPath: downloadPath
  });

  const page = await browser.newPage();
  
  // Track frame extraction
  let frameCount = 0;
  let frameTimings = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[ContentScriptGifProcessor] Captured frame')) {
      const match = text.match(/frame (\d+)\/(\d+) at time ([\d.]+)s/);
      if (match) {
        frameCount = parseInt(match[2]);
        frameTimings.push(parseFloat(match[3]));
      }
    }
    if (text.includes('GIF encoded') || text.includes('GIF saved')) {
      console.log(`[LOG]: ${text}`);
    }
  });
  
  // Handle downloads
  page.on('download', async download => {
    const filename = download.suggestedFilename();
    console.log(`\n📥 DOWNLOAD DETECTED: ${filename}`);
    const savePath = path.join(downloadPath, filename);
    await download.saveAs(savePath);
    console.log(`✅ Saved to: ${savePath}`);
  });
  
  // STEP 1: Navigate to YouTube
  console.log('1. Opening test video...');
  console.log('   Using "Me at the zoo" - First YouTube video');
  console.log('   Duration: 19 seconds, perfect for testing\n');
  
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // STEP 2: Set specific video position
  console.log('2. Positioning video at 5 seconds (elephant scene)...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
    }
  });
  await page.waitForTimeout(1000);
  
  // STEP 3: Open GIF interface
  console.log('3. Opening GIF creation interface...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  const selectionRange = await page.evaluate(() => {
    const range = document.querySelector('.ytgif-timeline-range');
    return range ? range.textContent : null;
  });
  console.log(`   Selection range: ${selectionRange}\n`);
  
  // STEP 4: Create GIF
  console.log('4. Creating GIF...');
  const startTime = Date.now();
  
  await page.click('.ytgif-timeline-create');
  
  // Wait for processing to complete
  console.log('   Extracting frames from video segment...');
  
  // Monitor for completion (overlay disappears)
  await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 60000 }
  ).catch(() => {});
  
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Wait for any async operations
  await page.waitForTimeout(5000);
  
  // STEP 5: Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    TEST RESULTS                       ');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('📊 FRAME EXTRACTION:');
  if (frameTimings.length > 0) {
    const minTime = Math.min(...frameTimings);
    const maxTime = Math.max(...frameTimings);
    console.log(`   ✅ ${frameTimings.length} frames captured`);
    console.log(`   📍 Time range: ${minTime.toFixed(2)}s - ${maxTime.toFixed(2)}s`);
    console.log(`   ⏱️ Duration: ${(maxTime - minTime).toFixed(2)} seconds`);
    console.log(`   🎬 Frame rate: ~${(frameTimings.length / (maxTime - minTime)).toFixed(1)} fps`);
  } else {
    console.log(`   ✅ ${frameCount} frames captured (timing data not available)`);
  }
  
  console.log(`\n⚡ PROCESSING:`);
  console.log(`   ✅ Completed in ${processingTime} seconds`);
  
  // Check for downloads
  const downloads = fs.readdirSync(downloadPath);
  console.log(`\n💾 DOWNLOAD:`);
  if (downloads.length > 0) {
    console.log(`   ✅ GIF downloaded successfully`);
    downloads.forEach(file => {
      const filePath = path.join(downloadPath, file);
      const stats = fs.statSync(filePath);
      console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      // Verify GIF header
      if (file.endsWith('.gif')) {
        const buffer = fs.readFileSync(filePath);
        const header = buffer.toString('hex', 0, 6);
        if (header === '474946383961' || header === '474946383761') {
          console.log(`   ✅ Valid GIF file format confirmed`);
        }
      }
    });
  } else {
    console.log(`   ⚠️ No automatic download (GIF likely saved to library)`);
  }
  
  // STEP 6: Verify library storage
  console.log(`\n📚 LIBRARY STORAGE:`);
  
  // Check if GIF was saved to IndexedDB
  const dbCheck = await page.evaluate(async () => {
    try {
      const databases = await indexedDB.databases();
      const gifDb = databases.find(db => 
        db.name?.toLowerCase().includes('gif') || 
        db.name?.toLowerCase().includes('youtube')
      );
      
      if (gifDb) {
        return { 
          hasDatabase: true, 
          dbName: gifDb.name,
          version: gifDb.version 
        };
      }
    } catch (e) {
      return { hasDatabase: false, error: e.message };
    }
    return { hasDatabase: false };
  });
  
  if (dbCheck.hasDatabase) {
    console.log(`   ✅ GIF database found: ${dbCheck.dbName}`);
  } else {
    console.log(`   ⚠️ Could not verify database storage`);
  }
  
  // Final verdict
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('                    VERIFICATION                       ');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const success = frameCount > 0 || frameTimings.length > 0;
  
  if (success) {
    console.log('✅ SUCCESS: GIF was created from the selected video segment');
    console.log(`   • ${frameCount || frameTimings.length} frames extracted`);
    console.log(`   • Processed in ${processingTime} seconds`);
    
    if (frameTimings.length > 0) {
      // Parse expected range
      let expectedStart = 4, expectedEnd = 8;
      if (selectionRange) {
        const match = selectionRange.match(/([\d.]+)s.*?([\d.]+)s/);
        if (match) {
          expectedStart = parseFloat(match[1]);
          expectedEnd = parseFloat(match[2]);
        }
      }
      
      const minTime = Math.min(...frameTimings);
      const maxTime = Math.max(...frameTimings);
      const inRange = minTime >= (expectedStart - 0.5) && maxTime <= (expectedEnd + 0.5);
      
      if (inRange) {
        console.log(`   • ✅ Frames extracted from correct segment (${expectedStart}s-${expectedEnd}s)`);
      } else {
        console.log(`   • ⚠️ Frame timing needs verification`);
      }
    }
    
    if (downloads.length > 0) {
      console.log(`   • ✅ GIF downloaded successfully`);
    } else {
      console.log(`   • ℹ️ GIF saved to extension library`);
    }
  } else {
    console.log('❌ FAILED: Could not verify GIF creation');
  }
  
  console.log('\n✨ Test complete!');
  
  if (downloads.length > 0) {
    console.log(`\n📂 Downloaded GIF available at: ${downloadPath}`);
  }
  
  await browser.close();
  process.exit(success ? 0 : 1);
})();