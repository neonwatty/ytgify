const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Testing Proper GIF Creation with Frame Extraction ===\n');
  
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
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs'
    ],
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    downloadsPath: downloadPath
  });

  const page = await browser.newPage();
  
  // Monitor console for frame capture logs
  let framesCaptured = 0;
  let framesEncoded = 0;
  let gifSize = 0;
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Capturing frames')) {
      const match = text.match(/frameCount: (\d+)/);
      if (match) framesCaptured = parseInt(match[1]);
      console.log(`[FRAME CAPTURE]: ${text}`);
    }
    if (text.includes('Captured frame')) {
      console.log(`[FRAME]: ${text}`);
    }
    if (text.includes('Added frame') || text.includes('to encoder')) {
      framesEncoded++;
      console.log(`[ENCODE]: ${text}`);
    }
    if (text.includes('GIF encoded') || text.includes('GIF created')) {
      const match = text.match(/size: (\d+)/);
      if (match) gifSize = parseInt(match[1]);
      console.log(`[COMPLETE]: ${text}`);
    }
    if (text.includes('Processing') || text.includes('progress')) {
      console.log(`[PROGRESS]: ${text}`);
    }
  });
  
  // Handle downloads
  page.on('download', async download => {
    const filename = download.suggestedFilename();
    console.log(`\n📥 DOWNLOAD TRIGGERED: ${filename}`);
    const savePath = path.join(downloadPath, filename);
    await download.saveAs(savePath);
    console.log(`✅ Saved to: ${savePath}`);
    
    // Verify it's a real GIF
    const stats = fs.statSync(savePath);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    const buffer = fs.readFileSync(savePath);
    const header = buffer.toString('hex', 0, 6);
    if (header === '474946383961' || header === '474946383761') {
      console.log('   ✅ Valid GIF header detected');
    }
  });

  // STEP 1: Navigate to YouTube
  console.log('1. Opening YouTube video...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // STEP 2: Prepare video
  console.log('2. Setting video to specific time...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5; // Start at 5 seconds where there's action
      video.play();
      return { duration: video.duration, currentTime: video.currentTime };
    }
  });
  await page.waitForTimeout(2000);
  
  // STEP 3: Click GIF button
  console.log('3. Activating GIF mode...');
  await page.click('.ytgif-button');
  
  // Wait for overlay
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  console.log('   ✓ Timeline overlay appeared');
  
  // STEP 4: Check current selection
  const selection = await page.evaluate(() => {
    const startInput = document.querySelector('#gif-start');
    const endInput = document.querySelector('#gif-end');
    if (startInput && endInput) {
      return {
        start: startInput.value,
        end: endInput.value
      };
    }
    // If no inputs, check for displayed time range
    const rangeText = document.querySelector('.ytgif-timeline-range');
    return { rangeText: rangeText?.textContent };
  });
  console.log('   Selection:', selection);
  
  // STEP 5: Create GIF
  console.log('\n4. Creating GIF (monitoring frame extraction)...\n');
  await page.click('.ytgif-timeline-create');
  
  // Monitor for completion
  const startTime = Date.now();
  
  // Wait for overlay to disappear (completion)
  try {
    await page.waitForFunction(
      () => !document.querySelector('#ytgif-timeline-overlay'),
      { timeout: 60000 }
    );
  } catch (e) {
    console.log('⚠️ Timeout waiting for completion');
  }
  
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Wait for any final operations
  await page.waitForTimeout(5000);
  
  // STEP 6: Summary
  console.log('\n=== PROCESSING SUMMARY ===');
  console.log(`⏱️ Processing time: ${processingTime} seconds`);
  console.log(`📸 Frames to capture: ${framesCaptured || 'unknown'}`);
  console.log(`🎬 Frames encoded: ${framesEncoded || 'unknown'}`);
  console.log(`📦 GIF size: ${gifSize ? (gifSize / 1024).toFixed(2) + ' KB' : 'unknown'}`);
  
  // Check downloads
  const downloads = fs.readdirSync(downloadPath);
  if (downloads.length > 0) {
    console.log(`\n✅ SUCCESS! GIF downloaded automatically`);
    downloads.forEach(file => {
      const filePath = path.join(downloadPath, file);
      const stats = fs.statSync(filePath);
      console.log(`   📄 ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
      
      // Analyze GIF structure
      const buffer = fs.readFileSync(filePath);
      let frameCount = 0;
      let pos = 0;
      
      // Count image blocks in GIF (simplified)
      while (pos < buffer.length - 1) {
        if (buffer[pos] === 0x21 && buffer[pos + 1] === 0xF9) {
          frameCount++;
        }
        pos++;
      }
      
      console.log(`   🎞️ Estimated frames in GIF: ${frameCount}`);
    });
  } else {
    console.log('\n⚠️ No automatic download occurred');
    console.log('The GIF may be saved in the extension library.');
  }
  
  console.log('\n✨ Test complete!');
  console.log('Check the console output above to verify frame extraction worked correctly.');
  console.log('\nKeeping browser open for manual inspection...');
  await new Promise(() => {});
})();