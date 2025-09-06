import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Service Worker Check', () => {
  let context;
  let page;

  test.beforeAll(async () => {
    console.log('Loading extension from:', EXTENSION_PATH);
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox'
      ],
      viewport: { width: 1280, height: 720 }
    });
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('check service worker logs during GIF creation', async () => {
    // Get service worker
    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    console.log('Service worker found:', serviceWorker.url());
    
    // Set up service worker console logging
    serviceWorker.on('console', msg => {
      console.log(`[SW] ${msg.type()}: ${msg.text()}`);
    });
    
    // Navigate to video page
    page = await context.newPage();
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    console.log('Clicked GIF button');
    
    // Wait for overlay
    await page.waitForSelector('#ytgif-timeline-overlay', { state: 'attached', timeout: 10000 });
    await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Find and click create button
    const createButton = await page.evaluateHandle(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (!overlay) return null;
      const buttons = overlay.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create')) return btn;
      }
      return buttons[0];
    });
    
    if (createButton) {
      await createButton.click();
      console.log('Clicked Create button');
      
      // Wait for processing
      await page.waitForTimeout(10000);
      
      // Check final IndexedDB state
      const dbState = await page.evaluate(async () => {
        const dbName = 'YouTubeGifStore';
        const request = indexedDB.open(dbName, 3);
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const db = request.result;
            resolve({
              version: db.version,
              stores: Array.from(db.objectStoreNames)
            });
          };
          request.onerror = () => {
            resolve({ error: 'Failed to open DB' });
          };
        });
      });
      
      console.log('Database state:', dbState);
      
      // Check GIF count
      const gifCount = await page.evaluate(async () => {
        const dbName = 'YouTubeGifStore';
        const request = indexedDB.open(dbName, 3);
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('gifs')) {
              resolve(0);
              return;
            }
            const transaction = db.transaction(['gifs'], 'readonly');
            const store = transaction.objectStore('gifs');
            const countRequest = store.count();
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => resolve(0);
          };
          request.onerror = () => resolve(0);
        });
      });
      
      console.log('GIFs in database:', gifCount);
    }
  });
});