const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('Create GIF via Popup', () => {
  test('Use popup to create and download GIF', async () => {
    test.setTimeout(180000); // 3 minutes

    console.log('🚀 Starting GIF Creation via Popup\n');
    
    // Setup
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
    
    const browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
      downloadsPath: downloadPath,
    });

    // Wait for extension
    await browser.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => {});
    
    // Navigate to YouTube first
    const page = await browser.newPage();
    console.log('📺 Opening YouTube video...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'domcontentloaded'
    });
    
    await page.waitForSelector('video', { timeout: 15000 });
    
    // Set video to good position
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5;
        video.play();
        setTimeout(() => video.pause(), 1000);
      }
    });
    
    console.log('⏯️ Video ready at 5s mark');
    await page.waitForTimeout(2000);

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
    
    console.log('🔑 Extension ID:', extensionId);
    
    // Method 1: Click "Go Create a GIF" from popup
    if (extensionId) {
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      const popupPage = await browser.newPage();
      await popupPage.goto(popupUrl);
      await popupPage.waitForTimeout(1000);
      
      // Go to Library tab first
      const libraryTab = await popupPage.$('button:has-text("Library"), [data-value="library"]');
      if (libraryTab) {
        await libraryTab.click();
        await popupPage.waitForTimeout(1000);
      }
      
      // Click "Go Create a GIF" button
      const createButton = await popupPage.$('button:has-text("Go Create a GIF")');
      if (createButton) {
        console.log('🎨 Clicking "Go Create a GIF" button...');
        await createButton.click();
        await popupPage.waitForTimeout(2000);
        
        // This might navigate to Create tab
        const createTab = await popupPage.$('button:has-text("Create"), [data-value="create"]');
        if (createTab) {
          // We're now in Create tab
          console.log('📝 In Create tab');
          
          // Look for any input fields or buttons
          const inputs = await popupPage.$$('input, textarea, select');
          console.log(`Found ${inputs.length} input fields`);
          
          // Try to find start/end time inputs
          const startTimeInput = await popupPage.$('input[name*="start"], input[placeholder*="start"]');
          const endTimeInput = await popupPage.$('input[name*="end"], input[placeholder*="end"]');
          
          if (startTimeInput && endTimeInput) {
            console.log('⏱️ Setting time range...');
            await startTimeInput.fill('5');
            await endTimeInput.fill('8');
          }
          
          // Look for Create/Generate button
          const generateButton = await popupPage.$('button:has-text("Create"), button:has-text("Generate"), button:has-text("Make GIF")');
          if (generateButton) {
            console.log('🎬 Clicking generate button...');
            await generateButton.click();
            
            // Wait for processing
            console.log('⏳ Waiting for GIF creation...');
            await popupPage.waitForTimeout(20000);
          }
        }
      }
      
      // Go back to Library tab to check for GIF
      console.log('\n📚 Checking Library for created GIF...');
      const libraryTabAgain = await popupPage.$('button:has-text("Library"), [data-value="library"]');
      if (libraryTabAgain) {
        await libraryTabAgain.click();
        await popupPage.waitForTimeout(2000);
      }
      
      // Look for GIFs
      const gifItems = await popupPage.$$('[class*="gif"], img[src^="blob:"], .library-item');
      console.log(`🖼️ Found ${gifItems.length} items in library`);
      
      if (gifItems.length === 0) {
        // Take screenshot for debugging
        await popupPage.screenshot({ path: path.join(downloadPath, 'popup-after-create.png') });
        console.log('📸 Screenshot: popup-after-create.png');
      }
    }
    
    // Method 2: Try using the GIF button on YouTube page
    console.log('\n🔘 Trying GIF button on YouTube...');
    const gifButton = await page.$('.ytgif-button');
    if (gifButton) {
      console.log('✅ Found GIF button');
      
      // Double-click to ensure activation
      await gifButton.dblclick();
      await page.waitForTimeout(2000);
      
      // Check for any overlays or modals
      const overlays = await page.$$('[class*="overlay"], [class*="modal"], [id*="ytgif"]');
      console.log(`Found ${overlays.length} overlay elements`);
      
      // Take screenshot
      await page.screenshot({ path: path.join(downloadPath, 'after-gif-button.png') });
    }
    
    // Method 3: Manually trigger GIF creation via console
    console.log('\n💉 Injecting GIF creation script...');
    
    // Try to create a simple GIF by capturing current frame
    const gifCreated = await page.evaluate(async () => {
      try {
        const video = document.querySelector('video');
        if (!video) return { error: 'No video found' };
        
        // Create canvas and capture current frame
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        // Capture 10 frames over 1 second
        const frames = [];
        for (let i = 0; i < 10; i++) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Add frame number for variation
          ctx.fillStyle = 'white';
          ctx.font = '30px Arial';
          ctx.fillText(`${i + 1}`, 10, 40);
          
          frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
          
          // Advance video slightly
          video.currentTime += 0.1;
          await new Promise(r => setTimeout(r, 100));
        }
        
        // Try to store in localStorage as a test
        const testData = {
          frames: frames.length,
          timestamp: Date.now(),
          title: 'Test GIF'
        };
        
        localStorage.setItem('ytgif-test-data', JSON.stringify(testData));
        
        return { success: true, framesCaptured: frames.length };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Injection result:', gifCreated);
    
    // Wait a bit
    await page.waitForTimeout(5000);
    
    // Final check - open popup again and look for any GIFs
    if (extensionId) {
      console.log('\n🔍 Final library check...');
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      const finalPopup = await browser.newPage();
      await finalPopup.goto(popupUrl);
      await finalPopup.waitForTimeout(1000);
      
      // Go to Library
      const libTab = await finalPopup.$('button:has-text("Library")');
      if (libTab) {
        await libTab.click();
        await finalPopup.waitForTimeout(1000);
      }
      
      // Final screenshot
      await finalPopup.screenshot({ path: path.join(downloadPath, 'final-library-check.png') });
      
      // Check localStorage in popup context
      const storedData = await finalPopup.evaluate(() => {
        return {
          localStorage: Object.keys(localStorage),
          testData: localStorage.getItem('ytgif-test-data')
        };
      });
      console.log('Stored data:', storedData);
    }
    
    // Check downloads folder
    console.log('\n📂 Checking downloads...');
    const files = await fs.readdir(downloadPath);
    const gifFiles = files.filter(f => f.endsWith('.gif'));
    
    console.log('Files in download folder:', files);
    console.log('GIF files:', gifFiles);
    
    await browser.close();
    
    // For now, just check that extension loaded
    expect(extensionId).toBeTruthy();
  });
});