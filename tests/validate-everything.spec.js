import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test('VALIDATE: Complete GIF creation and library', async ({ }, testInfo) => {
  testInfo.setTimeout(60000); // 60 second timeout
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox'
    ]
  });

  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = serviceWorker.url().split('://')[1].split('/')[0];

  // 1. Create GIF
  console.log('📹 Creating GIF from YouTube...');
  const page = await context.newPage();
  await page.goto(TEST_VIDEO_URL);
  await page.waitForSelector('video', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Click GIF button
  const gifButton = await page.waitForSelector('.ytgif-button');
  await gifButton.click();
  
  // Wait for timeline
  await page.waitForSelector('#ytgif-timeline-overlay', { state: 'visible' });
  await page.waitForTimeout(1000);
  
  // Click create
  const createButton = await page.evaluateHandle(() => {
    const buttons = document.querySelectorAll('#ytgif-timeline-overlay button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('Create')) return btn;
    }
  });
  await createButton.click();
  
  // 2. Wait for completion (preview or feedback)
  console.log('⏳ Waiting for GIF creation...');
  const completed = await Promise.race([
    page.waitForSelector('.ytgif-preview-modal', { timeout: 30000 })
      .then(() => {
        console.log('✅ Preview modal appeared!');
        return true;
      }),
    page.waitForSelector('.ytgif-feedback--success', { timeout: 30000 })
      .then(() => {
        console.log('✅ Success feedback shown!');
        return true;
      })
  ]).catch(() => false);
  
  expect(completed).toBe(true);
  await page.waitForTimeout(2000);
  
  // 3. Open popup and check library
  console.log('📚 Checking library...');
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await popupPage.waitForTimeout(1000);
  
  // Click Library tab
  const libraryTab = await popupPage.waitForSelector('button:has-text("Library"), [role="tab"]:has-text("Library")');
  await libraryTab.click();
  await popupPage.waitForTimeout(1000);
  
  // Check for GIFs
  const libraryStatus = await popupPage.evaluate(() => {
    const cards = document.querySelectorAll('.shadow-sm').length;
    const countText = Array.from(document.querySelectorAll('span'))
      .find(el => el.textContent?.match(/\d+ GIF/))?.textContent;
    const hasEmptyMessage = !!Array.from(document.querySelectorAll('*'))
      .find(el => el.textContent?.includes('No GIFs yet'));
    
    return { cards, countText, hasEmptyMessage };
  });
  
  console.log('📊 Library status:', libraryStatus);
  
  // 4. Verify storage
  const storageCheck = await popupPage.evaluate(async () => {
    const result = await chrome.storage.local.get('stored_gifs');
    return {
      count: result.stored_gifs?.length || 0,
      firstGif: result.stored_gifs?.[0] ? {
        id: result.stored_gifs[0].id,
        title: result.stored_gifs[0].title,
        hasData: !!result.stored_gifs[0].gifDataUrl
      } : null
    };
  });
  
  console.log('💾 Storage check:', storageCheck);
  
  // Take screenshots
  await popupPage.screenshot({ path: 'test-results/final-library.png', fullPage: true });
  
  // Final assertions
  console.log('\n✨ RESULTS:');
  console.log(`  - GIFs in storage: ${storageCheck.count}`);
  console.log(`  - Cards in library: ${libraryStatus.cards}`);
  console.log(`  - Count text: ${libraryStatus.countText}`);
  console.log(`  - Has empty message: ${libraryStatus.hasEmptyMessage}`);
  
  expect(storageCheck.count).toBeGreaterThan(0);
  expect(libraryStatus.cards).toBeGreaterThan(0);
  expect(libraryStatus.hasEmptyMessage).toBe(false);
  
  console.log('\n✅ ALL CHECKS PASSED!');
  
  await context.close();
});