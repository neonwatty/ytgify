import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Real World GIF Creation Test', () => {
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

  test('complete GIF creation flow with debug logging', async () => {
    // Step 1: Set up console logging
    console.log('\n============================================');
    console.log('REAL WORLD GIF CREATION TEST');
    console.log('============================================\n');

    const page = await context.newPage();
    
    // Capture ALL console messages
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      
      // Log important messages
      if (text.includes('[ChromeGifStorage]') || 
          text.includes('[Content]') || 
          text.includes('[LibraryView]') ||
          text.includes('GIF') ||
          text.includes('storage')) {
        console.log(`[${msg.type()}] ${text}`);
      }
    });

    // Capture errors
    page.on('pageerror', error => {
      console.error('Page Error:', error.message);
    });

    // Step 2: Navigate and create GIF
    console.log('\n--- STEP 1: Navigate to YouTube ---');
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    console.log('\n--- STEP 2: Click GIF button ---');
    const gifButton = await page.waitForSelector('.ytgif-button');
    expect(gifButton).toBeTruthy();
    await gifButton.click();
    
    await page.waitForSelector('#ytgif-timeline-overlay', { state: 'attached' });
    await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
      }
    });
    await page.waitForTimeout(2000);
    
    console.log('\n--- STEP 3: Create GIF ---');
    const createButton = await page.evaluateHandle(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      const buttons = overlay?.querySelectorAll('button') || [];
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create')) return btn;
      }
      return null;
    });
    
    expect(createButton).toBeTruthy();
    await createButton.click();
    
    // Wait for completion (either preview or feedback)
    console.log('\n--- STEP 4: Wait for completion ---');
    const completionResult = await Promise.race([
      page.waitForSelector('.ytgif-preview-modal', { timeout: 30000 }).then(() => 'preview'),
      page.waitForSelector('.ytgif-feedback--success', { timeout: 30000 }).then(() => 'feedback'),
      new Promise(resolve => setTimeout(() => resolve('timeout'), 30000))
    ]);
    
    console.log(`Completion result: ${completionResult}`);
    
    // Give extra time for storage operations
    await page.waitForTimeout(3000);
    
    // Step 5: Check storage directly from content script
    console.log('\n--- STEP 5: Check chrome.storage from content script context ---');
    const contentStorageCheck = await page.evaluate(async () => {
      // Try to access chrome.storage from content script
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const result = await chrome.storage.local.get('stored_gifs');
          return {
            success: true,
            hasStorage: true,
            hasKey: 'stored_gifs' in result,
            count: result.stored_gifs ? result.stored_gifs.length : 0,
            gifs: result.stored_gifs || []
          };
        } else {
          return {
            success: false,
            hasStorage: false,
            error: 'chrome.storage not available in content script'
          };
        }
      } catch (error) {
        return {
          success: false,
          hasStorage: false,
          error: error.message
        };
      }
    });
    
    console.log('Content script storage check:', JSON.stringify(contentStorageCheck, null, 2));
    
    // Step 6: Check storage from popup context
    console.log('\n--- STEP 6: Check chrome.storage from popup context ---');
    const popupPage = await context.newPage();
    
    // Capture popup console
    popupPage.on('console', msg => {
      const text = msg.text();
      if (text.includes('[LibraryView]') || text.includes('[ChromeGifStorage]')) {
        console.log(`[Popup ${msg.type()}] ${text}`);
      }
    });
    
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1000);
    
    const popupStorageCheck = await popupPage.evaluate(async () => {
      try {
        const result = await chrome.storage.local.get('stored_gifs');
        return {
          success: true,
          hasKey: 'stored_gifs' in result,
          count: result.stored_gifs ? result.stored_gifs.length : 0,
          gifs: result.stored_gifs ? result.stored_gifs.map(g => ({
            id: g.id,
            title: g.title,
            hasDataUrl: !!g.gifDataUrl,
            dataUrlLength: g.gifDataUrl ? g.gifDataUrl.length : 0
          })) : []
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('Popup storage check:', JSON.stringify(popupStorageCheck, null, 2));
    
    // Step 7: Check library UI
    console.log('\n--- STEP 7: Check Library UI ---');
    
    // Click Library tab
    const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (libraryTab) {
      await libraryTab.click();
      await popupPage.waitForTimeout(2000);
    }
    
    const libraryUICheck = await popupPage.evaluate(() => {
      const cards = document.querySelectorAll('.shadow-sm');
      const emptyMessage = Array.from(document.querySelectorAll('*')).find(
        el => el.textContent?.includes('No GIFs yet')
      );
      const gifCount = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.match(/\d+ GIF/)
      );
      
      // Check React state if possible
      const reactFiberKey = Object.keys(document.querySelector('#root') || {}).find(
        key => key.startsWith('__reactFiber')
      );
      
      return {
        cardCount: cards.length,
        hasEmptyMessage: !!emptyMessage,
        emptyMessageText: emptyMessage?.textContent,
        gifCountText: gifCount?.textContent,
        reactFiberPresent: !!reactFiberKey,
        bodyHTML: document.body.innerHTML.substring(0, 500) // First 500 chars for debug
      };
    });
    
    console.log('Library UI check:', JSON.stringify(libraryUICheck, null, 2));
    
    // Step 8: Take screenshots
    console.log('\n--- STEP 8: Taking screenshots ---');
    await page.screenshot({ path: 'test-results/real-world-youtube.png', fullPage: true });
    await popupPage.screenshot({ path: 'test-results/real-world-popup.png', fullPage: true });
    
    // Step 9: Summary
    console.log('\n============================================');
    console.log('TEST SUMMARY');
    console.log('============================================');
    console.log(`Completion type: ${completionResult}`);
    console.log(`Content script storage: ${contentStorageCheck.count} GIFs`);
    console.log(`Popup storage: ${popupStorageCheck.count} GIFs`);
    console.log(`Library UI cards: ${libraryUICheck.cardCount}`);
    console.log(`Has empty message: ${libraryUICheck.hasEmptyMessage}`);
    
    // Log all captured console messages for debugging
    console.log('\n--- ALL CONSOLE LOGS ---');
    consoleLogs.slice(-20).forEach(log => console.log(log));
    
    // Assertions
    if (contentStorageCheck.success && contentStorageCheck.hasStorage) {
      expect(contentStorageCheck.count).toBeGreaterThan(0);
    } else {
      console.warn('⚠️ Content script cannot access chrome.storage - this is the issue!');
    }
    
    expect(popupStorageCheck.count).toBeGreaterThan(0);
    expect(libraryUICheck.cardCount).toBeGreaterThan(0);
    expect(libraryUICheck.hasEmptyMessage).toBe(false);
    
    await page.close();
    await popupPage.close();
  });
});