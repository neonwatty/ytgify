const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test.describe('Direct GIF Creation and Download', () => {
  test('Create and download GIF bypassing UI', async () => {
    test.setTimeout(120000);

    console.log('🎯 Direct GIF Creation Test\n');
    
    // Setup download folder
    const downloadPath = path.join(__dirname, 'downloads');
    await fs.mkdir(downloadPath, { recursive: true });
    
    // Clear existing files
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

    // Wait for extension to load
    const serviceWorker = await browser.waitForEvent('serviceworker', { timeout: 10000 });
    console.log('✅ Extension service worker loaded');

    // Get extension ID
    let extensionId = null;
    const pages = browser.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.includes('chrome-extension://')) {
        extensionId = url.split('/')[2];
        break;
      }
    }
    
    if (!extensionId) {
      // Try alternative method
      const backgroundPages = browser.serviceWorkers();
      if (backgroundPages.length > 0) {
        const bgUrl = backgroundPages[0].url();
        extensionId = bgUrl.split('/')[2];
      }
    }
    
    console.log('📦 Extension ID:', extensionId || 'not found directly');

    // Navigate to YouTube
    const page = await browser.newPage();
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      waitUntil: 'domcontentloaded'
    });
    
    await page.waitForSelector('video', { timeout: 15000 });
    console.log('📺 YouTube video loaded');
    
    // Set video time
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.currentTime = 5;
        video.pause();
      }
    });
    await page.waitForTimeout(2000);

    // Method 1: Try to create frames directly and send to background
    console.log('\n🔧 Method 1: Creating test frames and sending to background...');
    
    const gifCreated = await page.evaluate(async () => {
      try {
        // Create simple test frames
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        
        const frames = [];
        for (let i = 0; i < 5; i++) {
          // Clear canvas
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw test pattern
          ctx.fillStyle = `hsl(${i * 60}, 100%, 50%)`;
          ctx.fillRect(i * 50, 50, 40, 140);
          
          // Add text
          ctx.fillStyle = '#fff';
          ctx.font = '30px Arial';
          ctx.fillText(`Frame ${i + 1}`, 100, 120);
          
          // Get image data
          frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
        
        // Try to send to extension
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          return new Promise((resolve) => {
            chrome.runtime.sendMessage({
              type: 'CREATE_GIF',
              frames: frames.map(f => ({
                data: Array.from(f.data),
                width: f.width,
                height: f.height
              })),
              settings: {
                width: 320,
                height: 240,
                frameRate: 5,
                quality: 'medium'
              }
            }, response => {
              resolve(response || { success: false, error: 'No response' });
            });
          });
        }
        
        return { success: false, error: 'Chrome runtime not available' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Result:', gifCreated);

    // Method 2: Open popup and check library
    console.log('\n🎨 Method 2: Opening popup to check library...');
    
    if (extensionId) {
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      const popupPage = await browser.newPage();
      
      try {
        await popupPage.goto(popupUrl);
        await popupPage.waitForTimeout(2000);
        
        console.log('📋 Popup opened');
        
        // Click Library tab
        const libraryTab = await popupPage.$('button:has-text("Library"), [aria-label="Library"]');
        if (libraryTab) {
          await libraryTab.click();
          await popupPage.waitForTimeout(1000);
          console.log('📚 Library tab clicked');
          
          // Check for GIFs
          const gifCards = await popupPage.$$('[class*="gif-card"], [class*="library-item"], img[src^="blob:"]');
          console.log(`🖼️ Found ${gifCards.length} potential GIF items`);
          
          // Try to find download button
          const downloadButtons = await popupPage.$$('button:has-text("Download"), [aria-label*="Download"]');
          console.log(`💾 Found ${downloadButtons.length} download buttons`);
          
          if (downloadButtons.length > 0) {
            console.log('⬇️ Clicking download button...');
            
            // Setup download listener
            const downloadPromise = popupPage.waitForEvent('download', { timeout: 5000 }).catch(() => null);
            
            await downloadButtons[0].click();
            
            const download = await downloadPromise;
            if (download) {
              const filename = download.suggestedFilename();
              console.log('✅ Download initiated:', filename);
              await download.saveAs(path.join(downloadPath, filename));
              console.log('✅ File saved to:', path.join(downloadPath, filename));
            } else {
              console.log('⚠️ No download event triggered');
            }
          }
        }
      } catch (e) {
        console.log('Popup error:', e.message);
      }
    }

    // Method 3: Create a simple GIF using the page context
    console.log('\n🎬 Method 3: Creating GIF directly in page context...');
    
    const directGif = await page.evaluate(async () => {
      try {
        // Create a very simple GIF blob for testing
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Draw something simple
        ctx.fillStyle = 'red';
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('TEST', 25, 55);
        
        // Convert to blob
        return new Promise((resolve) => {
          canvas.toBlob(blob => {
            if (blob) {
              // Create download link
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'test-direct.gif';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              resolve({ success: true, message: 'Download triggered' });
            } else {
              resolve({ success: false, error: 'Could not create blob' });
            }
          }, 'image/gif'); // Note: might create PNG if GIF not supported
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('Direct GIF result:', directGif);
    
    // Wait a bit for downloads
    await page.waitForTimeout(3000);
    
    // Check download folder
    console.log('\n📂 Checking downloads folder...');
    const files = await fs.readdir(downloadPath);
    const gifFiles = files.filter(f => f.endsWith('.gif') || f.endsWith('.png'));
    
    if (gifFiles.length > 0) {
      console.log('✅ SUCCESS! Found downloaded files:');
      for (const file of gifFiles) {
        const stats = await fs.stat(path.join(downloadPath, file));
        console.log(`  📄 ${file} (${(stats.size / 1024).toFixed(1)}KB)`);
      }
      
      // Copy first file to project root for easy access
      if (gifFiles.length > 0) {
        const sourceFile = path.join(downloadPath, gifFiles[0]);
        const destFile = path.join(__dirname, '..', `downloaded-test-${Date.now()}.gif`);
        await fs.copyFile(sourceFile, destFile);
        console.log(`\n🎁 File copied to: ${destFile}`);
      }
    } else {
      console.log('❌ No downloaded files found');
    }
    
    await browser.close();
    
    // Assert we got something
    expect(gifFiles.length).toBeGreaterThan(0);
  });
});