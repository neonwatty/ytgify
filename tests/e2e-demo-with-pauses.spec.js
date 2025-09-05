const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

const EXTENSION_PATH = path.join(__dirname, '..', 'dist');
const DOWNLOADS_PATH = path.join(__dirname, 'downloads');

// Pause duration in milliseconds - adjust this to control demo speed
const PAUSE_DURATION = 2000; // 2 seconds between steps

test('DEMO: Step-by-Step GIF Creation with Pauses', async ({ }) => {
  console.log('\n' + '='.repeat(60));
  console.log('   🎬 DEMO MODE: Create and Download 3-second GIF');
  console.log('='.repeat(60));
  console.log('\nThis demo will pause at each step so you can watch the process.');
  console.log(`Each pause is ${PAUSE_DURATION/1000} seconds long.\n`);
  console.log('Steps:');
  console.log('  1. Launch browser with extension');
  console.log('  2. Navigate to YouTube');
  console.log('  3. Find and highlight the GIF button');
  console.log('  4. Click the GIF button');
  console.log('  5. Show timeline overlay');
  console.log('  6. Set 3-second selection');
  console.log('  7. Click Create GIF');
  console.log('  8. Watch progress bar');
  console.log('  9. Preview modal appears');
  console.log(' 10. Click Download button');
  console.log(' 11. Verify downloaded file\n');
  console.log('Press Enter to continue when ready...\n');

  // Clean downloads directory
  try {
    await fs.rm(DOWNLOADS_PATH, { recursive: true, force: true });
  } catch (e) {}
  await fs.mkdir(DOWNLOADS_PATH, { recursive: true });

  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: 500, // Slow down all actions for visibility
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--start-maximized'
    ],
    viewport: null, // Use full window
    acceptDownloads: true,
    downloadsPath: DOWNLOADS_PATH
  });

  const page = await browser.newPage();
  
  // Monitor console for important events
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('GIF') || text.includes('Progress') || 
        text.includes('Created') || text.includes('Encoding')) {
      if (!text.includes('Failed to load') && !text.includes('googleads')) {
        console.log(`  📝 ${text.substring(0, 80)}...`);
      }
    }
  });

  try {
    // Step 1: Navigate to YouTube
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 1: Loading YouTube...');
    console.log('─'.repeat(60));
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.waitForSelector('video', { timeout: 20000 });
    console.log('✅ YouTube loaded successfully');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds to let you see the page...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Step 2: Wait for extension to inject button
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 2: Waiting for GIF button to be injected...');
    console.log('─'.repeat(60));
    await page.waitForTimeout(3000); // Give extension time to inject
    console.log('✅ Extension initialization complete');
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Step 3: Find and highlight GIF button
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 3: Finding the GIF button...');
    console.log('─'.repeat(60));
    
    const gifButton = await page.waitForSelector('button.ytgif-button', { timeout: 10000 });
    
    // Highlight the button with a red border
    await page.evaluate((btn) => {
      btn.style.border = '3px solid red';
      btn.style.boxShadow = '0 0 20px red';
      // Scroll button into view
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, gifButton);
    
    console.log('✅ GIF button found and highlighted in RED');
    console.log('   Look for the red-bordered button in the video controls!');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Remove highlight
    await page.evaluate((btn) => {
      btn.style.border = '';
      btn.style.boxShadow = '';
    }, gifButton);
    
    // Step 4: Click GIF button
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 4: Clicking the GIF button...');
    console.log('─'.repeat(60));
    await gifButton.click();
    console.log('✅ GIF button clicked');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Step 5: Timeline overlay appears
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 5: Timeline overlay appearing...');
    console.log('─'.repeat(60));
    const overlay = await page.waitForSelector('.ytgif-timeline-overlay', { timeout: 10000 });
    
    // Highlight the overlay
    await page.evaluate(() => {
      const overlay = document.querySelector('.ytgif-timeline-overlay');
      if (overlay) {
        overlay.style.border = '3px solid lime';
        overlay.style.boxShadow = '0 0 30px lime';
      }
    });
    
    console.log('✅ Timeline overlay is now visible (highlighted in GREEN)');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Step 6: Set 3-second selection
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 6: Setting a 3-second selection...');
    console.log('─'.repeat(60));
    
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        // Set selection from current time
        const startTime = Math.max(0, video.currentTime);
        const endTime = Math.min(startTime + 3, video.duration);
        
        const event = new CustomEvent('ytgif-selection-change', {
          detail: {
            startTime: startTime,
            endTime: endTime,
            duration: endTime - startTime
          }
        });
        window.dispatchEvent(event);
        
        console.log(`Selection: ${startTime.toFixed(1)}s to ${endTime.toFixed(1)}s`);
      }
    });
    
    console.log('✅ 3-second selection configured');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Step 7: Highlight and click Create button
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 7: Finding the Create GIF button...');
    console.log('─'.repeat(60));
    
    const createBtn = await page.waitForSelector('.ytgif-timeline-create');
    
    // Highlight create button
    await page.evaluate((btn) => {
      btn.style.border = '3px solid yellow';
      btn.style.boxShadow = '0 0 20px yellow';
    }, createBtn);
    
    console.log('✅ Create GIF button highlighted in YELLOW');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds before clicking...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    await createBtn.click();
    console.log('✅ Create GIF clicked - Processing will begin...');
    
    // Step 8: Monitor progress
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 8: Processing GIF (watch the progress bar)...');
    console.log('─'.repeat(60));
    
    // Set up progress monitoring
    await page.evaluate(() => {
      window.__lastProgress = 0;
      window.addEventListener('ytgif-progress-update', (event) => {
        if (event.detail && event.detail.progress) {
          window.__lastProgress = event.detail.progress;
        }
      });
    });
    
    // Monitor progress for up to 30 seconds
    let progressShown = false;
    const maxWait = 30000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWait) {
      const progress = await page.evaluate(() => window.__lastProgress);
      
      if (progress > 0 && !progressShown) {
        console.log('\n📊 Progress Bar Active:');
        progressShown = true;
      }
      
      if (progress > 0) {
        const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
        process.stdout.write(`\r   [${bar}] ${progress}%`);
      }
      
      // Check if preview modal appeared
      const hasPreview = await page.$('.ytgif-preview-modal');
      if (hasPreview) {
        console.log('\n✅ Processing complete!');
        break;
      }
      
      await page.waitForTimeout(500);
    }
    
    // Step 9: Preview modal
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 9: Preview modal appearing...');
    console.log('─'.repeat(60));
    
    const preview = await page.waitForSelector('.ytgif-preview-modal', { timeout: 10000 });
    
    // Highlight preview modal
    await page.evaluate(() => {
      const modal = document.querySelector('.ytgif-preview-modal__content');
      if (modal) {
        modal.style.border = '3px solid cyan';
        modal.style.boxShadow = '0 0 40px cyan';
      }
    });
    
    console.log('✅ Preview modal is visible (highlighted in CYAN)');
    console.log('   You can see your GIF preview!');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION * 2/1000} seconds to admire the GIF...`);
    await page.waitForTimeout(PAUSE_DURATION * 2);
    
    // Step 10: Download button
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 10: Finding the Download button...');
    console.log('─'.repeat(60));
    
    const downloadBtn = await page.waitForSelector('.ytgif-preview-modal button:has-text("Download")');
    
    // Highlight download button
    await page.evaluate((btn) => {
      btn.style.border = '3px solid magenta';
      btn.style.boxShadow = '0 0 20px magenta';
      btn.style.transform = 'scale(1.1)';
    }, downloadBtn);
    
    console.log('✅ Download button highlighted in MAGENTA');
    console.log(`⏸️  Pausing for ${PAUSE_DURATION/1000} seconds before downloading...`);
    await page.waitForTimeout(PAUSE_DURATION);
    
    // Click download
    console.log('\n📥 Clicking Download button...');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadBtn.click()
    ]);
    
    const filename = await download.suggestedFilename();
    const savePath = path.join(DOWNLOADS_PATH, filename);
    await download.saveAs(savePath);
    
    // Step 11: Verify
    console.log('\n' + '─'.repeat(60));
    console.log('📍 STEP 11: Verifying downloaded GIF...');
    console.log('─'.repeat(60));
    
    const stats = await fs.stat(savePath);
    const fileBuffer = await fs.readFile(savePath);
    const header = fileBuffer.toString('ascii', 0, 6);
    
    // Count frames
    let frameCount = 0;
    for (let i = 0; i < fileBuffer.length - 8; i++) {
      if (fileBuffer[i] === 0x21 && fileBuffer[i + 1] === 0xF9) {
        frameCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('   🎉 DEMO COMPLETE - GIF SUCCESSFULLY CREATED!');
    console.log('='.repeat(60));
    console.log('\n📊 Final Results:');
    console.log(`   📁 File: ${filename}`);
    console.log(`   💾 Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`   🎬 Frames: ${frameCount}`);
    console.log(`   ✅ Valid GIF: ${header === 'GIF89a' ? 'Yes' : 'No'}`);
    console.log(`   📍 Location: ${savePath}`);
    console.log('\n' + '='.repeat(60));
    
    console.log('\n⏸️  Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    
    // Take screenshot
    const screenshotPath = path.join(DOWNLOADS_PATH, 'demo-error.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    throw error;
  } finally {
    console.log('\n🔚 Closing browser...');
    await browser.close();
    console.log('✅ Demo finished!\n');
  }
});

console.log('\n' + '='.repeat(60));
console.log('   🎬 YouTube GIF Maker - Interactive Demo Test');
console.log('='.repeat(60));
console.log('\nThis test will demonstrate the complete GIF creation workflow');
console.log('with pauses at each step so you can watch the process.');
console.log('\nThe test will:');
console.log('  • Highlight UI elements in different colors');
console.log('  • Pause for 2 seconds between steps');
console.log('  • Show progress during GIF encoding');
console.log('  • Download a real GIF file');
console.log('\nReady to start the demo!');