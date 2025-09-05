const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');
const DOWNLOADS_PATH = path.join(__dirname, 'downloads');

test('Simple E2E: Create and Download 3-second GIF', async ({ }) => {
  console.log('\n=== Simple E2E Test ===\n');

  // Clean downloads directory
  try {
    await fs.rm(DOWNLOADS_PATH, { recursive: true, force: true });
  } catch (e) {}
  await fs.mkdir(DOWNLOADS_PATH, { recursive: true });

  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: 500,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true,
    downloadsPath: DOWNLOADS_PATH
  });

  const page = await browser.newPage();
  
  // Monitor console
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Failed to load resource') && 
        !text.includes('googleads') && 
        !text.includes('doubleclick')) {
      console.log(`[Console]: ${text}`);
    }
  });

  try {
    console.log('1. Loading YouTube...');
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player
    console.log('2. Waiting for video player...');
    await page.waitForSelector('video', { timeout: 20000 });
    await page.waitForTimeout(5000); // Give extension time to inject button
    
    // Debug: Check what buttons exist
    console.log('3. Checking for injected elements...');
    const buttonInfo = await page.evaluate(() => {
      const info = {
        hasYtpRightControls: !!document.querySelector('.ytp-right-controls'),
        buttonCount: document.querySelectorAll('.ytp-right-controls button').length,
        buttons: [],
        hasGifButton: false
      };
      
      // Check all buttons in controls
      const buttons = document.querySelectorAll('.ytp-right-controls button');
      buttons.forEach(btn => {
        const classes = btn.className;
        const ariaLabel = btn.getAttribute('aria-label');
        const hasSvg = !!btn.querySelector('svg');
        
        info.buttons.push({
          classes,
          ariaLabel,
          hasSvg
        });
        
        if (classes.includes('ytgif') || ariaLabel?.includes('GIF')) {
          info.hasGifButton = true;
        }
      });
      
      return info;
    });
    
    console.log('Button info:', JSON.stringify(buttonInfo, null, 2));
    
    // Try to find GIF button with various methods
    console.log('4. Looking for GIF button...');
    
    let gifButton = null;
    
    // Method 1: Direct class selector
    gifButton = await page.$('button.ytgif-button');
    if (gifButton) {
      console.log('  Found via class: button.ytgif-button');
    }
    
    // Method 2: Aria label
    if (!gifButton) {
      gifButton = await page.$('button[aria-label*="GIF"]');
      if (gifButton) {
        console.log('  Found via aria-label');
      }
    }
    
    // Method 3: Wait and retry
    if (!gifButton) {
      console.log('  Waiting 5 more seconds for button injection...');
      await page.waitForTimeout(5000);
      
      gifButton = await page.$('button.ytgif-button');
      if (!gifButton) {
        // Try to find any button in right controls
        const rightControlButtons = await page.$$('.ytp-right-controls button');
        console.log(`  Found ${rightControlButtons.length} buttons in right controls`);
        
        // Check last few buttons (where GIF button should be)
        for (let i = rightControlButtons.length - 1; i >= Math.max(0, rightControlButtons.length - 3); i--) {
          const btn = rightControlButtons[i];
          const classes = await btn.getAttribute('class');
          const aria = await btn.getAttribute('aria-label');
          console.log(`    Button ${i}: classes="${classes}", aria="${aria}"`);
          
          if (classes?.includes('ytgif') || aria?.includes('GIF')) {
            gifButton = btn;
            console.log('    ^ This is the GIF button!');
            break;
          }
        }
      }
    }
    
    if (!gifButton) {
      throw new Error('GIF button not found after multiple attempts');
    }
    
    console.log('5. Clicking GIF button...');
    await gifButton.click();
    
    // Wait for timeline overlay
    console.log('6. Waiting for timeline overlay...');
    const overlay = await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 10000 });
    console.log('  ✓ Timeline overlay appeared');
    
    // Set 3-second selection
    console.log('7. Setting 3-second selection...');
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        const event = new CustomEvent('ytgif-selection-change', {
          detail: {
            startTime: 5,
            endTime: 8,
            duration: 3
          }
        });
        window.dispatchEvent(event);
      }
    });
    await page.waitForTimeout(1000);
    
    // Create GIF
    console.log('8. Creating GIF...');
    const createBtn = await page.waitForSelector('.ytgif-timeline-create');
    await createBtn.click();
    
    // Wait for preview modal (up to 30 seconds)
    console.log('9. Waiting for preview modal (processing GIF)...');
    const preview = await page.waitForSelector('.ytgif-preview-modal', { timeout: 30000 });
    console.log('  ✓ Preview modal appeared');
    
    // Download GIF
    console.log('10. Downloading GIF...');
    const downloadBtn = await page.waitForSelector('.ytgif-preview-modal button:has-text("Download")');
    
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click()
    ]);
    
    const filename = await download.suggestedFilename();
    const savePath = path.join(DOWNLOADS_PATH, filename);
    await download.saveAs(savePath);
    
    // Verify
    const stats = await fs.stat(savePath);
    console.log(`\n✅ SUCCESS!`);
    console.log(`  File: ${filename}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`  Path: ${savePath}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Take screenshot
    const screenshotPath = path.join(DOWNLOADS_PATH, 'debug-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);
    
    throw error;
  } finally {
    await browser.close();
  }
});

console.log('Simple E2E test ready to run');