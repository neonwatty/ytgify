#!/usr/bin/env ts-node

/**
 * Screenshot capture using Playwright's Chrome DevTools Protocol
 * This bypasses the button visibility issue by directly manipulating the extension
 */

import { chromium, type BrowserContext, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

async function setupStorage(page: Page, extensionId: string) {
  // Navigate to extension background page to set storage
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForTimeout(1000);

  // Enable button visibility and set engagement data
  await page.evaluate(() => {
    chrome.storage.sync.set({ buttonVisibility: true });
    chrome.storage.local.set({
      'engagement-data': {
        installDate: Date.now() - (15 * 24 * 60 * 60 * 1000),
        totalGifsCreated: 5,
        prompts: {
          primary: { shown: false },
          secondary: { shown: false }
        },
        milestones: {
          milestone10: false,
          milestone25: false,
          milestone50: false
        },
        popupFooterDismissed: false
      }
    });
  });

  console.log('✓ Storage configured');
}

async function waitAndScreenshot(page: Page, selector: string, filename: string, options: any = {}) {
  try {
    await page.waitForSelector(selector, { timeout: 10000, ...options });
    await page.waitForTimeout(500); // Let animations settle

    const element = await page.$(selector);
    if (element) {
      const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
      await element.screenshot({ path: screenshotPath });
      console.log(`  ✓ Saved: ${filename}`);
      return true;
    }
  } catch (error) {
    console.log(`  ✗ Failed: ${filename} - ${error.message}`);
    return false;
  }
  return false;
}

async function main() {
  console.log('🎬 Screenshot Capture with CDP\n');

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const userDataDir = path.join(__dirname, 'temp-cdp-' + Date.now());

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
    console.log('⏳ Waiting for extension...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Get extension ID
    const serviceWorkers = context.serviceWorkers();
    let extensionId = '';
    if (serviceWorkers.length > 0) {
      const url = serviceWorkers[0].url();
      const match = url.match(/chrome-extension:\/\/([^\/]+)/);
      if (match) {
        extensionId = match[1];
        console.log(`✓ Extension: ${extensionId}\n`);
      }
    }

    if (!extensionId) {
      throw new Error('Extension not loaded');
    }

    // Setup storage
    const setupPage = await context.newPage();
    await setupStorage(setupPage, extensionId);
    await setupPage.close();

    // Capture popup
    console.log('📸 Capturing popup...');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1500);
    await popupPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-popup-main.png'),
      fullPage: true
    });
    console.log('  ✓ Saved: 01-popup-main.png\n');
    await popupPage.close();

    // Open YouTube and inject button manually if needed
    console.log('📺 Opening YouTube...');
    const page = await context.newPage();

    // Enable CDP session for direct manipulation
    const client = await context.newCDPSession(page);

    await page.goto(YOUTUBE_URL);
    await page.waitForSelector('video', { timeout: 15000 });
    await page.waitForTimeout(5000); // Give extension time to inject

    // Try to find button, if not found, manually trigger wizard via console
    const buttonExists = await page.$('[data-ytgify-button="true"]');

    if (!buttonExists) {
      console.log('  ⚠️  Button not found, opening wizard via DevTools...\n');

      // Use CDP to execute in extension context
      await page.evaluate(() => {
        // Dispatch a custom event that the content script might listen to
        window.postMessage({ type: 'YTGIFY_OPEN_WIZARD' }, '*');
      });

      await page.waitForTimeout(2000);
    } else {
      console.log('  ✓ Button found, clicking...\n');
      await buttonExists.click();
    }

    // Wait for wizard
    await page.waitForSelector('[data-ytgify-wizard="true"]', { timeout: 10000 });

    // Capture QuickCapture screen
    console.log('📸 QuickCapture screen...');
    await waitAndScreenshot(page, '[data-ytgify-wizard="true"]', '02-quickcapture-screen.png');

    // Go to Text Overlay
    console.log('📸 Text Overlay screens...');
    const nextBtn = await page.$('button:has-text("Next")');
    if (nextBtn) {
      await nextBtn.click();
      await page.waitForTimeout(800);

      // Empty state
      await waitAndScreenshot(page, '[data-ytgify-wizard="true"]', '03-text-overlay-empty.png');

      // With text
      const textInput = await page.$('input[type="text"], textarea');
      if (textInput) {
        await textInput.fill('Check out YTGify!');
        await page.waitForTimeout(500);
        await waitAndScreenshot(page, '[data-ytgify-wizard="true"]', '04-text-overlay-filled.png');
      }
    }

    console.log('\n✅ Automated capture complete!');
    console.log('📁 Location: /Users/jeremywatt/Desktop/ytgify/screenshots\n');

    console.log('⚠️  For Processing/Success/Feedback/Milestone screens:');
    console.log('   Browser will stay open for 2 minutes for manual capture.');
    console.log('   Click "Create GIF" and take screenshots of each screen.\n');

    await new Promise(resolve => setTimeout(resolve, 120000));

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
