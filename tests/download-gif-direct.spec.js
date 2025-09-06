const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== Direct GIF Creation and Download Test ===\n');
  
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
  
  const browserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    downloadsPath: downloadPath
  });

  const page = await browserContext.newPage();
  
  // Monitor console
  page.on('console', msg => {
    if (msg.text().includes('GIF') || msg.text().includes('saved') || msg.text().includes('complete')) {
      console.log(`[LOG]: ${msg.text()}`);
    }
  });
  
  // Monitor downloads
  page.on('download', async download => {
    const fileName = download.suggestedFilename();
    console.log(`\n📥 DOWNLOAD DETECTED: ${fileName}`);
    const filePath = path.join(downloadPath, fileName);
    await download.saveAs(filePath);
    console.log(`✅ Saved to: ${filePath}\n`);
  });

  // Step 1: Go to YouTube
  console.log('1. Opening YouTube video...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Step 2: Start video
  console.log('2. Starting video at 5 seconds...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
      return true;
    }
    return false;
  });
  await page.waitForTimeout(2000);
  
  // Step 3: Create GIF
  console.log('3. Clicking GIF button...');
  await page.click('.ytgif-button');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  console.log('   ✓ Overlay appeared');
  
  console.log('4. Creating GIF...');
  await page.click('.ytgif-timeline-create');
  console.log('   ✓ Creation started');
  
  // Step 4: Wait for completion with progress monitoring
  console.log('5. Waiting for GIF to complete (max 2 minutes)...\n');
  
  let lastProgress = 0;
  const checkProgress = setInterval(async () => {
    const progress = await page.evaluate(() => {
      const progressBar = document.querySelector('.ytgif-progress-bar');
      if (progressBar) {
        return progressBar.style.width;
      }
      return null;
    });
    
    if (progress && progress !== lastProgress) {
      console.log(`   Progress: ${progress}`);
      lastProgress = progress;
    }
  }, 2000);
  
  // Wait for completion
  const completed = await page.waitForFunction(
    () => !document.querySelector('#ytgif-timeline-overlay'),
    { timeout: 120000 }
  ).then(() => true).catch(() => false);
  
  clearInterval(checkProgress);
  
  if (completed) {
    console.log('\n   ✅ GIF creation completed!');
  } else {
    console.log('\n   ⚠️ Timeout waiting for completion');
  }
  
  await page.waitForTimeout(3000);
  
  // Step 5: Try to access the GIF directly through the extension's storage
  console.log('\n6. Checking if GIF was saved...');
  
  // Open a new tab to the extension's popup directly
  const pages = await browserContext.pages();
  
  // Find extension ID by checking loaded resources
  const extensionId = await page.evaluate(() => {
    // Check performance resources
    const resources = performance.getEntriesByType('resource');
    for (const resource of resources) {
      if (resource.name.includes('chrome-extension://')) {
        const match = resource.name.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) return match[1];
      }
    }
    
    // Check stylesheets
    for (const sheet of document.styleSheets) {
      if (sheet.href?.includes('chrome-extension://')) {
        const match = sheet.href.match(/chrome-extension:\/\/([^\/]+)/);
        if (match) return match[1];
      }
    }
    
    // Check scripts
    const scripts = document.querySelectorAll('script[src*="chrome-extension://"]');
    if (scripts.length > 0) {
      const match = scripts[0].src.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) return match[1];
    }
    
    return null;
  });
  
  if (extensionId) {
    console.log(`   Extension ID: ${extensionId}`);
    
    // Open popup
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const popupPage = await browserContext.newPage();
    await popupPage.goto(popupUrl);
    console.log(`   Opened popup: ${popupUrl}`);
    
    // Wait for popup to load
    await popupPage.waitForTimeout(2000);
    
    // Click Library tab
    try {
      await popupPage.click('button:has-text("Library")');
      console.log('   Switched to Library');
      await popupPage.waitForTimeout(2000);
    } catch (e) {
      console.log('   Library tab not found');
    }
    
    // Check for GIFs and get info
    const gifInfo = await popupPage.evaluate(() => {
      const gifs = document.querySelectorAll('.gif-item, .gif-card, [data-gif], img[src^="blob:"]');
      return {
        count: gifs.length,
        elements: Array.from(gifs).map(el => ({
          tag: el.tagName,
          classes: el.className,
          hasBlobSrc: el.src?.startsWith('blob:') || !!el.querySelector('img[src^="blob:"]')
        }))
      };
    });
    
    console.log(`\n7. Library contains ${gifInfo.count} GIF(s)`);
    
    if (gifInfo.count > 0) {
      console.log('   GIF details:', gifInfo.elements);
      
      // Try multiple download strategies
      console.log('\n8. Attempting to download GIF...');
      
      // Strategy 1: Click download button
      const downloaded = await popupPage.evaluate(() => {
        const downloadBtn = document.querySelector('button:has-text("Download"), [aria-label*="Download"]');
        if (downloadBtn) {
          downloadBtn.click();
          return true;
        }
        
        // Strategy 2: Click GIF item then download
        const gifItem = document.querySelector('.gif-item, .gif-card');
        if (gifItem) {
          gifItem.click();
          setTimeout(() => {
            const btn = document.querySelector('button:has-text("Download")');
            if (btn) btn.click();
          }, 500);
          return true;
        }
        
        return false;
      });
      
      if (downloaded) {
        console.log('   Triggered download');
        await popupPage.waitForTimeout(5000);
      }
      
      // Strategy 3: Direct blob download
      if (gifInfo.elements.some(e => e.hasBlobSrc)) {
        console.log('   Attempting direct blob download...');
        
        await popupPage.evaluate(() => {
          const img = document.querySelector('img[src^="blob:"]');
          if (img && img.src) {
            // Create a download link
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `gif-${Date.now()}.gif`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        });
        
        await popupPage.waitForTimeout(3000);
      }
    }
    
    await popupPage.close();
  } else {
    console.log('   ❌ Could not find extension ID');
  }
  
  // Final check
  console.log('\n9. Final check of downloads folder...');
  const downloads = fs.readdirSync(downloadPath);
  
  if (downloads.length > 0) {
    console.log('\n🎉 SUCCESS! Files downloaded:');
    downloads.forEach(file => {
      const stats = fs.statSync(path.join(downloadPath, file));
      console.log(`   • ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    console.log(`\n📂 Location: ${downloadPath}`);
  } else {
    console.log('   No files in download folder');
    console.log('\n💡 The GIF was likely created and saved to IndexedDB.');
    console.log('   You may need to manually download it from the extension popup.');
  }
  
  console.log('\n✅ Test complete - keeping browser open');
  await new Promise(() => {});
})();