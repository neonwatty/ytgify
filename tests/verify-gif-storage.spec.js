import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('GIF Storage Verification', () => {
  let context;
  let extensionId;
  let page;

  test.beforeAll(async () => {
    console.log('Loading extension from:', EXTENSION_PATH);
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ],
      viewport: { width: 1280, height: 720 },
      permissions: ['clipboard-read', 'clipboard-write']
    });

    // Get extension ID
    const backgroundPages = context.backgroundPages();
    if (backgroundPages.length > 0) {
      const backgroundPage = backgroundPages[0];
      const url = backgroundPage.url();
      extensionId = url.split('://')[1].split('/')[0];
    } else {
      const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      const url = serviceWorker.url();
      extensionId = url.split('://')[1].split('/')[0];
    }
    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('create GIF and verify storage', async () => {
    console.log('Starting GIF creation test...');

    page = await context.newPage();
    
    // Set up console logging
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Content]') || text.includes('GIF') || text.includes('storage')) {
        console.log('Console:', text);
      }
    });
    
    await page.goto(TEST_VIDEO_URL);
    
    // Wait for video and extension to load
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    console.log('Video loaded');

    // Click the GIF button
    const gifButton = await page.waitForSelector('.ytgif-button', { timeout: 10000 });
    expect(gifButton).toBeTruthy();
    console.log('Found GIF button');
    
    await gifButton.click();
    console.log('Clicked GIF button');

    // Wait for timeline overlay (it might be created but not visible immediately)
    const timelineOverlay = await page.waitForSelector('#ytgif-timeline-overlay', { 
      state: 'attached', // Just wait for it to be in DOM, not necessarily visible
      timeout: 10000 
    });
    expect(timelineOverlay).toBeTruthy();
    console.log('Timeline overlay found in DOM');
    
    // Check if it's visible or wait for it to become visible
    await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay && (overlay.style.display === 'none' || overlay.style.visibility === 'hidden')) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
      }
    });
    console.log('Timeline overlay made visible');

    // Wait a bit for React to render the content
    await page.waitForTimeout(2000);
    
    // Look for the Create GIF button inside the timeline overlay
    const createButton = await page.evaluateHandle(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (!overlay) return null;
      
      // Search for button with text containing "Create"
      const buttons = overlay.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('Create') || text.includes('GIF') || text.includes('Generate')) {
          return btn;
        }
      }
      
      // Also check for buttons with specific classes
      const createBtn = overlay.querySelector('.create-button, .create-gif-button, [data-action="create"]');
      if (createBtn) return createBtn;
      
      // Return any button that's not a close button
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (!text.includes('Close') && !text.includes('Cancel') && !text.includes('×')) {
          return btn;
        }
      }
      
      return null;
    });
    
    if (createButton) {
      const buttonText = await createButton.evaluate(btn => btn.textContent);
      console.log(`Found create button with text: "${buttonText}"`);
      
      // Click the create button
      await createButton.click();
      console.log('Clicked Create GIF button');
      
      // Wait for GIF creation to complete
      console.log('Waiting for GIF creation...');
      
      // Look for success message or feedback
      const success = await Promise.race([
        page.waitForFunction(() => {
          // Check for success feedback
          const feedbacks = document.querySelectorAll('.ytgif-feedback--success, [class*="success"], [class*="feedback"]');
          for (const el of feedbacks) {
            if (el.textContent?.toLowerCase().includes('saved') || 
                el.textContent?.toLowerCase().includes('created')) {
              return true;
            }
          }
          
          // Check if timeline overlay is gone (might indicate completion)
          const overlay = document.querySelector('#ytgif-timeline-overlay');
          return !overlay || overlay.style.display === 'none';
        }, { timeout: 30000 }),
        
        // Also wait for console messages
        page.waitForFunction(() => {
          return window.__gifCreated === true;
        }, { timeout: 30000 }).catch(() => false)
      ]);
      
      if (success) {
        console.log('GIF creation appears to have completed');
      } else {
        console.log('No clear success indicator, but continuing...');
      }
      
      // Inject a flag when we see the success message in console
      page.on('console', msg => {
        if (msg.text().includes('GIF saved to library')) {
          page.evaluate(() => { window.__gifCreated = true; }).catch(() => {});
        }
      });
      
    } else {
      console.log('Create button not found in timeline overlay');
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/timeline-overlay-debug.png' });
      console.log('Screenshot saved to test-results/timeline-overlay-debug.png');
      
      // Log the overlay content
      const overlayContent = await page.evaluate(() => {
        const overlay = document.querySelector('#ytgif-timeline-overlay');
        return {
          exists: !!overlay,
          innerHTML: overlay ? overlay.innerHTML.substring(0, 500) : null,
          childCount: overlay ? overlay.children.length : 0,
          buttons: overlay ? Array.from(overlay.querySelectorAll('button')).map(b => b.textContent) : []
        };
      });
      console.log('Overlay content:', overlayContent);
    }
    
    // Wait for any async operations
    await page.waitForTimeout(5000);
    
    // Check IndexedDB for saved GIFs
    const gifCount = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const dbName = 'YouTubeGifStore';
        const request = indexedDB.open(dbName, 3);
        
        request.onerror = () => {
          console.error('Failed to open database');
          resolve(0);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('gifs')) {
            console.log('No gifs store');
            resolve(0);
            return;
          }
          
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            const count = countRequest.result;
            console.log(`IndexedDB contains ${count} GIFs`);
            
            // Get all GIFs for debugging
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
              const gifs = getAllRequest.result;
              if (gifs.length > 0) {
                console.log('First GIF:', {
                  id: gifs[0].id,
                  title: gifs[0].title,
                  hasBlob: !!gifs[0].blob,
                  blobSize: gifs[0].blob ? gifs[0].blob.size : 0,
                  metadata: gifs[0].metadata
                });
              }
              resolve(count);
            };
            getAllRequest.onerror = () => resolve(count);
          };
        };
      });
    });
    
    console.log(`Total GIFs in storage: ${gifCount}`);
    
    // Check popup library
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(2000);
    
    // Click library tab if needed
    const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (libraryTab) {
      await libraryTab.click();
      await popupPage.waitForTimeout(1000);
    }
    
    // Check for GIF items
    const libraryContent = await popupPage.evaluate(() => {
      const items = document.querySelectorAll('[class*="gif"], img, .library-item');
      const emptyMessage = document.querySelector('[class*="empty"], [class*="no-gif"]');
      
      return {
        itemCount: items.length,
        hasEmptyMessage: !!emptyMessage,
        emptyMessageText: emptyMessage ? emptyMessage.textContent : null,
        bodyHTML: document.body.innerHTML.substring(0, 500)
      };
    });
    
    console.log('Library content:', libraryContent);
    
    // Take final screenshots
    await page.screenshot({ path: 'test-results/final-page-state.png', fullPage: true });
    await popupPage.screenshot({ path: 'test-results/final-popup-state.png', fullPage: true });
    
    // Final assertion
    if (gifCount > 0) {
      console.log('✅ SUCCESS: GIF was saved to storage!');
    } else {
      console.log('❌ FAILURE: No GIFs found in storage');
      console.log('This might mean:');
      console.log('1. The GIF creation failed');
      console.log('2. The storage saving failed');
      console.log('3. The test needs more wait time');
    }
    
    expect(gifCount).toBeGreaterThan(0);
  });
});