const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

test.describe('Generate and Download GIF to Desktop', () => {
  test('Create a GIF and save it to Desktop', async () => {
    test.setTimeout(240000); // 4 minutes - longer timeout for real-time capture

    console.log('=== Starting GIF Generation to Desktop ===\n');
    
    // Use Desktop as download folder
    const desktopPath = path.join(os.homedir(), 'Desktop');
    console.log('Desktop path:', desktopPath);

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
      downloadsPath: desktopPath,
    });

    // Get extension ID
    let extensionId;
    try {
      // First try: Wait for service worker
      const serviceWorker = await browser.waitForEvent('serviceworker', { timeout: 10000 });
      console.log('Service worker loaded');
      
      // Try getting the service worker URL
      if (serviceWorker && serviceWorker.url) {
        const match = serviceWorker.url().match(/chrome-extension:\/\/([^\/]+)/);
        if (match) {
          extensionId = match[1];
          console.log('Extension ID from service worker:', extensionId);
        }
      }
      
      // Second try: Check all pages
      if (!extensionId) {
        const pages = browser.pages();
        for (const p of pages) {
          const url = p.url();
          if (url.includes('chrome-extension://')) {
            extensionId = url.split('/')[2];
            console.log('Extension ID from pages:', extensionId);
            break;
          }
        }
      }
      
      // Third try: Open a new tab to extension
      if (!extensionId) {
        // Try opening the extension's popup directly
        const testPage = await browser.newPage();
        // This will fail but we can get the ID from the error
        try {
          await testPage.goto('chrome-extension://invalid/popup.html', { timeout: 2000 });
        } catch (e) {
          // Error might contain hints
        }
        
        // Check browser pages again
        const allPages = await browser.pages();
        for (const p of allPages) {
          const url = await p.url();
          const match = url.match(/chrome-extension:\/\/([^\/]+)/);
          if (match) {
            extensionId = match[1];
            console.log('Extension ID from new page:', extensionId);
            break;
          }
        }
        await testPage.close();
      }
    } catch (e) {
      console.log('Error getting extension ID:', e.message);
    }

    const page = await browser.newPage();
    
    // Navigate to a short YouTube video (Me at the zoo - first YouTube video)
    console.log('\n1. Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for video to load
    console.log('2. Waiting for video player to load...');
    await page.waitForSelector('video', { timeout: 15000 });
    
    // Set video time and ensure it's playing
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5; // Start at 5 seconds for interesting content
        video.play();
        console.log('Video playing from 5 seconds');
      }
    });
    
    // Wait for video to stabilize
    await page.waitForTimeout(3000);

    // Handle cookie dialog if present
    try {
      const cookieButton = await page.$('[aria-label*="Accept"], [aria-label*="Reject"], button:has-text("Accept"), button:has-text("Reject")');
      if (cookieButton) {
        await cookieButton.click();
        console.log('   - Handled cookie dialog');
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Cookie dialog not present or already handled
    }

    // Find and click GIF button
    console.log('3. Looking for GIF button...');
    
    // Try multiple selectors for the GIF button
    const gifButtonSelectors = [
      '.ytgif-button',
      '.ytp-button[aria-label*="GIF"]',
      'button[title*="Create GIF"]',
      '.ytp-right-controls .ytgif-button',
      '.ytp-right-controls button[aria-label*="GIF"]'
    ];
    
    let gifButton = null;
    for (const selector of gifButtonSelectors) {
      gifButton = await page.$(selector);
      if (gifButton) {
        console.log(`   - Found GIF button with selector: ${selector}`);
        break;
      }
    }
    
    if (!gifButton) {
      // Take screenshot for debugging
      await page.screenshot({ 
        path: path.join(desktopPath, 'youtube-no-gif-button.png'),
        fullPage: false 
      });
      throw new Error('GIF button not found - screenshot saved to Desktop');
    }
    
    console.log('4. Clicking GIF button...');
    await gifButton.click();
    await page.waitForTimeout(2000);

    // Wait for timeline overlay to appear
    console.log('5. Waiting for timeline overlay...');
    try {
      await page.waitForFunction(() => {
        const overlay = document.querySelector('#ytgif-timeline-overlay');
        return overlay && window.getComputedStyle(overlay).display !== 'none';
      }, { timeout: 10000 });
    } catch (e) {
      await page.screenshot({ 
        path: path.join(desktopPath, 'youtube-no-timeline.png'),
        fullPage: false 
      });
      throw new Error('Timeline overlay did not appear - screenshot saved to Desktop');
    }

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

    // Click Create GIF button
    console.log('6. Starting GIF creation...');
    const createButton = await page.$('.ytgif-timeline-create');
    if (!createButton) {
      throw new Error('Create GIF button not found');
    }
    await createButton.click();

    // Monitor progress with longer timeout for real-time capture
    console.log('7. Monitoring GIF creation progress (this may take 10-30 seconds)...');
    let lastProgress = '';
    let creationComplete = false;
    
    for (let i = 0; i < 60; i++) { // Check for up to 60 seconds
      // Check button text for progress
      const buttonText = await page.$eval('.ytgif-timeline-create', el => el.textContent).catch(() => null);
      if (buttonText && buttonText !== lastProgress) {
        console.log('   -', buttonText);
        lastProgress = buttonText;
      }
      
      // Check for success feedback
      const successElement = await page.$('.ytgif-feedback--success');
      if (successElement) {
        const successText = await successElement.textContent().catch(() => '');
        console.log('   - ✅', successText || 'GIF creation completed!');
        creationComplete = true;
        break;
      }
      
      // Check for error
      const errorElement = await page.$('.ytgif-feedback--error');
      if (errorElement) {
        const errorText = await errorElement.textContent().catch(() => '');
        console.log('   - ❌ Error:', errorText);
        break;
      }
      
      await page.waitForTimeout(1000);
    }

    if (!creationComplete) {
      console.log('   - Warning: GIF creation may not have completed fully');
    }

    // Wait for GIF to be saved to storage
    console.log('8. Waiting for GIF to be saved...');
    await page.waitForTimeout(3000);

    // Open extension popup to access the GIF
    console.log('\n9. Opening extension popup to download GIF...');
    
    if (!extensionId) {
      // Try to get extension ID by going to chrome://extensions
      console.log('   - Trying to get extension ID from chrome://extensions...');
      const extPage = await browser.newPage();
      await extPage.goto('chrome://extensions/', { waitUntil: 'domcontentloaded' });
      await extPage.waitForTimeout(1000);
      
      // Try to find extension ID in the page
      const extensionInfo = await extPage.evaluate(() => {
        const extensions = document.querySelectorAll('extensions-item');
        for (const ext of extensions) {
          const name = ext.shadowRoot?.querySelector('#name')?.textContent;
          if (name && name.includes('YouTube GIF')) {
            const id = ext.getAttribute('id');
            return { id, name };
          }
        }
        return null;
      }).catch(() => null);
      
      if (extensionInfo?.id) {
        extensionId = extensionInfo.id;
        console.log('   - Found extension ID from chrome://extensions:', extensionId);
      }
      await extPage.close();
    }
    
    if (extensionId) {
      const popupPage = await browser.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForTimeout(2000);

      // Switch to Library tab
      console.log('10. Switching to Library tab...');
      const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library"), .tab-button:has-text("Library")');
      if (libraryTab) {
        await libraryTab.click();
        console.log('   - Switched to Library tab');
        await popupPage.waitForTimeout(1500);
      } else {
        console.log('   - Library tab not found, checking if already in library view');
      }

      // Look for GIF cards
      const gifCardSelectors = [
        '.gif-card',
        '[class*="gif-item"]',
        '.library-item',
        'article',
        '[role="article"]',
        '.gif-thumbnail'
      ];
      
      let gifCards = [];
      for (const selector of gifCardSelectors) {
        gifCards = await popupPage.$$(selector);
        if (gifCards.length > 0) {
          console.log(`   - Found ${gifCards.length} GIFs using selector: ${selector}`);
          break;
        }
      }

      if (gifCards.length > 0) {
        console.log('11. Downloading the first GIF...');
        const firstCard = gifCards[0];
        
        // Hover over the card to show controls
        await firstCard.hover();
        await popupPage.waitForTimeout(500);
        
        // Look for download button
        const downloadSelectors = [
          'button[aria-label*="Download"]',
          'button[title*="Download"]',
          'button:has-text("Download")',
          '[class*="download"]',
          'button:has(svg[class*="download"])',
          'button:has(svg path[d*="M12"])', // Common download icon path
        ];
        
        let downloadButton = null;
        for (const selector of downloadSelectors) {
          // Try within the card first
          downloadButton = await firstCard.$(selector);
          if (!downloadButton) {
            // Try in the whole page
            downloadButton = await popupPage.$(selector);
          }
          if (downloadButton) {
            console.log(`   - Found download button with selector: ${selector}`);
            break;
          }
        }

        if (downloadButton) {
          // Set up download promise
          const downloadPromise = popupPage.waitForEvent('download', { timeout: 10000 });
          
          // Click download button
          await downloadButton.click();
          console.log('   - Clicked download button');
          
          try {
            const download = await downloadPromise;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const fileName = `youtube-gif-${timestamp}.gif`;
            const savePath = path.join(desktopPath, fileName);
            
            await download.saveAs(savePath);
            console.log(`   - GIF saved as: ${fileName}`);
            
            // Verify the file exists and get its size
            const stats = await fs.stat(savePath);
            console.log(`   - File size: ${(stats.size / 1024).toFixed(2)} KB`);
            
            console.log('\n✅ SUCCESS! GIF has been saved to your Desktop!');
            console.log(`   Full path: ${savePath}`);
            console.log('\n🎉 You can now check your Desktop for the GIF file!');
            
          } catch (downloadError) {
            console.log('   - Download did not trigger, trying alternative method...');
            
            // Alternative: Click the card itself to open preview
            await firstCard.click();
            await popupPage.waitForTimeout(1000);
            
            // Look for download in modal/preview
            const modalDownload = await popupPage.$('button[aria-label*="Download"], button:has-text("Download"), .modal button:has(svg)');
            if (modalDownload) {
              const download2 = await popupPage.waitForEvent('download', { timeout: 5000 });
              await modalDownload.click();
              
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
              const fileName = `youtube-gif-${timestamp}.gif`;
              const savePath = path.join(desktopPath, fileName);
              await download2.saveAs(savePath);
              
              console.log(`   - GIF saved as: ${fileName}`);
              console.log('\n✅ SUCCESS! GIF has been saved to your Desktop!');
              console.log(`   Full path: ${savePath}`);
            }
          }
        } else {
          console.log('   - Download button not found');
          // Take screenshot of popup for debugging
          await popupPage.screenshot({ 
            path: path.join(desktopPath, 'extension-popup.png'),
            fullPage: true 
          });
          console.log('   - Screenshot of popup saved to Desktop');
        }
        
      } else {
        console.log('   - No GIFs found in library');
        await popupPage.screenshot({ 
          path: path.join(desktopPath, 'extension-popup-empty.png'),
          fullPage: true 
        });
        console.log('   - Screenshot saved to Desktop');
      }
      
      await popupPage.close();
    } else {
      console.log('   - Could not determine extension ID');
    }

    // Final screenshot
    await page.screenshot({ 
      path: path.join(desktopPath, 'youtube-final-state.png'),
      fullPage: false 
    });

    console.log('\n=== Test Complete ===');
    console.log('Please check your Desktop for:');
    console.log('  - The generated GIF file (youtube-gif-*.gif)');
    console.log('  - Screenshot files for debugging');
    
    // Keep browser open for a moment
    await page.waitForTimeout(3000);
    
    await browser.close();
  });
});