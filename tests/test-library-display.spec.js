import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Library Display Test', () => {
  let context;
  let extensionId;

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

    // Get extension ID
    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = serviceWorker.url().split('://')[1].split('/')[0];
    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('create GIF and verify library display', async () => {
    // Step 1: Create a GIF
    console.log('Creating a GIF first...');
    const page = await context.newPage();
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    await gifButton.click();
    
    // Wait for overlay and click Create
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
      return buttons[0];
    });
    
    if (createButton) {
      await createButton.click();
      console.log('Creating GIF...');
      
      // Wait for success message
      await page.waitForFunction(() => {
        const feedbacks = document.querySelectorAll('.ytgif-feedback--success');
        return feedbacks.length > 0;
      }, { timeout: 30000 }).catch(() => console.log('No success feedback found'));
      
      await page.waitForTimeout(3000);
    }
    
    // Step 2: Check popup library
    console.log('Opening popup to check library...');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    
    // Wait for React to render
    await popupPage.waitForTimeout(2000);
    
    // Click Library tab
    const libraryTab = await popupPage.waitForSelector('button:has-text("Library"), [role="tab"]:has-text("Library")', {
      timeout: 5000
    }).catch(() => null);
    
    if (libraryTab) {
      await libraryTab.click();
      console.log('Clicked Library tab');
      await popupPage.waitForTimeout(1000);
    }
    
    // Check library content
    const libraryInfo = await popupPage.evaluate(() => {
      // Check for empty state message
      const emptyMessage = Array.from(document.querySelectorAll('h3')).find(
        el => el.textContent?.includes('No GIFs yet')
      );
      
      // Check for GIF cards
      const gifCards = document.querySelectorAll('[class*="shadow-sm"]');
      const gifImages = document.querySelectorAll('img');
      
      // Check for GIF count display
      const countDisplay = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('GIF')
      );
      
      // Get any visible titles
      const titles = Array.from(document.querySelectorAll('h3')).map(el => el.textContent);
      
      // Check for download buttons as indicator of GIF items
      const downloadButtons = Array.from(document.querySelectorAll('button')).filter(
        btn => btn.textContent?.includes('Download')
      );
      
      return {
        hasEmptyMessage: !!emptyMessage,
        emptyMessageText: emptyMessage?.textContent,
        gifCardCount: gifCards.length,
        gifImageCount: gifImages.length,
        downloadButtonCount: downloadButtons.length,
        countDisplayText: countDisplay?.textContent,
        visibleTitles: titles
      };
    });
    
    console.log('Library info:', libraryInfo);
    
    // Also check IndexedDB directly from popup context
    const dbInfo = await popupPage.evaluate(async () => {
      const dbName = 'YouTubeGifStore';
      const request = indexedDB.open(dbName, 3);
      
      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const gifs = getAllRequest.result;
            resolve({
              gifCount: gifs.length,
              gifs: gifs.map(g => ({
                id: g.id,
                title: g.title,
                hasBlob: !!g.blob,
                hasGifBlob: !!g.gifBlob,
                hasThumbnail: !!g.thumbnailBlob
              }))
            });
          };
          
          getAllRequest.onerror = () => {
            resolve({ error: 'Failed to get GIFs', gifCount: 0 });
          };
        };
        
        request.onerror = () => {
          resolve({ error: 'Failed to open DB', gifCount: 0 });
        };
      });
    });
    
    console.log('Database info from popup:', dbInfo);
    
    // Take screenshots
    await popupPage.screenshot({ path: 'test-results/popup-library.png', fullPage: true });
    
    // Assertions
    if (dbInfo.gifCount > 0) {
      console.log(`✅ Found ${dbInfo.gifCount} GIF(s) in database`);
      
      if (libraryInfo.hasEmptyMessage) {
        console.log('❌ Library shows empty state despite having GIFs in database');
        console.log('This indicates the library component is not reading the data correctly');
      } else if (libraryInfo.gifCardCount > 0) {
        console.log(`✅ Library is displaying ${libraryInfo.gifCardCount} GIF card(s)`);
      } else {
        console.log('❌ No GIF cards found in library UI');
      }
    } else {
      console.log('❌ No GIFs found in database');
    }
    
    expect(dbInfo.gifCount).toBeGreaterThan(0);
    expect(libraryInfo.hasEmptyMessage).toBe(false);
  });
});