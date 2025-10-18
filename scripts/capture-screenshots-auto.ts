#!/usr/bin/env ts-node

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

async function main() {
  console.log('🎬 Automated Screenshot Capture\n');

  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const userDataDir = path.join(__dirname, 'temp-user-data-' + Date.now());

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${DIST_DIR}`,
      `--load-extension=${DIST_DIR}`,
      '--no-sandbox',
    ],
    viewport: { width: 1920, height: 1080 },
  });

  try {
    console.log('⏳ Waiting for extension to load...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    const page = await context.newPage();
    console.log('📺 Navigating to YouTube...');
    await page.goto(YOUTUBE_URL);

    // Wait for YouTube video player to be ready
    console.log('⏳ Waiting for YouTube to load...');
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForSelector('.ytp-chrome-bottom', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('🔍 Looking for YTGify button...');

    // Try multiple selectors
    const selectors = [
      '[data-ytgify-button="true"]',
      'button[aria-label*="YTGify"]',
      'button:has-text("YTGify")',
      '.ytgify-button',
    ];

    let ytgButton = null;
    for (const selector of selectors) {
      ytgButton = await page.$(selector);
      if (ytgButton) {
        console.log(`✓ Found button with selector: ${selector}`);
        break;
      }
    }

    if (!ytgButton) {
      console.log('❌ YTGify button not found. Possible reasons:');
      console.log('   - Extension not fully loaded');
      console.log('   - YouTube page structure changed');
      console.log('   - Button visibility setting is off');
      console.log('\n💡 Tip: Check chrome://extensions and ensure YTGify is enabled');

      // Take a full page screenshot for debugging
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'debug-no-button.png'),
        fullPage: false
      });
      console.log('📸 Debug screenshot saved: debug-no-button.png');

      // Check if extension is loaded
      const serviceWorkers = context.serviceWorkers();
      console.log(`\n🔧 Service workers found: ${serviceWorkers.length}`);
      if (serviceWorkers.length > 0) {
        console.log(`   Extension URL: ${serviceWorkers[0].url()}`);
      }

      // Keep browser open for manual interaction
      console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      await context.close();
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
      return;
    }

    // === 1. QuickCapture Screen ===
    console.log('\n1️⃣  Capturing QuickCapture Screen...');
    await ytgButton.click();

    await page.waitForSelector('[data-ytgify-wizard="true"]', { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const wizard = await page.$('[data-ytgify-wizard="true"]');
    if (wizard) {
      await wizard.screenshot({
        path: path.join(SCREENSHOTS_DIR, '01-quickcapture-screen.png')
      });
      console.log('   ✓ Screenshot saved: 01-quickcapture-screen.png');
    }

    // === 2. Text Overlay Screen ===
    console.log('2️⃣  Capturing Text Overlay Screen...');
    const nextButton = await page.$('button:has-text("Next")');
    if (nextButton) {
      await nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 800));

      const wizard2 = await page.$('[data-ytgify-wizard="true"]');
      if (wizard2) {
        await wizard2.screenshot({
          path: path.join(SCREENSHOTS_DIR, '02-text-overlay-screen.png')
        });
        console.log('   ✓ Screenshot saved: 02-text-overlay-screen.png');
      }
    }

    // === 3. Text Overlay with text entered ===
    console.log('3️⃣  Capturing Text Overlay with text...');
    const textInput = await page.$('input[type="text"], textarea');
    if (textInput) {
      await textInput.fill('Sample GIF Text');
      await new Promise(resolve => setTimeout(resolve, 500));

      const wizard3 = await page.$('[data-ytgify-wizard="true"]');
      if (wizard3) {
        await wizard3.screenshot({
          path: path.join(SCREENSHOTS_DIR, '03-text-overlay-with-text.png')
        });
        console.log('   ✓ Screenshot saved: 03-text-overlay-with-text.png');
      }
    }

    console.log('\n✅ Automated screenshots captured successfully!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOTS_DIR}`);

    console.log('\n⚠️  Note: For Success, Feedback, and Milestone screens:');
    console.log('   - These require full GIF creation');
    console.log('   - Please create GIFs manually to see these screens');
    console.log('   - The browser will stay open for 1 minute for manual capture...');

    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await context.close();
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  }
}

main().catch(console.error);
