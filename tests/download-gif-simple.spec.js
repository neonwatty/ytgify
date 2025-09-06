const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Creating and downloading a GIF ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Clean download directory
  if (fs.existsSync(downloadPath)) {
    fs.readdirSync(downloadPath).forEach(file => {
      fs.unlinkSync(path.join(downloadPath, file));
    });
  } else {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  
  console.log('📁 Downloads will be saved to:', downloadPath);
  
  const browserContext = await chromium.launchPersistentContext('', {
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

  // Handle downloads
  browserContext.on('page', page => {
    page.on('download', async download => {
      console.log('📥 Download started:', download.suggestedFilename());
      const filePath = path.join(downloadPath, download.suggestedFilename());
      await download.saveAs(filePath);
      console.log('✅ Download saved to:', filePath);
    });
  });

  const page = await browserContext.newPage();
  
  // Step 1: Navigate to YouTube
  console.log('\n1️⃣ Going to YouTube video...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Step 2: Start video
  console.log('2️⃣ Starting video playback...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
    }
  });
  await page.waitForTimeout(2000);
  
  // Step 3: Click GIF button
  console.log('3️⃣ Clicking GIF button...');
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
  await gifButton.click();
  
  // Step 4: Wait for overlay and create GIF
  console.log('4️⃣ Waiting for timeline overlay...');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  
  console.log('5️⃣ Clicking Create GIF button...');
  const createButton = await page.waitForSelector('.ytgif-timeline-create', { timeout: 5000 });
  await createButton.click();
  
  // Step 5: Wait for processing (max 2 minutes)
  console.log('6️⃣ Processing GIF (this may take up to 2 minutes)...');
  const startTime = Date.now();
  
  // Monitor for completion - overlay disappears when done
  await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 120000 }
  ).catch(() => console.log('⚠️  Processing taking longer than expected'));
  
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`   ✅ GIF created in ${processingTime} seconds`);
  
  // Wait for any async operations
  await page.waitForTimeout(3000);
  
  // Step 6: Open extension popup directly via action API
  console.log('\n7️⃣ Opening extension popup...');
  
  // Method 1: Try to find and click extension icon in toolbar
  // Note: This requires the extension to be pinned
  const extensionIcon = await page.locator('[aria-label*="YouTube GIF"]').first();
  if (await extensionIcon.isVisible()) {
    console.log('   Found extension icon, clicking...');
    await extensionIcon.click();
  } else {
    // Method 2: Open popup directly using chrome-extension URL
    // First, we need to find the extension ID
    const newPage = await browserContext.newPage();
    
    // Try to get extension ID from the content page
    const extensionResources = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      const extensionResource = resources.find(r => r.name.includes('chrome-extension://'));
      if (extensionResource) {
        const match = extensionResource.name.match(/chrome-extension:\/\/([^\/]+)/);
        return match ? match[1] : null;
      }
      
      // Also check for injected styles
      const styles = Array.from(document.styleSheets);
      for (const style of styles) {
        if (style.href && style.href.includes('chrome-extension://')) {
          const match = style.href.match(/chrome-extension:\/\/([^\/]+)/);
          if (match) return match[1];
        }
      }
      
      return null;
    });
    
    if (extensionResources) {
      const popupUrl = `chrome-extension://${extensionResources}/popup.html`;
      console.log('   Opening popup at:', popupUrl);
      await newPage.goto(popupUrl);
    } else {
      console.log('   ❌ Could not determine extension ID');
      console.log('   Please manually click the extension icon in the toolbar');
      await page.waitForTimeout(5000);
    }
  }
  
  // Wait for popup to load
  await page.waitForTimeout(2000);
  
  // Find the popup page
  const pages = browserContext.pages();
  const popupPage = pages.find(p => p.url().includes('popup.html')) || pages[pages.length - 1];
  
  // Step 7: Navigate to library and download
  console.log('8️⃣ Checking GIF library...');
  
  // Click Library tab
  const libraryTab = await popupPage.locator('button:has-text("Library")').first();
  if (await libraryTab.isVisible()) {
    await libraryTab.click();
    console.log('   Switched to Library tab');
    await popupPage.waitForTimeout(2000);
  }
  
  // Check for GIFs
  const gifCount = await popupPage.locator('.gif-item, .gif-card, img[src^="blob:"]').count();
  console.log(`   Found ${gifCount} GIF(s) in library`);
  
  if (gifCount > 0) {
    // Try to download the first GIF
    console.log('9️⃣ Downloading GIF...');
    
    // Look for download button
    const downloadBtn = await popupPage.locator('button:has-text("Download")').first();
    if (await downloadBtn.isVisible()) {
      await downloadBtn.click();
      console.log('   Clicked download button');
    } else {
      // Try clicking the GIF item first
      const gifItem = await popupPage.locator('.gif-item, .gif-card').first();
      if (await gifItem.isVisible()) {
        await gifItem.click();
        await popupPage.waitForTimeout(1000);
        
        // Now look for download button
        const downloadAfterClick = await popupPage.locator('button:has-text("Download")').first();
        if (await downloadAfterClick.isVisible()) {
          await downloadAfterClick.click();
          console.log('   Clicked download button after selecting GIF');
        }
      }
    }
    
    // Wait for download to complete
    await popupPage.waitForTimeout(5000);
  }
  
  // Step 8: Check downloads
  console.log('\n🔍 Checking downloads folder...');
  const downloads = fs.readdirSync(downloadPath);
  
  if (downloads.length > 0) {
    console.log('\n✅ SUCCESS! GIF downloaded successfully!\n');
    console.log('📦 Downloaded files:');
    downloads.forEach(file => {
      const filePath = path.join(downloadPath, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   • ${file} (${sizeKB} KB)`);
      
      // Verify GIF header
      if (file.endsWith('.gif')) {
        const buffer = fs.readFileSync(filePath);
        const header = buffer.toString('hex', 0, 6);
        if (header === '474946383961' || header === '474946383761') {
          console.log('     ✓ Valid GIF file (header verified)');
        }
      }
    });
    console.log(`\n📂 Location: ${downloadPath}`);
  } else {
    console.log('\n❌ No files were downloaded');
    console.log('   The GIF may have been created but not downloaded.');
    console.log('   Check the extension popup manually.');
  }
  
  console.log('\n✨ Test complete!');
  console.log('Browser will remain open for manual inspection.');
  console.log('Press Ctrl+C to exit...\n');
  
  // Keep browser open
  await new Promise(() => {});
})();