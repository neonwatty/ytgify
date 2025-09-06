const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test('Simple GIF Download Test', async () => {
  console.log('\n=== Simple GIF Download Test ===\n');
  
  const extensionPath = path.join(__dirname, '..', 'dist');
  const downloadsPath = path.join(__dirname, 'downloads');
  
  // Clean downloads directory
  try {
    await fs.rm(downloadsPath, { recursive: true, force: true });
  } catch (e) {}
  await fs.mkdir(downloadsPath, { recursive: true });
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
  });

  const page = await context.newPage();
  
  // Track console logs
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GIF') || text.includes('Download') || text.includes('Blob')) {
      console.log('[Browser]:', text);
    }
  });
  
  console.log('1. Loading YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
  await page.waitForTimeout(5000);
  
  console.log('2. Setting video time...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = 5;
      video.pause();
      console.log('Video set to 5 seconds');
    }
  });
  await page.waitForTimeout(1000);
  
  console.log('3. Clicking GIF button...');
  const gifButton = await page.locator('.ytgif-button, .ytgif-button-svg').first();
  await expect(gifButton).toBeVisible({ timeout: 10000 });
  await gifButton.click();
  
  console.log('4. Waiting for timeline overlay...');
  const overlay = await page.locator('.ytgif-timeline-overlay, #ytgif-timeline-overlay').first();
  await expect(overlay).toBeVisible({ timeout: 5000 });
  
  console.log('5. Creating 2-second GIF...');
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      // Dispatch selection event
      const event = new CustomEvent('ytgif-selection-change', {
        detail: {
          startTime: 5,
          endTime: 7,
          duration: 2
        }
      });
      window.dispatchEvent(event);
      console.log('Selection set: 5-7 seconds');
    }
  });
  
  console.log('6. Clicking Create GIF...');
  const createButton = await page.locator('.ytgif-timeline-create, button:has-text("Create")').first();
  await createButton.click();
  
  console.log('7. Waiting for processing...');
  await page.waitForTimeout(10000);
  
  // Check for download via multiple methods
  console.log('8. Checking for download...');
  
  // Method 1: Check if download was triggered automatically
  const autoDownloadCheck = await page.evaluate(() => {
    // Check if a download link was created
    const links = document.querySelectorAll('a[download]');
    return links.length > 0;
  });
  
  if (autoDownloadCheck) {
    console.log('✅ Download link found');
  }
  
  // Method 2: Check for preview modal with download button
  const previewModal = await page.locator('.ytgif-preview-modal').first();
  if (await previewModal.isVisible()) {
    console.log('Preview modal is visible');
    
    const downloadBtn = await page.locator('button:has-text("Download")').first();
    if (await downloadBtn.isVisible()) {
      console.log('Download button found in preview');
      
      // Set up download handler
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        downloadBtn.click()
      ]);
      
      if (download) {
        const fileName = `test_gif_${Date.now()}.gif`;
        const savePath = path.join(downloadsPath, fileName);
        await download.saveAs(savePath);
        console.log(`✅ GIF downloaded to: ${savePath}`);
        
        const stats = await fs.stat(savePath);
        console.log(`   File size: ${(stats.size / 1024).toFixed(1)} KB`);
      }
    }
  }
  
  // Method 3: Check IndexedDB for saved GIFs
  const savedGifs = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const request = indexedDB.open('YouTubeGifStore', 3);
      request.onsuccess = () => {
        const db = request.result;
        if (db.objectStoreNames.contains('gifs')) {
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const gifs = getAllRequest.result;
            resolve(gifs.map(g => ({
              id: g.id,
              size: g.blob ? g.blob.size : 0,
              timestamp: g.timestamp
            })));
          };
        } else {
          resolve([]);
        }
      };
      request.onerror = () => resolve([]);
    });
  });
  
  if (savedGifs.length > 0) {
    console.log(`✅ Found ${savedGifs.length} GIF(s) in IndexedDB`);
    savedGifs.forEach(gif => {
      console.log(`   - ${gif.id}: ${(gif.size / 1024).toFixed(1)} KB`);
    });
    
    // Try to trigger download of the first saved GIF
    await page.evaluate(() => {
      const request = indexedDB.open('YouTubeGifStore', 3);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['gifs'], 'readonly');
        const store = transaction.objectStore('gifs');
        const getRequest = store.getAll();
        getRequest.onsuccess = () => {
          const gif = getRequest.result[0];
          if (gif && gif.blob) {
            // Create download link
            const url = URL.createObjectURL(gif.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `youtube-gif-${Date.now()}.gif`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log('Download triggered from IndexedDB');
          }
        };
      };
    });
    
    await page.waitForTimeout(2000);
  }
  
  // List any files in downloads directory
  try {
    const files = await fs.readdir(downloadsPath);
    if (files.length > 0) {
      console.log('\n✅ SUCCESS - GIFs downloaded:');
      for (const file of files) {
        const stats = await fs.stat(path.join(downloadsPath, file));
        console.log(`   - ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
      }
    } else {
      console.log('\n⚠️ No files in downloads directory');
      console.log('GIFs may be saved in IndexedDB but not downloaded to disk');
    }
  } catch (e) {
    console.log('Could not read downloads directory');
  }
  
  await browser.close();
  
  console.log('\n=== Test Complete ===\n');
});