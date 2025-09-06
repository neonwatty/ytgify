const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Creating and downloading a completed GIF...');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Clean and create download directory
  if (fs.existsSync(downloadPath)) {
    fs.readdirSync(downloadPath).forEach(file => {
      fs.unlinkSync(path.join(downloadPath, file));
    });
  } else {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    viewport: { width: 1920, height: 1080 },
    downloadsPath: downloadPath
  });

  const page = await browser.newPage();
  
  // Monitor console for processing updates
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GIF') || text.includes('processing') || text.includes('complete')) {
      console.log(`[Console]: ${text}`);
    }
  });
  
  // Navigate to YouTube
  console.log('1. Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Start video
  console.log('2. Starting video at 5 seconds...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5; // Start at 5 seconds for interesting content
    }
  });
  await page.waitForTimeout(2000);
  
  // Click GIF button
  console.log('3. Clicking GIF button...');
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
  await gifButton.click();
  
  // Wait for overlay
  console.log('4. Waiting for timeline overlay...');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  console.log('   ✓ Timeline overlay appeared');
  
  // Click Create GIF
  console.log('5. Creating GIF...');
  const createButton = await page.waitForSelector('.ytgif-timeline-create', { timeout: 5000 });
  await createButton.click();
  console.log('   ✓ GIF creation started');
  
  // Wait for GIF processing to complete (max 2 minutes)
  console.log('6. Waiting for GIF to complete (max 2 minutes)...');
  const startTime = Date.now();
  
  // Method 1: Wait for overlay to disappear (indicates completion)
  const overlayGone = await page.waitForFunction(() => {
    return !document.querySelector('#ytgif-timeline-overlay');
  }, { timeout: 120000 }).then(() => true).catch(() => false);
  
  const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (overlayGone) {
    console.log(`   ✓ GIF creation completed in ${processingTime} seconds`);
  } else {
    console.log(`   ⚠️ Overlay still present after ${processingTime} seconds, checking library anyway...`);
  }
  
  // Wait a bit more for any async saves
  await page.waitForTimeout(3000);
  
  // Get extension ID - try multiple methods
  console.log('7. Finding extension ID...');
  let extensionId = await page.evaluate(() => {
    // Method 1: Check scripts
    const scripts = document.querySelectorAll('script[src*="chrome-extension://"]');
    if (scripts.length > 0) {
      const match = scripts[0].src.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) return match[1];
    }
    
    // Method 2: Check stylesheets
    const styles = document.querySelectorAll('link[href*="chrome-extension://"]');
    if (styles.length > 0) {
      const match = styles[0].href.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) return match[1];
    }
    
    // Method 3: Check for injected elements with data attributes
    const injected = document.querySelector('[data-extension-id]');
    if (injected) {
      return injected.getAttribute('data-extension-id');
    }
    
    return null;
  });
  
  // If not found, get it from chrome://extensions
  if (!extensionId) {
    console.log('   Getting extension ID from chrome://extensions...');
    const extPage = await browser.newPage();
    await extPage.goto('chrome://extensions/');
    await extPage.waitForTimeout(1000);
    
    // Look for our extension
    extensionId = await extPage.evaluate(() => {
      const cards = document.querySelectorAll('extensions-manager').length > 0 
        ? document.querySelector('extensions-manager').shadowRoot.querySelectorAll('extensions-item')
        : [];
      
      for (const card of cards) {
        const name = card.shadowRoot?.querySelector('#name')?.textContent;
        if (name && name.includes('YouTube GIF')) {
          const id = card.getAttribute('id');
          return id;
        }
      }
      return null;
    });
    
    await extPage.close();
  }
  
  if (!extensionId) {
    console.log('   ❌ Could not find extension ID');
    await browser.close();
    process.exit(1);
  }
  
  // Open extension popup
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const popupPage = await browser.newPage();
  await popupPage.goto(popupUrl);
  console.log('   ✓ Extension popup opened');
  
  // Click Library tab
  await popupPage.waitForTimeout(1000);
  const libraryTab = await popupPage.waitForSelector('button:has-text("Library")', { timeout: 5000 });
  if (libraryTab) {
    await libraryTab.click();
    console.log('   ✓ Switched to Library tab');
    await popupPage.waitForTimeout(2000);
  }
  
  // Check for GIFs in library
  console.log('8. Checking library for completed GIF...');
  const gifItems = await popupPage.$$eval('.gif-item, .gif-card, [data-testid="gif-item"], img[src^="blob:"]', elements => {
    return elements.map(el => ({
      tagName: el.tagName,
      src: el.src || el.querySelector('img')?.src || '',
      hasImage: !!el.querySelector('img') || el.tagName === 'IMG',
      classes: el.className
    }));
  });
  
  if (gifItems.length === 0) {
    console.log('   ❌ No GIFs found in library');
    
    // Try to check IndexedDB directly
    const dbCheck = await popupPage.evaluate(async () => {
      try {
        const dbs = await indexedDB.databases();
        return dbs.map(db => db.name);
      } catch {
        return [];
      }
    });
    console.log('   IndexedDB databases:', dbCheck);
    
    await browser.close();
    process.exit(1);
  }
  
  console.log(`   ✓ Found ${gifItems.length} GIF(s) in library`);
  
  // Try to download the first GIF
  console.log('9. Downloading GIF from library...');
  
  // Look for download button (try multiple selectors)
  const downloadButton = await popupPage.waitForSelector(
    'button:has-text("Download"), ' +
    'button[aria-label*="Download"], ' +
    '[data-testid="download-button"], ' +
    '.gif-item button svg, ' +
    '.download-btn',
    { timeout: 5000 }
  ).catch(() => null);
  
  if (!downloadButton) {
    console.log('   ❌ No download button found');
    
    // Try clicking on the GIF item itself
    const gifItem = await popupPage.$('.gif-item, .gif-card');
    if (gifItem) {
      console.log('   Trying to click GIF item directly...');
      await gifItem.click();
      await popupPage.waitForTimeout(1000);
      
      // Check for download button again
      const downloadAfterClick = await popupPage.$('button:has-text("Download")');
      if (downloadAfterClick) {
        await downloadAfterClick.click();
      }
    }
  } else {
    console.log('   ✓ Found download button, clicking...');
    await downloadButton.click();
  }
  
  // Wait for download
  await popupPage.waitForTimeout(5000);
  
  // Check downloads folder
  console.log('10. Checking downloads folder...');
  const downloads = fs.readdirSync(downloadPath);
  
  if (downloads.length === 0) {
    console.log('   ❌ No files downloaded');
    
    // Try alternative download method
    console.log('   Trying alternative download method...');
    const blob = await popupPage.evaluate(() => {
      const img = document.querySelector('img[src^="blob:"]');
      if (img && img.src) {
        return img.src;
      }
      return null;
    });
    
    if (blob) {
      console.log('   Found blob URL:', blob);
    }
  } else {
    console.log('   ✓ SUCCESS! GIF downloaded');
    console.log('\n📦 Downloaded files:');
    downloads.forEach(file => {
      const filePath = path.join(downloadPath, file);
      const stats = fs.statSync(filePath);
      console.log(`   - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
    });
    console.log(`\n📁 Location: ${downloadPath}`);
    
    // Verify it's a valid GIF
    const gifFile = downloads.find(f => f.endsWith('.gif'));
    if (gifFile) {
      const filePath = path.join(downloadPath, gifFile);
      const buffer = fs.readFileSync(filePath);
      const header = buffer.toString('hex', 0, 6);
      if (header === '474946383961' || header === '474946383761') {
        console.log('✅ File is a valid GIF (header verified)');
      } else {
        console.log('⚠️ File may not be a valid GIF');
      }
    }
  }
  
  console.log('\n✨ Test complete!');
  await browser.close();
  process.exit(downloads.length > 0 ? 0 : 1);
})();