import { test, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test('debug storage issue', async () => {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox'
    ],
    viewport: { width: 1280, height: 720 }
  });

  const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = serviceWorker.url().split('://')[1].split('/')[0];

  // 1. Navigate to YouTube and create a GIF
  const page = await context.newPage();
  
  page.on('console', msg => {
    console.log('Page:', msg.text());
  });

  await page.goto(TEST_VIDEO_URL);
  await page.waitForSelector('video', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  console.log('\n=== Creating GIF ===');
  const gifButton = await page.waitForSelector('.ytgif-button');
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
    console.log('Clicked create button, waiting for completion...');
    
    // Wait for success feedback
    await page.waitForFunction(() => {
      const feedbacks = document.querySelectorAll('.ytgif-feedback--success');
      return feedbacks.length > 0;
    }, { timeout: 30000 }).catch(() => console.log('No success feedback found'));
    
    await page.waitForTimeout(5000); // Give it extra time to save
  }
  
  // 2. Check storage directly from the popup context
  console.log('\n=== Checking chrome.storage from popup ===');
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  
  const storageData = await popupPage.evaluate(async () => {
    const result = await chrome.storage.local.get('stored_gifs');
    return {
      hasKey: 'stored_gifs' in result,
      count: result.stored_gifs ? result.stored_gifs.length : 0,
      gifs: result.stored_gifs || []
    };
  });
  
  console.log('Storage check result:', {
    hasKey: storageData.hasKey,
    count: storageData.count,
    gifsFound: storageData.gifs.map(g => ({
      id: g.id,
      title: g.title,
      hasDataUrl: !!g.gifDataUrl,
      dataUrlLength: g.gifDataUrl ? g.gifDataUrl.length : 0
    }))
  });
  
  // 3. Check what the library component sees
  console.log('\n=== Loading library view ===');
  await popupPage.waitForTimeout(2000);
  
  const libraryTab = await popupPage.$('button:has-text("Library"), [role="tab"]:has-text("Library")');
  if (libraryTab) {
    await libraryTab.click();
    await popupPage.waitForTimeout(2000);
  }
  
  const libraryContent = await popupPage.evaluate(() => {
    const cards = document.querySelectorAll('.shadow-sm');
    const emptyMessage = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent?.includes('No GIFs yet')
    );
    const countElement = Array.from(document.querySelectorAll('span')).find(
      el => el.textContent?.includes('GIF')
    );
    
    // Log what React components are doing
    console.log('DOM inspection:', {
      cardCount: cards.length,
      hasEmptyMessage: !!emptyMessage,
      countText: countElement?.textContent
    });
    
    return {
      cardCount: cards.length,
      hasEmptyMessage: !!emptyMessage,
      countText: countElement?.textContent
    };
  });
  
  console.log('Library UI result:', libraryContent);
  
  // 4. Check if there's a console error
  popupPage.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Popup Error:', msg.text());
    }
  });
  
  // 5. Try to manually trigger a reload
  console.log('\n=== Manually reloading library ===');
  await popupPage.evaluate(async () => {
    // Try to force React to reload
    const event = new Event('storage');
    window.dispatchEvent(event);
  });
  
  await popupPage.waitForTimeout(2000);
  
  // Check again
  const reloadedContent = await popupPage.evaluate(() => {
    const cards = document.querySelectorAll('.shadow-sm');
    return { cardCount: cards.length };
  });
  
  console.log('After reload:', reloadedContent);
  
  // Take screenshots
  await popupPage.screenshot({ path: 'test-results/debug-popup.png', fullPage: true });
  await page.screenshot({ path: 'test-results/debug-content.png', fullPage: true });
  
  await context.close();
});