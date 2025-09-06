const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('Create Real GIF from YouTube', () => {
  test('Create a 3-second GIF and download it', async () => {
    test.setTimeout(180000); // 3 minutes

    console.log('🎬 Starting Real GIF Creation Test\n');
    
    // Setup download folder
    const downloadPath = path.join(__dirname, 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });
    
    // Clear existing GIFs
    try {
      const files = await fs.readdir(downloadPath);
      for (const file of files) {
        if (file.endsWith('.gif')) {
          await fs.unlink(path.join(downloadPath, file));
        }
      }
    } catch (e) {}

    const extensionPath = path.join(__dirname, '..', 'dist');
    console.log('📦 Loading extension from:', extensionPath);
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-dev-shm-usage'
      ],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
      downloadsPath: downloadPath,
    });

    // Wait for extension to load
    await browser.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => {});
    console.log('✅ Extension loaded');

    // Navigate to a short YouTube video (Me at the zoo - 19 seconds)
    const page = await browser.newPage();
    console.log('\n📺 Navigating to YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for video player to load
    await page.waitForSelector('video', { timeout: 15000 });
    const video = await page.$('video');
    
    // Set video to a good starting point and play
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5; // Start at 5 seconds
        video.play();
      }
    });
    
    console.log('⏯️  Video loaded and playing from 5s mark');
    await page.waitForTimeout(2000);

    // Method 1: Click GIF button and try to use the UI
    console.log('\n🔍 Looking for GIF button...');
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    
    if (gifButton) {
      console.log('✅ Found GIF button, clicking...');
      await gifButton.click();
      await page.waitForTimeout(2000);
      
      // Check if timeline overlay appeared
      const timelineOverlay = await page.$('#ytgif-timeline-overlay, .ytgif-timeline-overlay');
      
      if (timelineOverlay) {
        console.log('📊 Timeline overlay found!');
        
        // Try clicking a preset button
        const presetButton = await page.$('.ytgif-preset-btn');
        if (presetButton) {
          console.log('⚡ Clicking 3s preset...');
          await presetButton.click();
          await page.waitForTimeout(1000);
        } else {
          // Manually set selection
          console.log('📏 Setting manual 3-second selection...');
          await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video && window.postMessage) {
              // Try to trigger GIF creation through window messages
              window.postMessage({
                type: 'CREATE_GIF',
                startTime: video.currentTime,
                endTime: video.currentTime + 3,
                duration: 3
              }, '*');
            }
          });
        }
        
        // Look for Create button
        const createButton = await page.$('.ytgif-timeline-create, button:has-text("Create GIF"), button:has-text("Create")');
        if (createButton) {
          console.log('🎨 Clicking Create GIF button...');
          await createButton.click();
          
          // Wait for processing
          console.log('⏳ Waiting for GIF creation...');
          await page.waitForTimeout(15000); // Give it time to process
        }
      }
    }

    // Method 2: Direct message to background script
    console.log('\n💬 Attempting direct message to background script...');
    
    // Capture frames from video
    const frames = await page.evaluate(async () => {
      const video = document.querySelector('video');
      if (!video) return null;
      
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      
      const frames = [];
      const frameCount = 30; // 3 seconds at 10fps
      const startTime = video.currentTime;
      
      for (let i = 0; i < frameCount; i++) {
        video.currentTime = startTime + (i * 0.1); // 0.1 second intervals
        await new Promise(r => setTimeout(r, 100)); // Wait for frame to load
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        frames.push({
          data: Array.from(imageData.data),
          width: imageData.width,
          height: imageData.height
        });
      }
      
      return frames;
    });
    
    if (frames) {
      console.log(`📹 Captured ${frames.length} frames from video`);
      
      // Try to send frames to extension for processing
      const result = await page.evaluate(async (frames) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          return new Promise(resolve => {
            chrome.runtime.sendMessage({
              type: 'PROCESS_FRAMES',
              action: 'encode_gif',
              frames: frames,
              settings: {
                width: 320,
                height: 240,
                frameRate: 10,
                quality: 'medium',
                loop: true
              }
            }, response => {
              resolve(response || { sent: true });
            });
          });
        }
        return { error: 'Chrome runtime not available' };
      }, frames);
      
      console.log('Message result:', result);
    }

    // Wait for processing to complete
    console.log('\n⏳ Waiting for GIF processing to complete...');
    await page.waitForTimeout(20000);

    // Method 3: Open popup and check library
    console.log('\n📚 Opening extension popup to check library...');
    
    // Get extension ID
    let extensionId = null;
    const pages = await browser.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.includes('chrome-extension://')) {
        extensionId = url.split('/')[2];
        break;
      }
    }
    
    if (!extensionId) {
      const serviceWorkers = browser.serviceWorkers();
      if (serviceWorkers.length > 0) {
        extensionId = serviceWorkers[0].url().split('/')[2];
      }
    }
    
    if (extensionId) {
      console.log('🔑 Extension ID:', extensionId);
      
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      const popupPage = await browser.newPage();
      await popupPage.goto(popupUrl);
      await popupPage.waitForTimeout(2000);
      
      // Click Library tab
      console.log('📂 Navigating to Library tab...');
      const libraryTab = await popupPage.$('button:has-text("Library"), [data-value="library"], .tab-trigger:has-text("Library")');
      if (libraryTab) {
        await libraryTab.click();
        await popupPage.waitForTimeout(2000);
      }
      
      // Look for any GIF items
      const gifItems = await popupPage.$$('[class*="gif"], [class*="library-item"], .library-grid > div, img[src^="blob:"]');
      console.log(`🖼️  Found ${gifItems.length} potential GIF items in library`);
      
      if (gifItems.length > 0) {
        // Try to find and click download button
        console.log('🔍 Looking for download button...');
        
        // Try various selectors for download button
        const downloadSelectors = [
          'button:has-text("Download")',
          '[aria-label*="Download"]',
          'button[title*="Download"]',
          '.download-btn',
          'button svg[class*="download"]',
          'button:has(svg path[d*="M21"])', // Common download icon path
        ];
        
        let downloadButton = null;
        for (const selector of downloadSelectors) {
          downloadButton = await popupPage.$(selector);
          if (downloadButton) {
            console.log(`✅ Found download button with selector: ${selector}`);
            break;
          }
        }
        
        if (!downloadButton) {
          // Try clicking on the GIF item first to reveal options
          console.log('👆 Clicking on GIF item to reveal options...');
          await gifItems[0].click();
          await popupPage.waitForTimeout(1000);
          
          // Try download selectors again
          for (const selector of downloadSelectors) {
            downloadButton = await popupPage.$(selector);
            if (downloadButton) break;
          }
        }
        
        if (downloadButton) {
          console.log('💾 Clicking download button...');
          
          // Set up download promise
          const downloadPromise = popupPage.waitForEvent('download', { timeout: 10000 }).catch(() => null);
          
          await downloadButton.click();
          
          const download = await downloadPromise;
          if (download) {
            const filename = download.suggestedFilename();
            const savePath = path.join(downloadPath, filename);
            await download.saveAs(savePath);
            console.log(`✅ GIF downloaded: ${filename}`);
            
            // Verify file exists and is a GIF
            const stats = await fs.stat(savePath);
            console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)}KB`);
            
            // Copy to project root
            const destPath = path.join(__dirname, '..', `created-gif-${Date.now()}.gif`);
            await fs.copyFile(savePath, destPath);
            console.log(`🎁 GIF copied to: ${destPath}`);
            
            // Success!
            expect(stats.size).toBeGreaterThan(1000); // At least 1KB
            return;
          }
        } else {
          console.log('❌ Could not find download button');
          
          // Try alternative: right-click on image
          if (gifItems.length > 0) {
            console.log('🖱️  Trying right-click download...');
            await gifItems[0].click({ button: 'right' });
            await popupPage.waitForTimeout(1000);
            
            // Look for "Save image as" option
            const saveOption = await popupPage.$('text="Save image as", text="Save Image As"');
            if (saveOption) {
              await saveOption.click();
              await popupPage.waitForTimeout(3000);
            }
          }
        }
      } else {
        console.log('❌ No GIFs found in library');
        
        // Debug: Take screenshot of popup
        await popupPage.screenshot({ path: path.join(downloadPath, 'popup-library.png') });
        console.log('📸 Screenshot saved: popup-library.png');
      }
    }

    // Final check of download folder
    console.log('\n📂 Final check of downloads folder...');
    const files = await fs.readdir(downloadPath);
    const gifFiles = files.filter(f => f.endsWith('.gif'));
    
    if (gifFiles.length > 0) {
      console.log('✅ SUCCESS! Created and downloaded GIF:');
      for (const file of gifFiles) {
        const stats = await fs.stat(path.join(downloadPath, file));
        console.log(`  📄 ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
      }
    } else {
      console.log('❌ No GIF files found in download folder');
      console.log('Files found:', files);
      
      // Take screenshots for debugging
      await page.screenshot({ path: path.join(downloadPath, 'youtube-page.png') });
      console.log('📸 Debug screenshots saved');
    }
    
    await browser.close();
    
    // Assert we created and downloaded a GIF
    expect(gifFiles.length).toBeGreaterThan(0);
  });
});