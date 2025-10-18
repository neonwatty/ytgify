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
  console.log('🎬 Complete Screenshot Capture for YTGify CTAs\n');

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

    // Get extension ID
    const serviceWorkers = context.serviceWorkers();
    let extensionId = '';
    if (serviceWorkers.length > 0) {
      const url = serviceWorkers[0].url();
      const match = url.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) {
        extensionId = match[1];
        console.log(`✓ Extension loaded: ${extensionId}\n`);
      }
    }

    if (!extensionId) {
      throw new Error('Extension not loaded');
    }

    // === Step 1: Enable button visibility via popup ===
    console.log('🔧 Enabling button visibility...');
    const setupPage = await context.newPage();
    await setupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await setupPage.waitForTimeout(1000);

    // Use the popup's context which has chrome API access
    await setupPage.evaluate(async () => {
      await chrome.storage.sync.set({ buttonVisibility: true });
    });
    await setupPage.close();
    console.log('✓ Button visibility enabled\n');

    // === Step 2: Capture Popup ===
    console.log('📸 1. Capturing Popup...');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1500);
    await popupPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-popup-main.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: 01-popup-main.png\n');
    await popupPage.close();

    // === Step 3: Navigate to YouTube ===
    console.log('📺 2. Navigating to YouTube...');
    const page = await context.newPage();
    await page.goto(YOUTUBE_URL);
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForSelector('.ytp-chrome-bottom', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('   ✓ YouTube loaded\n');

    // === Step 4: Find and click YTGify button ===
    console.log('🔍 3. Looking for YTGify button...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for button injection

    const ytgButton = await page.$('[data-ytgify-button="true"]');
    if (!ytgButton) {
      console.log('   ✗ Button still not found - taking debug screenshot');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'debug-youtube-page.png')
      });
      console.log('   ✓ Saved: debug-youtube-page.png');
      console.log('\n   💡 Manual steps needed:');
      console.log('   1. The browser will stay open');
      console.log('   2. Click the YTGify button when it appears');
      console.log('   3. Manually take screenshots of each screen\n');

      console.log('⏸️  Keeping browser open for 5 minutes for manual capture...');
      await new Promise(resolve => setTimeout(resolve, 300000));
      await context.close();
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      }
      return;
    }

    console.log('   ✓ YTGify button found!\n');

    // === Step 5: QuickCapture Screen ===
    console.log('📸 4. Capturing QuickCapture Screen...');
    await ytgButton.click();
    await page.waitForSelector('[data-ytgify-wizard="true"]', { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    let wizard = await page.$('[data-ytgify-wizard="true"]');
    if (wizard) {
      await wizard.screenshot({
        path: path.join(SCREENSHOTS_DIR, '02-quickcapture-screen.png')
      });
      console.log('   ✓ Saved: 02-quickcapture-screen.png\n');
    }

    // === Step 6: Text Overlay Screen (Empty) ===
    console.log('📸 5. Capturing Text Overlay Screen (empty)...');
    const nextButton = await page.$('button:has-text("Next")');
    if (nextButton) {
      await nextButton.click();
      await new Promise(resolve => setTimeout(resolve, 800));

      wizard = await page.$('[data-ytgify-wizard="true"]');
      if (wizard) {
        await wizard.screenshot({
          path: path.join(SCREENSHOTS_DIR, '03-text-overlay-empty.png')
        });
        console.log('   ✓ Saved: 03-text-overlay-empty.png\n');
      }
    }

    // === Step 7: Text Overlay with Text ===
    console.log('📸 6. Capturing Text Overlay Screen (with text)...');
    const textInput = await page.$('input[placeholder*="text"], textarea');
    if (textInput) {
      await textInput.fill('Check out YTGify!');
      await new Promise(resolve => setTimeout(resolve, 500));

      wizard = await page.$('[data-ytgify-wizard="true"]');
      if (wizard) {
        await wizard.screenshot({
          path: path.join(SCREENSHOTS_DIR, '04-text-overlay-filled.png')
        });
        console.log('   ✓ Saved: 04-text-overlay-filled.png\n');
      }
    }

    console.log('✅ Automated screenshots complete!\n');
    console.log('📁 Screenshots saved to:', SCREENSHOTS_DIR, '\n');

    console.log('⚠️  For Success/Feedback/Milestone screens:');
    console.log('   These require creating an actual GIF.');
    console.log('   The browser will stay open for 5 minutes.');
    console.log('   Please:');
    console.log('   1. Click "Create GIF" to process a GIF');
    console.log('   2. Take screenshots of:');
    console.log('      - Processing screen');
    console.log('      - Success screen (with "Spread the word" link)');
    console.log('      - Feedback screen (with "Show Your Support" buttons)');
    console.log('   3. Create 10 GIFs to see Milestone celebration\n');

    console.log('⏸️  Browser staying open for 5 minutes...');
    await new Promise(resolve => setTimeout(resolve, 300000));

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
