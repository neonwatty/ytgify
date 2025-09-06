import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Database Debug', () => {
  let context;
  let extensionId;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox'
      ],
      viewport: { width: 1280, height: 720 }
    });

    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = serviceWorker.url().split('://')[1].split('/')[0];
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('debug database state after GIF creation', async () => {
    // Create a GIF
    const page = await context.newPage();
    
    // Monitor console logs
    page.on('console', msg => {
      if (msg.text().includes('GIF') || msg.text().includes('IndexedDB')) {
        console.log('Page:', msg.text());
      }
    });
    
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    // Create GIF
    await page.waitForSelector('#ytgif-timeline-overlay', { state: 'attached' });
    await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
      }
    });
    await page.waitForTimeout(2000);
    
    const createButton = await page.evaluateHandle(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (!overlay) return null;
      const buttons = overlay.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create')) return btn;
      }
      return null;
    });
    
    if (createButton) {
      await createButton.click();
      console.log('Clicked Create button, waiting for GIF creation...');
      
      // Wait for success feedback
      await page.waitForFunction(() => {
        const feedbacks = document.querySelectorAll('.ytgif-feedback--success');
        return feedbacks.length > 0;
      }, { timeout: 30000 }).catch(() => console.log('No success feedback'));
      
      console.log('Waiting additional 5 seconds for DB write...');
      await page.waitForTimeout(5000);
    }
    
    // Check database from YouTube page context
    console.log('\n=== Database check from YouTube page ===');
    const ytPageDB = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      console.log('Available databases:', databases);
      
      const dbName = 'YouTubeGifStore';
      const request = indexedDB.open(dbName, 3);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const countRequest = store.count();
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const gifs = getAllRequest.result;
            resolve({
              dbVersion: db.version,
              stores: Array.from(db.objectStoreNames),
              gifCount: gifs.length,
              firstGif: gifs[0] ? {
                id: gifs[0].id,
                title: gifs[0].title,
                hasBlob: !!gifs[0].blob,
                hasThumbnail: !!gifs[0].thumbnailBlob,
                metadata: gifs[0].metadata
              } : null
            });
          };
        };
        
        request.onerror = () => {
          resolve({ error: 'Failed to open DB from page' });
        };
      });
    });
    console.log('YouTube page DB state:', ytPageDB);
    
    // Now check from popup
    console.log('\n=== Database check from Popup ===');
    const popupPage = await context.newPage();
    
    popupPage.on('console', msg => {
      console.log('Popup console:', msg.text());
    });
    
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(2000);
    
    const popupDB = await popupPage.evaluate(async () => {
      const databases = await indexedDB.databases();
      console.log('Popup available databases:', databases);
      
      const dbName = 'YouTubeGifStore';
      const request = indexedDB.open(dbName, 3);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          
          // Check if gifs store exists
          if (!db.objectStoreNames.contains('gifs')) {
            resolve({
              error: 'gifs store does not exist',
              stores: Array.from(db.objectStoreNames)
            });
            return;
          }
          
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const gifs = getAllRequest.result;
            resolve({
              dbVersion: db.version,
              stores: Array.from(db.objectStoreNames),
              gifCount: gifs.length,
              firstGif: gifs[0] ? {
                id: gifs[0].id,
                title: gifs[0].title,
                hasBlob: !!gifs[0].blob,
                hasGifBlob: !!gifs[0].gifBlob,
                hasThumbnail: !!gifs[0].thumbnailBlob,
                metadata: gifs[0].metadata
              } : null
            });
          };
          
          getAllRequest.onerror = () => {
            resolve({ error: 'Failed to get GIFs' });
          };
        };
        
        request.onerror = () => {
          resolve({ error: 'Failed to open DB from popup' });
        };
        
        request.onupgradeneeded = (event) => {
          console.log('Popup triggered DB upgrade!');
          resolve({ error: 'Database upgrade was triggered - version mismatch' });
        };
      });
    });
    console.log('Popup DB state:', popupDB);
    
    // Compare the two
    console.log('\n=== Analysis ===');
    if (ytPageDB.gifCount > 0 && popupDB.gifCount === 0) {
      console.log('❌ GIF exists in YouTube page context but not in popup context');
      console.log('This suggests IndexedDB isolation between contexts');
    } else if (ytPageDB.gifCount === 0) {
      console.log('❌ GIF was not saved at all');
    } else if (popupDB.gifCount > 0) {
      console.log('✅ GIF is accessible from both contexts');
    }
    
    // Check if storage.getAllGifs() works in popup
    console.log('\n=== Testing gifStorage.getAllGifs() in popup ===');
    const storageResult = await popupPage.evaluate(async () => {
      try {
        // Import and use the storage module
        const { gifStorage } = await import('/lib/storage.js');
        await gifStorage.init();
        const gifs = await gifStorage.getAllGifs();
        return {
          success: true,
          count: gifs.length,
          firstGif: gifs[0] ? {
            id: gifs[0].id,
            hasGifBlob: !!gifs[0].gifBlob,
            hasBlob: !!gifs[0].blob
          } : null
        };
      } catch (error) {
        return { success: false, error: error.message || String(error) };
      }
    });
    console.log('gifStorage.getAllGifs() result:', storageResult);
  });
});