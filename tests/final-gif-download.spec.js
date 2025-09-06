const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Final GIF Download Test ===\n');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Setup download directory
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
  
  // STEP 1: Navigate and prepare video
  console.log('Step 1: Opening YouTube video...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
    }
  });
  await page.waitForTimeout(2000);
  
  // STEP 2: Create GIF
  console.log('Step 2: Creating GIF...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay');
  await page.click('.ytgif-timeline-create');
  
  // STEP 3: Wait for completion (monitor progress)
  console.log('Step 3: Processing GIF (up to 2 minutes)...');
  const startTime = Date.now();
  
  // Wait until overlay disappears
  try {
    await page.waitForFunction(
      () => !document.querySelector('#ytgif-timeline-overlay'),
      { timeout: 120000 }
    );
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ GIF created in ${duration} seconds`);
  } catch (e) {
    console.log('⚠️ Timeout waiting for GIF completion');
  }
  
  // Extra wait for save operations
  await page.waitForTimeout(5000);
  
  // STEP 4: Access the popup
  console.log('\nStep 4: Accessing extension popup...');
  
  // Get all pages and find the extension
  const allPages = browser.pages();
  
  // Try to find extension ID from the content page
  const extId = await page.evaluate(() => {
    // Check all loaded resources
    const allResources = [
      ...Array.from(document.querySelectorAll('link[href*="chrome-extension://"]')),
      ...Array.from(document.querySelectorAll('script[src*="chrome-extension://"]'))
    ];
    
    for (const resource of allResources) {
      const url = resource.href || resource.src;
      const match = url.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) return match[1];
    }
    
    // Check stylesheets
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.href?.includes('chrome-extension://')) {
          const match = sheet.href.match(/chrome-extension:\/\/([a-z]+)/);
          if (match) return match[1];
        }
      } catch {}
    }
    
    return null;
  });
  
  let popupPage;
  
  if (extId) {
    console.log(`Extension ID found: ${extId}`);
    popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extId}/popup.html`);
  } else {
    // Fallback: Try to click extension icon (requires manual pin)
    console.log('Trying to find extension in toolbar...');
    
    // Open a new tab to extensions page to get ID
    const extPage = await browser.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.waitForTimeout(2000);
    
    // Note: Can't access shadow DOM easily, so just open popup manually
    console.log('Opening popup manually...');
    
    // Create a simple page that lists all open tabs
    const pages = browser.pages();
    for (const p of pages) {
      if (p.url().includes('popup.html')) {
        popupPage = p;
        break;
      }
    }
    
    if (!popupPage) {
      // Last resort - hardcode common extension ID pattern or ask user
      console.log('\n⚠️ Could not find popup automatically.');
      console.log('Please manually click the extension icon in the toolbar.');
      await page.waitForTimeout(10000);
      
      // Check again for popup
      const pages2 = browser.pages();
      popupPage = pages2.find(p => p.url().includes('popup.html'));
    }
  }
  
  if (!popupPage) {
    console.log('❌ Could not access popup');
    await browser.close();
    process.exit(1);
  }
  
  console.log('✅ Popup accessed');
  await popupPage.waitForTimeout(2000);
  
  // STEP 5: Navigate to Library
  console.log('\nStep 5: Checking library...');
  
  // Click Library tab
  const libraryBtn = popupPage.locator('button:has-text("Library")');
  if (await libraryBtn.count() > 0) {
    await libraryBtn.click();
    console.log('Switched to Library tab');
    await popupPage.waitForTimeout(2000);
  }
  
  // STEP 6: Download GIF
  console.log('\nStep 6: Looking for GIF in library...');
  
  // Check if there are any GIFs
  const gifCards = await popupPage.locator('.gif-card, .gif-item').count();
  console.log(`Found ${gifCards} GIF(s) in library`);
  
  if (gifCards > 0) {
    // Look for download button (with emoji)
    const downloadBtn = popupPage.locator('button:has-text("⬇️")').first();
    
    if (await downloadBtn.count() > 0) {
      console.log('Found download button, clicking...');
      
      // Set up download listener
      const downloadPromise = popupPage.waitForEvent('download', { timeout: 10000 });
      
      await downloadBtn.click();
      
      try {
        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename();
        const savePath = path.join(downloadPath, suggestedFilename);
        
        console.log(`Downloading: ${suggestedFilename}`);
        await download.saveAs(savePath);
        console.log(`✅ Saved to: ${savePath}`);
        
        // Verify file
        if (fs.existsSync(savePath)) {
          const stats = fs.statSync(savePath);
          console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
          
          // Check GIF header
          const buffer = fs.readFileSync(savePath);
          const header = buffer.toString('hex', 0, 6);
          if (header === '474946383961' || header === '474946383761') {
            console.log('✅ Valid GIF file confirmed!');
          }
        }
      } catch (e) {
        console.log('Download event not triggered, checking folder anyway...');
      }
    } else {
      console.log('Download button not found, trying alternative methods...');
      
      // Try clicking the GIF card first
      const gifCard = popupPage.locator('.gif-card, .gif-item').first();
      await gifCard.click();
      await popupPage.waitForTimeout(1000);
      
      // Look for download again
      const altDownloadBtn = popupPage.locator('button:has-text("Download"), button:has-text("⬇️")').first();
      if (await altDownloadBtn.count() > 0) {
        await altDownloadBtn.click();
        await popupPage.waitForTimeout(3000);
      }
    }
  }
  
  // STEP 7: Final check
  await popupPage.waitForTimeout(3000);
  
  console.log('\n=== FINAL RESULTS ===');
  const downloads = fs.readdirSync(downloadPath);
  
  if (downloads.length > 0) {
    console.log('✅ SUCCESS! Downloaded files:');
    downloads.forEach(file => {
      const stats = fs.statSync(path.join(downloadPath, file));
      console.log(`  📄 ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    console.log(`\n📂 Files saved in: ${downloadPath}`);
    
    await browser.close();
    process.exit(0);
  } else {
    console.log('❌ No files downloaded');
    console.log('The GIF was created but download failed.');
    console.log('\nKeeping browser open for manual inspection...');
    await new Promise(() => {});
  }
})();