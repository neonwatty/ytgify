import { chromium, BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const EXTENSION_PATH = path.resolve(__dirname, '../dist');
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots');
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video (short)

async function setupEngagementData(context: BrowserContext, gifCount: number, daysAgo: number) {
  // Inject engagement data into chrome.storage.local
  const page = await context.newPage();
  await page.goto('chrome://extensions/');

  await page.evaluate(async ({ gifCount, daysAgo }) => {
    const installDate = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
    const engagementData = {
      installDate,
      totalGifsCreated: gifCount,
      prompts: {
        primary: { shown: false },
        secondary: { shown: false }
      },
      milestones: {
        milestone10: gifCount >= 10,
        milestone25: gifCount >= 25,
        milestone50: gifCount >= 50
      },
      popupFooterDismissed: false
    };

    await chrome.storage.local.set({ 'engagement-data': engagementData });
  }, { gifCount, daysAgo });

  await page.close();
}

async function takeScreenshot(page: any, name: string) {
  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved: ${name}.png`);
}

async function main() {
  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  console.log('Launching Chrome with extension...');
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
  });

  try {
    // Scenario 1: QuickCapture screen (default state)
    console.log('\n=== Capturing QuickCapture Screen ===');
    const page1 = await browser.newPage();
    await page1.goto(YOUTUBE_URL, { waitUntil: 'networkidle' });
    await page1.waitForTimeout(3000);

    // Find and click the YTGify button
    const ytgButton = page1.locator('[data-ytgify-button="true"]');
    if (await ytgButton.count() > 0) {
      await ytgButton.click();
      await page1.waitForTimeout(1000);
      await takeScreenshot(page1, '01-quickcapture-screen');
    }
    await page1.close();

    // Scenario 2: Text Overlay screen
    console.log('\n=== Capturing Text Overlay Screen ===');
    const page2 = await browser.newPage();
    await page2.goto(YOUTUBE_URL, { waitUntil: 'networkidle' });
    await page2.waitForTimeout(3000);

    const ytgButton2 = page2.locator('[data-ytgify-button="true"]');
    if (await ytgButton2.count() > 0) {
      await ytgButton2.click();
      await page2.waitForTimeout(1000);

      // Click "Next" to go to Text Overlay screen
      const nextButton = page2.locator('button:has-text("Next")');
      if (await nextButton.count() > 0) {
        await nextButton.click();
        await page2.waitForTimeout(500);
        await takeScreenshot(page2, '02-text-overlay-screen');
      }
    }
    await page2.close();

    // Scenario 3: Success Screen (with share link)
    console.log('\n=== Capturing Success Screen ===');
    await setupEngagementData(browser, 5, 10); // 5 GIFs, 10 days - doesn't qualify yet

    const page3 = await browser.newPage();
    await page3.goto(YOUTUBE_URL, { waitUntil: 'networkidle' });
    await page3.waitForTimeout(3000);

    // Need to actually create a GIF to see success screen
    // For now, we'll use mock data or skip this
    // This would require full GIF creation which is complex
    console.log('Success screen requires full GIF creation - skipping for now');
    await page3.close();

    // Scenario 4: Feedback Screen (with support section)
    console.log('\n=== Capturing Feedback Screen ===');
    // Similar to Success screen, requires full GIF creation
    console.log('Feedback screen requires full GIF creation - skipping for now');

    // Scenario 5: Milestone Screen (10 GIFs)
    console.log('\n=== Capturing Milestone Screen (10 GIFs) ===');
    await setupEngagementData(browser, 10, 15); // Exactly 10 GIFs, milestone not shown yet

    const page5 = await browser.newPage();
    await page5.goto(YOUTUBE_URL, { waitUntil: 'networkidle' });
    await page5.waitForTimeout(3000);

    // Would need to increment to trigger milestone
    console.log('Milestone screen requires GIF creation to trigger - skipping for now');
    await page5.close();

    // Scenario 6: Popup with CTAs
    console.log('\n=== Capturing Popup Screen ===');
    const page6 = await browser.newPage();
    await page6.goto('chrome://extensions/', { waitUntil: 'networkidle' });
    await page6.waitForTimeout(2000);

    // Find extension and click on popup
    // This is complex with Playwright - would need to find extension ID first
    console.log('Popup screen requires extension popup interaction - manual capture needed');
    await page6.close();

    console.log('\n=== Screenshot capture complete ===');
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
