#!/usr/bin/env ts-node

/**
 * Script to capture screenshots of all CTA features in the YTGify extension
 * Run with: npx ts-node scripts/capture-cta-screenshots.ts
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Short YouTube video

interface ScreenshotConfig {
  name: string;
  setup?: (context: BrowserContext) => Promise<void>;
  action: (page: Page) => Promise<void>;
}

async function setupEngagementData(
  context: BrowserContext,
  options: {
    gifCount: number;
    daysAgo: number;
    milestone10?: boolean;
    milestone25?: boolean;
    milestone50?: boolean;
    primaryShown?: boolean;
    primaryDismissed?: boolean;
  }
) {
  const page = await context.newPage();

  await page.evaluate(async (opts) => {
    const installDate = Date.now() - (opts.daysAgo * 24 * 60 * 60 * 1000);
    const engagementData = {
      installDate,
      totalGifsCreated: opts.gifCount,
      prompts: {
        primary: {
          shown: opts.primaryShown || false,
          ...(opts.primaryDismissed ? { dismissedAt: Date.now() - 3600000 } : {})
        },
        secondary: { shown: false }
      },
      milestones: {
        milestone10: opts.milestone10 !== undefined ? opts.milestone10 : opts.gifCount >= 10,
        milestone25: opts.milestone25 !== undefined ? opts.milestone25 : opts.gifCount >= 25,
        milestone50: opts.milestone50 !== undefined ? opts.milestone50 : opts.gifCount >= 50
      },
      popupFooterDismissed: false
    };

    await chrome.storage.local.set({ 'engagement-data': engagementData });
    console.log('[Setup] Engagement data configured:', engagementData);
  }, options);

  await page.close();
}

async function waitForWizard(page: Page): Promise<void> {
  await page.waitForSelector('[data-ytgify-wizard="true"]', { timeout: 5000 });
  await page.waitForTimeout(500); // Let animations settle
}

async function takeScreenshot(page: Page, name: string) {
  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);

  // Find the wizard overlay to screenshot just that element
  const wizard = await page.$('[data-ytgify-wizard="true"]');
  if (wizard) {
    await wizard.screenshot({ path: screenshotPath });
    console.log(`✓ Screenshot saved: ${name}.png`);
  } else {
    console.log(`✗ Wizard not found for: ${name}`);
  }
}

async function main() {
  console.log('🎬 Starting CTA Screenshot Capture\n');

  const userDataDir = path.join(__dirname, 'temp-user-data-' + Date.now());

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false, // Set to true for automated runs
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    viewport: { width: 1920, height: 1080 },
  });

  try {
    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📸 Capturing wizard screens...\n');

    // === 1. QuickCapture Screen ===
    console.log('1️⃣  QuickCapture Screen');
    const page1 = await context.newPage();
    await page1.goto(YOUTUBE_URL, { waitUntil: 'domcontentloaded' });
    await page1.waitForTimeout(3000);

    const ytgButton1 = await page1.$('[data-ytgify-button="true"]');
    if (ytgButton1) {
      await ytgButton1.click();
      await waitForWizard(page1);
      await takeScreenshot(page1, '01-quickcapture-screen');
    } else {
      console.log('   ✗ YTGify button not found');
    }
    await page1.close();

    // === 2. Text Overlay Screen ===
    console.log('2️⃣  Text Overlay Screen');
    const page2 = await context.newPage();
    await page2.goto(YOUTUBE_URL, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(3000);

    const ytgButton2 = await page2.$('[data-ytgify-button="true"]');
    if (ytgButton2) {
      await ytgButton2.click();
      await waitForWizard(page2);

      const nextButton = await page2.$('button:has-text("Next")');
      if (nextButton) {
        await nextButton.click();
        await page2.waitForTimeout(500);
        await takeScreenshot(page2, '02-text-overlay-screen');
      }
    }
    await page2.close();

    console.log('\n📸 Capturing CTA-enhanced screens...\n');

    // === 3. Milestone Screen (10 GIFs) ===
    console.log('3️⃣  Milestone Screen (10 GIFs)');
    // Note: This requires triggering the milestone after creating a GIF
    // For now, we'll document that this needs manual capture
    console.log('   ℹ️  Requires GIF creation to trigger - manual capture needed');

    // === 4. Success Screen with Share Link ===
    console.log('4️⃣  Success Screen with Share Link');
    console.log('   ℹ️  Requires GIF creation - manual capture needed');

    // === 5. Feedback Screen with Support Section ===
    console.log('5️⃣  Feedback Screen with Support Section');
    console.log('   ℹ️  Requires GIF creation - manual capture needed');

    console.log('\n📸 Capturing popup screens...\n');

    // === 6. Popup ===
    console.log('6️⃣  Popup (Main Library View)');
    const popupPage = await context.newPage();

    // Get extension ID
    const serviceWorkers = context.serviceWorkers();
    let extensionId = '';
    if (serviceWorkers.length > 0) {
      const url = serviceWorkers[0].url();
      const match = url.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) {
        extensionId = match[1];
      }
    }

    if (extensionId) {
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForTimeout(1000);

      await popupPage.screenshot({
        path: path.join(SCREENSHOTS_DIR, '06-popup-main.png'),
        fullPage: true
      });
      console.log('✓ Screenshot saved: 06-popup-main.png');
    } else {
      console.log('   ✗ Extension ID not found');
    }
    await popupPage.close();

    console.log('\n✅ Screenshot capture complete!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('\n⚠️  Note: Milestone, Success, and Feedback screens require actual GIF creation.');
    console.log('   To capture these:');
    console.log('   1. Build: npm run build');
    console.log('   2. Load extension in Chrome manually');
    console.log('   3. Create GIFs to trigger the screens');
    console.log('   4. Take screenshots manually');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await context.close();

    // Cleanup temp user data
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  }
}

main().catch(console.error);
