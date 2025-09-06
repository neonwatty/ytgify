const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Creating and downloading a real GIF...');
  
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
  
  // Navigate to YouTube
  console.log('Going to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(3000);
  
  // Start video
  console.log('Starting video...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5; // Start at 5 seconds
    }
  });
  await page.waitForTimeout(2000);
  
  // Click GIF button
  console.log('Clicking GIF button...');
  const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 5000 });
  await gifButton.click();
  
  // Wait for overlay to appear
  console.log('Waiting for timeline overlay...');
  await page.waitForSelector('#ytgif-timeline-overlay', { timeout: 5000 });
  console.log('✓ Timeline overlay appeared!');
  
  // Check if Create GIF button is visible
  console.log('Looking for Create GIF button...');
  const createButton = await page.waitForSelector('.ytgif-timeline-create, button:has-text("Create GIF")', { 
    timeout: 5000 
  }).catch(() => null);
  
  if (createButton) {
    console.log('✓ Found Create GIF button');
    
    // Click to create GIF
    console.log('Creating GIF (3 second segment)...');
    await createButton.click();
    
    // Wait for GIF creation to complete
    console.log('Waiting for GIF to be created (this may take 10-15 seconds)...');
    
    // Wait for the overlay to disappear (indicates completion)
    await page.waitForFunction(() => {
      return !document.querySelector('#ytgif-timeline-overlay');
    }, { timeout: 30000 }).catch(() => {
      console.log('Overlay still present after 30 seconds');
    });
    
    // Check if a download happened automatically
    await page.waitForTimeout(2000);
    const downloads = fs.readdirSync(downloadPath);
    if (downloads.length > 0) {
      console.log('✓ GIF downloaded automatically:', downloads);
    } else {
      console.log('No automatic download. Checking library...');
      
      // Get extension ID
      const extensionId = await page.evaluate(() => {
        const scripts = document.querySelectorAll('script[src*="chrome-extension://"]');
        if (scripts.length > 0) {
          const match = scripts[0].src.match(/chrome-extension:\/\/([^\/]+)/);
          return match ? match[1] : null;
        }
        return null;
      });
      
      if (extensionId) {
        // Open extension popup
        const popupUrl = `chrome-extension://${extensionId}/popup.html`;
        const popupPage = await browser.newPage();
        await popupPage.goto(popupUrl);
        console.log('Opened extension popup');
        
        // Click Library tab
        await popupPage.waitForTimeout(1000);
        const libraryTab = await popupPage.$('button:has-text("Library")');
        if (libraryTab) {
          await libraryTab.click();
          await popupPage.waitForTimeout(1000);
        }
        
        // Check for GIFs
        const gifCount = await popupPage.evaluate(() => {
          const items = document.querySelectorAll('.gif-item, .gif-card, [data-gif], img[src^="blob:"]');
          return items.length;
        });
        
        if (gifCount > 0) {
          console.log(`✓ Found ${gifCount} GIF(s) in library`);
          
          // Try to download the first GIF
          const downloadBtn = await popupPage.$('button:has-text("Download"), button[aria-label*="Download"]');
          if (downloadBtn) {
            console.log('Downloading GIF from library...');
            await downloadBtn.click();
            await popupPage.waitForTimeout(3000);
            
            // Check downloads again
            const finalDownloads = fs.readdirSync(downloadPath);
            if (finalDownloads.length > 0) {
              console.log('✓ GIF successfully downloaded!');
              console.log('  Files:', finalDownloads);
              console.log('  Location:', downloadPath);
              
              // Check file size
              const gifFile = finalDownloads.find(f => f.endsWith('.gif'));
              if (gifFile) {
                const stats = fs.statSync(path.join(downloadPath, gifFile));
                console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
              }
            } else {
              console.log('❌ Download button clicked but no file saved');
            }
          } else {
            console.log('No download button found in library');
          }
        } else {
          console.log('❌ No GIFs found in library');
        }
        
        await popupPage.close();
      }
    }
  } else {
    console.log('❌ Create GIF button not found in overlay');
  }
  
  console.log('\nTest complete!');
  await browser.close();
  process.exit(0);
})();