import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video

test.describe('GIF Creation and Storage', () => {
  let context;
  let extensionId;
  let page;

  test.beforeAll(async () => {
    console.log('Loading extension from:', EXTENSION_PATH);
    
    // Launch Chrome with the extension
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
      console.log('Extension ID:', extensionId);
    } else {
      // Wait for service worker
      const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      const url = serviceWorker.url();
      extensionId = url.split('://')[1].split('/')[0];
      console.log('Extension ID from service worker:', extensionId);
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('should create a GIF and save it to storage', async () => {
    console.log('Starting GIF creation and storage test...');

    // Open YouTube video
    page = await context.newPage();
    await page.goto(TEST_VIDEO_URL);
    
    // Wait for video player to load
    await page.waitForSelector('video', { timeout: 10000 });
    console.log('Video player loaded');

    // Wait a bit for the extension to initialize
    await page.waitForTimeout(3000);

    // Look for the GIF button in YouTube player controls
    const gifButton = await page.waitForSelector('.ytgif-button, [aria-label*="GIF"], button:has(svg)', {
      timeout: 10000
    });
    
    expect(gifButton).toBeTruthy();
    console.log('Found GIF button');

    // Click the GIF button to activate GIF mode
    await gifButton.click();
    console.log('Clicked GIF button');

    // Wait for timeline overlay to appear
    const timelineOverlay = await page.waitForSelector('#ytgif-timeline-overlay, .timeline-overlay, [data-testid="timeline-overlay"]', {
      timeout: 10000
    });
    expect(timelineOverlay).toBeTruthy();
    console.log('Timeline overlay appeared');

    // Wait for the Create GIF button
    const createButton = await page.waitForSelector('button:has-text("Create GIF"), button:has-text("Create"), button:has-text("Generate")', {
      timeout: 10000
    });
    expect(createButton).toBeTruthy();
    console.log('Found Create GIF button');

    // Set up console logging to capture extension messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Content]') || text.includes('GIF') || text.includes('storage')) {
        console.log('Console:', text);
      }
    });

    // Click Create GIF button
    await createButton.click();
    console.log('Clicked Create GIF button');

    // Wait for GIF creation to complete (look for success feedback or completion message)
    const successIndicator = await Promise.race([
      page.waitForSelector('.ytgif-feedback--success', { timeout: 30000 }).catch(() => null),
      page.waitForSelector('text=/GIF created/', { timeout: 30000 }).catch(() => null),
      page.waitForSelector('text=/saved to library/', { timeout: 30000 }).catch(() => null),
      page.waitForFunction(() => {
        const feedbacks = document.querySelectorAll('[class*="feedback"], [class*="success"], [class*="notification"]');
        for (const el of feedbacks) {
          if (el.textContent?.toLowerCase().includes('gif') && 
              (el.textContent?.toLowerCase().includes('created') || 
               el.textContent?.toLowerCase().includes('saved'))) {
            return true;
          }
        }
        return false;
      }, { timeout: 30000 }).catch(() => null)
    ]);

    if (successIndicator) {
      console.log('GIF creation completed successfully');
    } else {
      console.log('No success indicator found, checking for GIF in storage anyway...');
    }

    // Wait a bit for storage operations to complete
    await page.waitForTimeout(2000);

    // Check IndexedDB for saved GIF
    const savedGifCount = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const dbName = 'YouTubeGifStore';
        const request = indexedDB.open(dbName, 3);
        
        request.onerror = () => {
          console.error('Failed to open IndexedDB');
          resolve(0);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('gifs')) {
            console.log('No gifs object store found');
            resolve(0);
            return;
          }
          
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const countRequest = store.count();
          
          countRequest.onsuccess = () => {
            const count = countRequest.result;
            console.log(`Found ${count} GIFs in storage`);
            
            // Also try to get all GIFs to see their data
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
              const gifs = getAllRequest.result;
              console.log('Stored GIFs:', gifs.map(g => ({
                id: g.id,
                title: g.title,
                hasBlob: !!g.blob,
                hasThumbnail: !!g.thumbnailBlob,
                metadata: g.metadata
              })));
              resolve(count);
            };
            getAllRequest.onerror = () => resolve(count);
          };
          
          countRequest.onerror = () => {
            console.error('Failed to count GIFs');
            resolve(0);
          };
        };
        
        request.onupgradeneeded = () => {
          console.log('Database needs upgrade');
          resolve(0);
        };
      });
    });

    console.log(`Total GIFs in storage: ${savedGifCount}`);
    
    // Verify at least one GIF was saved
    expect(savedGifCount).toBeGreaterThan(0);
    
    // Additional verification: Check if we can open the popup and see the GIF
    console.log('Opening extension popup to verify GIF in library...');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for popup to load
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(2000);
    
    // Click on Library tab if needed
    const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (libraryTab) {
      await libraryTab.click();
      console.log('Clicked Library tab');
      await popupPage.waitForTimeout(1000);
    }
    
    // Check for GIF items in the library
    const gifItems = await popupPage.$$('[class*="gif-item"], [class*="gif-card"], img[alt*="GIF"], .library-item');
    console.log(`Found ${gifItems.length} GIF items in library UI`);
    
    // Also check for any "empty library" messages
    const emptyMessage = await popupPage.$('text=/No GIFs yet|empty|no items/i');
    if (emptyMessage) {
      console.log('Found empty library message - GIFs may not be displaying correctly');
    }
    
    // Take screenshots for debugging
    await page.screenshot({ path: 'test-results/gif-creation-page.png', fullPage: true });
    await popupPage.screenshot({ path: 'test-results/gif-library-popup.png', fullPage: true });
    
    console.log('Test completed. Screenshots saved to test-results/');
    
    // Final assertion
    expect(savedGifCount).toBeGreaterThan(0);
    if (gifItems.length === 0 && savedGifCount > 0) {
      console.warn('GIFs are in storage but not displaying in UI - may need to check rendering');
    }
  });

  test('verify GIF data structure in storage', async () => {
    console.log('Verifying GIF data structure...');
    
    if (!page) {
      page = await context.newPage();
      await page.goto(TEST_VIDEO_URL);
    }
    
    const gifData = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const dbName = 'YouTubeGifStore';
        const request = indexedDB.open(dbName, 3);
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['gifs'], 'readonly');
          const store = transaction.objectStore('gifs');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const gifs = getAllRequest.result;
            if (gifs.length > 0) {
              const firstGif = gifs[0];
              resolve({
                hasId: !!firstGif.id,
                hasTitle: !!firstGif.title,
                hasBlob: !!firstGif.blob,
                hasThumbnail: !!firstGif.thumbnailBlob,
                hasMetadata: !!firstGif.metadata,
                metadataKeys: firstGif.metadata ? Object.keys(firstGif.metadata) : [],
                blobSize: firstGif.blob ? firstGif.blob.size : 0,
                thumbnailSize: firstGif.thumbnailBlob ? firstGif.thumbnailBlob.size : 0
              });
            } else {
              resolve(null);
            }
          };
        };
      });
    });
    
    console.log('GIF data structure:', gifData);
    
    if (gifData) {
      expect(gifData.hasId).toBeTruthy();
      expect(gifData.hasTitle).toBeTruthy();
      expect(gifData.hasBlob).toBeTruthy();
      expect(gifData.blobSize).toBeGreaterThan(0);
      expect(gifData.hasMetadata).toBeTruthy();
      expect(gifData.metadataKeys).toContain('width');
      expect(gifData.metadataKeys).toContain('height');
      expect(gifData.metadataKeys).toContain('duration');
      console.log('✓ GIF data structure is valid');
    } else {
      console.log('No GIF data found in storage');
    }
  });
});