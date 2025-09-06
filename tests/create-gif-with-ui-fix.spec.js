const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Starting GIF creation test with UI fix...');
  
  const extensionPath = path.join(process.cwd(), 'dist');
  const downloadPath = path.join(process.cwd(), 'tests', 'downloads');
  
  // Clean download directory
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
  }
  
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs'
    ],
    viewport: { width: 1920, height: 1080 },
    downloadsPath: downloadPath
  });

  const page = await browser.newPage();
  
  // Navigate to a short YouTube video
  console.log('Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
    waitUntil: 'domcontentloaded',
    timeout: 30000 
  });

  // Wait for video player to be ready
  await page.waitForTimeout(3000);
  
  // Start video playback
  console.log('Starting video playback...');
  const videoElement = await page.waitForSelector('video', { timeout: 10000 });
  await videoElement.evaluate(video => {
    video.play();
    video.currentTime = 5; // Start from 5 seconds
  });
  
  await page.waitForTimeout(2000);

  // Click the GIF button
  console.log('Looking for GIF button...');
  const gifButton = await page.waitForSelector('#ytgif-button, .ytgif-button, button[aria-label*="GIF"], button[title*="GIF"]', { 
    timeout: 10000 
  });
  
  if (gifButton) {
    console.log('Found GIF button, clicking it...');
    await gifButton.click();
    
    // Wait a moment for the overlay to appear
    await page.waitForTimeout(1000);
    
    // Check if timeline overlay is visible with our inline styles
    console.log('Checking for timeline overlay with inline styles...');
    const overlayVisible = await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay) {
        const styles = window.getComputedStyle(overlay);
        const rect = overlay.getBoundingClientRect();
        console.log('Overlay found:', {
          id: overlay.id,
          display: styles.display,
          visibility: styles.visibility,
          zIndex: styles.zIndex,
          position: styles.position,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          },
          hasInlineStyles: overlay.style.cssText.includes('2147483647')
        });
        return styles.display !== 'none' && styles.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }
      console.log('No overlay found in DOM');
      return false;
    });
    
    if (overlayVisible) {
      console.log('✓ Timeline overlay is VISIBLE! UI fix successful!');
      
      // Try to interact with the timeline overlay
      console.log('Looking for Create GIF button in overlay...');
      
      // Look for the Create GIF button in the React component
      const createButton = await page.waitForSelector('.ytgif-timeline-create, button:has-text("Create GIF")', { 
        timeout: 5000 
      }).catch(() => null);
      
      if (createButton) {
        console.log('Found Create GIF button, clicking to start creation...');
        await createButton.click();
        
        // Wait for GIF creation to complete
        console.log('Waiting for GIF to be created...');
        await page.waitForTimeout(10000); // Wait up to 10 seconds for processing
        
        // Check if GIF was created and is in the library
        const extensionId = await page.evaluate(() => {
          // Try to find the extension ID from any extension resources
          const scripts = document.querySelectorAll('script[src*="chrome-extension://"]');
          if (scripts.length > 0) {
            const src = scripts[0].src;
            const match = src.match(/chrome-extension:\/\/([^\/]+)/);
            return match ? match[1] : null;
          }
          return null;
        });
        
        if (extensionId) {
          console.log(`Extension ID: ${extensionId}`);
          
          // Open the extension popup to check library
          const popupUrl = `chrome-extension://${extensionId}/popup.html`;
          const popupPage = await browser.newPage();
          await popupPage.goto(popupUrl);
          
          console.log('Opened extension popup, checking library...');
          await popupPage.waitForTimeout(2000);
          
          // Click on Library tab if needed
          const libraryTab = await popupPage.$('button:has-text("Library")');
          if (libraryTab) {
            await libraryTab.click();
            await popupPage.waitForTimeout(1000);
          }
          
          // Check for GIFs in the library
          const gifCount = await popupPage.evaluate(() => {
            const gifItems = document.querySelectorAll('.gif-item, [data-gif], img[src^="blob:"]');
            return gifItems.length;
          });
          
          console.log(`Found ${gifCount} GIF(s) in library`);
          
          if (gifCount > 0) {
            console.log('✓ GIF successfully created and stored in library!');
            
            // Try to download the first GIF
            const downloadButton = await popupPage.$('.gif-item button:has-text("Download"), [aria-label*="Download"]');
            if (downloadButton) {
              console.log('Downloading GIF...');
              await downloadButton.click();
              await popupPage.waitForTimeout(2000);
              
              // Check downloads folder
              const downloads = fs.readdirSync(downloadPath);
              const gifFiles = downloads.filter(f => f.endsWith('.gif'));
              
              if (gifFiles.length > 0) {
                console.log(`✓ GIF successfully downloaded: ${gifFiles[0]}`);
                console.log(`  Location: ${path.join(downloadPath, gifFiles[0])}`);
              }
            }
          }
          
          await popupPage.close();
        }
      } else {
        console.log('Could not find Create GIF button in overlay');
      }
    } else {
      console.log('✗ Timeline overlay is NOT visible - UI fix may need adjustment');
      
      // Log what's in the DOM for debugging
      const domInfo = await page.evaluate(() => {
        const overlay = document.querySelector('#ytgif-timeline-overlay');
        return {
          overlayExists: !!overlay,
          overlayHTML: overlay ? overlay.outerHTML.substring(0, 200) : null,
          bodyChildren: document.body.children.length,
          highZIndexElements: Array.from(document.querySelectorAll('*')).filter(el => {
            const z = window.getComputedStyle(el).zIndex;
            return z !== 'auto' && parseInt(z) > 10000;
          }).map(el => ({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            zIndex: window.getComputedStyle(el).zIndex
          }))
        };
      });
      console.log('DOM debugging info:', JSON.stringify(domInfo, null, 2));
    }
  } else {
    console.log('GIF button not found in player controls');
  }

  // Keep browser open for manual inspection
  console.log('\nTest complete. Browser will remain open for inspection.');
  console.log('Press Ctrl+C to exit...');
  
  // Keep the script running
  await new Promise(() => {});
})();