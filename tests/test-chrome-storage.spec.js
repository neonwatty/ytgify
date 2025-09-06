import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('Chrome Storage Test', () => {
  let context;
  let extensionId;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox'
      ]
    });

    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = serviceWorker.url().split('://')[1].split('/')[0];
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('verify chrome.storage.local works for GIFs', async () => {
    // Create and save a GIF
    const page = await context.newPage();
    
    page.on('console', msg => {
      if (msg.text().includes('GIF') || msg.text().includes('chrome.storage')) {
        console.log('Page:', msg.text());
      }
    });
    
    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Click GIF button
    const gifButton = await page.waitForSelector('.ytgif-button');
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
      const buttons = overlay?.querySelectorAll('button') || [];
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create')) return btn;
      }
      return null;
    });
    
    if (createButton) {
      await createButton.click();
      console.log('Creating GIF...');
      
      // Wait for feedback
      await page.waitForFunction(() => {
        const feedbacks = document.querySelectorAll('.ytgif-feedback--success');
        return feedbacks.length > 0;
      }, { timeout: 30000 }).catch(() => {});
      
      await page.waitForTimeout(3000);
    }
    
    // Check chrome.storage.local from popup
    console.log('\n=== Checking chrome.storage.local ===');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    const storageData = await popupPage.evaluate(async () => {
      const result = await chrome.storage.local.get('stored_gifs');
      return {
        hasData: !!result.stored_gifs,
        count: result.stored_gifs ? result.stored_gifs.length : 0,
        firstGif: result.stored_gifs?.[0] ? {
          id: result.stored_gifs[0].id,
          title: result.stored_gifs[0].title,
          hasDataUrl: !!result.stored_gifs[0].gifDataUrl,
          dataUrlLength: result.stored_gifs[0].gifDataUrl?.length || 0
        } : null
      };
    });
    
    console.log('Chrome storage data:', storageData);
    
    // Also check library UI
    await popupPage.waitForTimeout(2000);
    
    // Click library tab
    const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
    if (libraryTab) {
      await libraryTab.click();
      await popupPage.waitForTimeout(2000);
    }
    
    const libraryState = await popupPage.evaluate(() => {
      const gifCards = document.querySelectorAll('.shadow-sm');
      const emptyMessage = Array.from(document.querySelectorAll('h3')).find(
        el => el.textContent?.includes('No GIFs yet')
      );
      const countDisplay = Array.from(document.querySelectorAll('span')).find(
        el => el.textContent?.includes('GIF')
      );
      
      return {
        gifCardCount: gifCards.length,
        hasEmptyMessage: !!emptyMessage,
        countText: countDisplay?.textContent
      };
    });
    
    console.log('Library UI state:', libraryState);
    
    // Take screenshot
    await popupPage.screenshot({ path: 'test-results/chrome-storage-popup.png', fullPage: true });
    
    // Assertions
    if (storageData.count > 0) {
      console.log(`✅ Found ${storageData.count} GIF(s) in chrome.storage.local`);
      if (libraryState.gifCardCount > 0) {
        console.log(`✅ Library displays ${libraryState.gifCardCount} GIF card(s)`);
      } else {
        console.log('❌ Library UI not showing GIFs despite them being in storage');
      }
    } else {
      console.log('❌ No GIFs found in chrome.storage.local');
    }
    
    expect(storageData.count).toBeGreaterThan(0);
    expect(libraryState.hasEmptyMessage).toBe(false);
  });
});