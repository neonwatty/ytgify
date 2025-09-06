const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('Create and Download GIF', () => {
  test('Create a GIF and save it to downloads folder', async () => {
    test.setTimeout(180000); // 3 minutes

    console.log('=== Starting GIF Creation Test ===\n');
    
    // Set up downloads folder
    const downloadPath = path.join(__dirname, 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });
    console.log('Download folder:', downloadPath);

    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    console.log('Loading extension from:', pathToExtension);
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
      downloadsPath: downloadPath,
    });

    // Get extension ID
    let extensionId;
    try {
      await browser.waitForEvent('serviceworker', { timeout: 5000 });
      const pages = browser.pages();
      for (const p of pages) {
        const url = p.url();
        if (url.includes('chrome-extension://')) {
          extensionId = url.split('/')[2];
          console.log('Extension ID:', extensionId);
          break;
        }
      }
    } catch (e) {
      console.log('Could not get extension ID');
    }

    const page = await browser.newPage();
    
    // Navigate to a short YouTube video
    console.log('\n1. Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for video to load and start playing
    console.log('2. Waiting for video player...');
    await page.waitForSelector('video', { timeout: 15000 });
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.play();
        video.currentTime = 5; // Start at 5 seconds
      }
    });
    await page.waitForTimeout(3000);

    // Handle cookie dialog if present
    try {
      const cookieButton = await page.$('[aria-label*="Accept"], [aria-label*="Reject"]');
      if (cookieButton) {
        await cookieButton.click();
        console.log('   - Handled cookie dialog');
      }
    } catch (e) {}

    // Find and click GIF button
    console.log('3. Looking for GIF button...');
    let gifButton = await page.$('.ytgif-button, .ytp-button[aria-label*="GIF"], button[title*="Create GIF"]');
    
    if (!gifButton) {
      // Try looking in player controls specifically
      const controls = await page.$('.ytp-right-controls');
      if (controls) {
        gifButton = await controls.$('.ytgif-button');
      }
    }
    
    if (!gifButton) {
      throw new Error('GIF button not found');
    }
    
    console.log('4. Clicking GIF button...');
    await gifButton.click();
    await page.waitForTimeout(2000);

    // Wait for timeline overlay
    console.log('5. Waiting for timeline overlay...');
    await page.waitForFunction(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      return overlay && window.getComputedStyle(overlay).display !== 'none';
    }, { timeout: 10000 });

    // Get selection info
    const selectionInfo = await page.evaluate(() => {
      const duration = document.querySelector('.ytgif-timeline-duration');
      const range = document.querySelector('.ytgif-timeline-range');
      return {
        duration: duration?.textContent || 'Unknown',
        range: range?.textContent || 'Unknown'
      };
    });
    console.log('   - GIF Selection:', selectionInfo);

    // Click Create GIF
    console.log('6. Starting GIF creation...');
    const createButton = await page.$('.ytgif-timeline-create');
    if (!createButton) {
      throw new Error('Create GIF button not found');
    }
    await createButton.click();

    // Monitor progress for a bit
    console.log('7. Monitoring GIF creation progress...');
    let lastProgress = '';
    for (let i = 0; i < 20; i++) {
      const buttonText = await page.$eval('.ytgif-timeline-create', el => el.textContent).catch(() => null);
      if (buttonText && buttonText !== lastProgress && buttonText !== 'Create GIF') {
        console.log('   -', buttonText);
        lastProgress = buttonText;
      }
      
      // Check for completion
      const success = await page.$('.ytgif-feedback--success');
      if (success) {
        console.log('   - GIF creation completed!');
        break;
      }
      
      await page.waitForTimeout(1000);
    }

    // Wait a bit for the GIF to be saved
    await page.waitForTimeout(5000);

    // Now try to get the GIF from the extension
    console.log('\n8. Opening extension popup to download GIF...');
    if (extensionId) {
      const popupPage = await browser.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForTimeout(2000);

      // Switch to Library tab
      const libraryTab = await popupPage.$('button:has-text("Library"), [data-tab="library"]');
      if (libraryTab) {
        await libraryTab.click();
        console.log('   - Switched to Library tab');
        await popupPage.waitForTimeout(1500);
      }

      // Look for GIF cards
      const gifCards = await popupPage.$$('.gif-card, [class*="gif"], .library-item, article');
      console.log(`   - Found ${gifCards.length} items in library`);

      if (gifCards.length > 0) {
        // Try to download the first GIF
        const firstCard = gifCards[0];
        
        // Hover to show controls
        await firstCard.hover();
        await popupPage.waitForTimeout(500);
        
        // Look for any download-related button
        const downloadSelectors = [
          'button[aria-label*="Download"]',
          'button[title*="Download"]',
          'button:has-text("Download")',
          '[class*="download"]',
          'svg[class*="download"]',
          'button:has(svg)'
        ];
        
        let downloadButton = null;
        for (const selector of downloadSelectors) {
          downloadButton = await firstCard.$(selector);
          if (downloadButton) {
            console.log(`   - Found download button with selector: ${selector}`);
            break;
          }
        }

        if (downloadButton) {
          // Set up download monitoring
          const downloadPromise = popupPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
          
          await downloadButton.click();
          console.log('   - Clicked download button');
          
          const download = await downloadPromise;
          if (download) {
            const fileName = `youtube-gif-${Date.now()}.gif`;
            const savePath = path.join(downloadPath, fileName);
            await download.saveAs(savePath);
            console.log(`   - GIF saved as: ${fileName}`);
            
            // Verify the file
            const stats = await fs.stat(savePath);
            console.log(`   - File size: ${(stats.size / 1024).toFixed(2)} KB`);
            
            console.log('\n✅ SUCCESS! GIF has been created and saved to:');
            console.log(`   ${savePath}`);
          } else {
            console.log('   - Download did not trigger, trying alternative method...');
            
            // Try clicking the card itself
            await firstCard.click();
            await popupPage.waitForTimeout(1000);
            
            // Look for download in a modal/preview
            const modalDownload = await popupPage.$('button[aria-label*="Download"], button:has-text("Download")');
            if (modalDownload) {
              const download2 = await popupPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
              await modalDownload.click();
              
              if (download2) {
                const fileName = `youtube-gif-${Date.now()}.gif`;
                const savePath = path.join(downloadPath, fileName);
                await download2.saveAs(savePath);
                console.log(`   - GIF saved as: ${fileName}`);
                console.log('\n✅ SUCCESS! GIF has been created and saved to:');
                console.log(`   ${savePath}`);
              }
            }
          }
        } else {
          console.log('   - Could not find download button');
          
          // Take a screenshot of the popup for debugging
          await popupPage.screenshot({ 
            path: path.join(downloadPath, 'popup-library.png'),
            fullPage: true 
          });
          console.log('   - Screenshot saved: popup-library.png');
        }
        
        await popupPage.close();
      } else {
        console.log('   - No GIFs found in library');
        
        // Take screenshot for debugging
        await popupPage.screenshot({ 
          path: path.join(downloadPath, 'popup-empty.png'),
          fullPage: true 
        });
      }
    }

    // Take a final screenshot of the YouTube page
    await page.screenshot({ 
      path: path.join(downloadPath, 'youtube-final.png'),
      fullPage: false 
    });

    console.log('\n=== Test Complete ===');
    console.log(`Check the downloads folder: ${downloadPath}`);
    
    // Keep browser open for manual inspection if needed
    await page.waitForTimeout(5000);
    
    await browser.close();
  });
});