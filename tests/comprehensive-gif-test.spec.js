import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Comprehensive GIF Test', () => {
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

  test('complete GIF workflow: create, save, view, and persist', async () => {
    console.log('\n=== STEP 1: Create a GIF ===');
    const page = await context.newPage();
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button');
    await gifButton.click();
    
    // Wait for timeline overlay
    await page.waitForSelector('#ytgif-timeline-overlay', { state: 'attached' });
    await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
      }
    });
    await page.waitForTimeout(2000);
    
    // Click create button
    const createButton = await page.evaluateHandle(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      const buttons = overlay?.querySelectorAll('button') || [];
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create')) return btn;
      }
      return null;
    });
    
    if (createButton) {
      await createButton.click();
      console.log('Creating GIF...');
      
      // Wait for success feedback
      await page.waitForFunction(() => {
        const feedbacks = document.querySelectorAll('.ytgif-feedback--success');
        return feedbacks.length > 0;
      }, { timeout: 30000 });
      
      console.log('✅ GIF created successfully');
      await page.waitForTimeout(2000);
    }
    
    console.log('\n=== STEP 2: Check storage immediately ===');
    // Wait a bit for storage to be saved
    await page.waitForTimeout(3000);
    
    // Get extension ID if not already available
    if (!extensionId) {
      const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      extensionId = serviceWorker.url().split('://')[1].split('/')[0];
    }
    
    // Check storage from popup context where chrome.storage is available
    const popupPageForStorage = await context.newPage();
    await popupPageForStorage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    const storageAfterCreation = await popupPageForStorage.evaluate(async () => {
      const result = await chrome.storage.local.get('stored_gifs');
      return {
        count: result.stored_gifs ? result.stored_gifs.length : 0,
        firstGifId: result.stored_gifs?.[0]?.id
      };
    });
    console.log('Storage after creation:', storageAfterCreation);
    expect(storageAfterCreation.count).toBeGreaterThan(0);
    await popupPageForStorage.close();
    
    console.log('\n=== STEP 3: Open popup and check library ===');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(2000);
    
    // Click Library tab
    const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (libraryTab) {
      await libraryTab.click();
      await popupPage.waitForTimeout(1500);
    }
    
    // Check library content
    const libraryContent = await popupPage.evaluate(() => {
      const cards = document.querySelectorAll('.shadow-sm');
      const titles = Array.from(document.querySelectorAll('h3')).map(h => h.textContent);
      const images = document.querySelectorAll('img');
      const downloadButtons = Array.from(document.querySelectorAll('button')).filter(
        btn => btn.textContent?.toLowerCase().includes('download')
      );
      
      return {
        cardCount: cards.length,
        titleList: titles,
        imageCount: images.length,
        downloadButtonCount: downloadButtons.length,
        hasEmptyMessage: titles.some(t => t?.includes('No GIFs'))
      };
    });
    
    console.log('Library content:', libraryContent);
    expect(libraryContent.cardCount).toBeGreaterThan(0);
    expect(libraryContent.hasEmptyMessage).toBe(false);
    
    // Take screenshot of library
    await popupPage.screenshot({ 
      path: 'test-results/comprehensive-test-library.png', 
      fullPage: true 
    });
    console.log('✅ Library displays GIF correctly');
    
    console.log('\n=== STEP 4: Close and reopen popup to test persistence ===');
    await popupPage.close();
    await page.waitForTimeout(2000);
    
    // Reopen popup
    const newPopupPage = await context.newPage();
    await newPopupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopupPage.waitForLoadState('domcontentloaded');
    await newPopupPage.waitForTimeout(2000);
    
    // Click Library tab again
    const newLibraryTab = await newPopupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (newLibraryTab) {
      await newLibraryTab.click();
      await newPopupPage.waitForTimeout(1500);
    }
    
    // Check if GIF persisted
    const persistedContent = await newPopupPage.evaluate(() => {
      const cards = document.querySelectorAll('.shadow-sm');
      return {
        cardCount: cards.length,
        firstCardExists: cards.length > 0
      };
    });
    
    console.log('Persisted content after reopening:', persistedContent);
    expect(persistedContent.cardCount).toBeGreaterThan(0);
    console.log('✅ GIF persisted after popup reload');
    
    console.log('\n=== STEP 5: Verify chrome.storage data integrity ===');
    const finalStorageCheck = await newPopupPage.evaluate(async () => {
      const result = await chrome.storage.local.get('stored_gifs');
      const gifs = result.stored_gifs || [];
      return {
        totalGifs: gifs.length,
        firstGif: gifs[0] ? {
          hasId: !!gifs[0].id,
          hasTitle: !!gifs[0].title,
          hasDataUrl: !!gifs[0].gifDataUrl,
          dataUrlStartsWith: gifs[0].gifDataUrl?.substring(0, 30),
          metadata: {
            width: gifs[0].metadata?.width,
            height: gifs[0].metadata?.height,
            duration: gifs[0].metadata?.duration
          }
        } : null
      };
    });
    
    console.log('Final storage check:', finalStorageCheck);
    expect(finalStorageCheck.totalGifs).toBeGreaterThan(0);
    expect(finalStorageCheck.firstGif?.hasDataUrl).toBe(true);
    expect(finalStorageCheck.firstGif?.dataUrlStartsWith).toContain('data:image/gif');
    
    console.log('\n=== SUMMARY ===');
    console.log('✅ GIF creation: SUCCESS');
    console.log('✅ Storage saving: SUCCESS');
    console.log('✅ Library display: SUCCESS');
    console.log('✅ Data persistence: SUCCESS');
    console.log('✅ Data integrity: SUCCESS');
    
    // Final screenshot
    await newPopupPage.screenshot({ 
      path: 'test-results/comprehensive-test-final.png', 
      fullPage: true 
    });
    
    await page.close();
    await newPopupPage.close();
  });
});