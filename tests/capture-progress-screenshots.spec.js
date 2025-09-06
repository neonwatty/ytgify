const { test, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs').promises;

test('Capture screenshots of progress updates', async () => {
  test.setTimeout(180000);
  
  console.log('=== Capturing Progress Update Screenshots ===\n');
  
  // Set up downloads folder
  const screenshotPath = path.join(__dirname, 'screenshots');
  await fs.mkdir(screenshotPath, { recursive: true });
  console.log('Screenshots will be saved to:', screenshotPath);
  
  // Launch browser with extension
  const pathToExtension = path.join(__dirname, '..', 'dist');
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
    viewport: { width: 1400, height: 800 },
  });

  const page = await browser.newPage();
  
  // Track which stages we've captured
  const capturedStages = new Set();
  let screenshotCount = 0;
  
  // Capture console messages to know when to take screenshots
  page.on('console', async msg => {
    const text = msg.text();
    
    // Look for progress updates
    if (text.includes('[TimelineWrapper] Progress update received:')) {
      try {
        // Parse the progress info from the log
        const match = text.match(/stage: (\w+), progress: ([\d.]+)/);
        if (match) {
          const stage = match[1];
          const progress = parseFloat(match[2]);
          
          // Take screenshots at specific milestones
          const shouldCapture = (
            (stage === 'extracting' && !capturedStages.has('extracting')) ||
            (stage === 'encoding' && progress > 15 && !capturedStages.has('encoding')) ||
            (stage === 'optimizing' && progress > 55 && !capturedStages.has('optimizing')) ||
            (stage === 'compressing' && progress > 70 && !capturedStages.has('compressing'))
          );
          
          if (shouldCapture) {
            capturedStages.add(stage);
            screenshotCount++;
            
            // Wait a bit for UI to update
            await page.waitForTimeout(100);
            
            // Take full viewport screenshot to show progress
            const filename = `${screenshotCount}-${stage}-${Math.round(progress)}pct.png`;
            await page.screenshot({ 
              path: path.join(screenshotPath, filename),
              fullPage: false
            });
            console.log(`📸 Captured: ${filename}`);
          }
        }
      } catch (e) {
        // Ignore screenshot errors
      }
    }
  });

  // Navigate to YouTube
  console.log('\n1. Navigating to YouTube...');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
    waitUntil: 'domcontentloaded' 
  });

  // Wait for video player
  await page.waitForSelector('video', { timeout: 15000 });
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) {
      video.play();
      video.currentTime = 5;
    }
  });
  
  await page.waitForTimeout(3000);

  // Handle cookie dialog
  try {
    const cookieButton = await page.$('[aria-label*="Accept"], [aria-label*="Reject"]');
    if (cookieButton) {
      await cookieButton.click();
    }
  } catch (e) {}

  // Find and click GIF button
  console.log('2. Opening GIF creator...');
  const gifButton = await page.$('.ytgif-button, .ytp-button[aria-label*="GIF"]');
  if (!gifButton) {
    throw new Error('GIF button not found');
  }
  
  await gifButton.click();
  await page.waitForTimeout(2000);
  
  // Wait for overlay to be visible
  await page.waitForFunction(() => {
    const overlay = document.querySelector('#ytgif-timeline-overlay');
    if (overlay) {
      const styles = window.getComputedStyle(overlay);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    }
    return false;
  }, { timeout: 5000 });
  
  // Take screenshot of initial state (full viewport to show overlay position)
  await page.screenshot({ 
    path: path.join(screenshotPath, '0-initial-state.png'),
    fullPage: false
  });
  console.log('📸 Captured: 0-initial-state.png');

  // Start GIF creation
  console.log('\n3. Starting GIF creation...');
  const createButton = await page.$('.ytgif-timeline-create');
  if (!createButton) {
    throw new Error('Create button not found');
  }
  
  await createButton.click();
  console.log('   Creating GIF - capturing progress stages...\n');
  
  // Wait for completion or timeout
  let completed = false;
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds

  while (!completed && attempts < maxAttempts) {
    const status = await page.evaluate(() => {
      const successFeedback = document.querySelector('.ytgif-feedback--success');
      const createButton = document.querySelector('.ytgif-timeline-create');
      return {
        success: !!successFeedback,
        buttonText: createButton?.textContent || '',
        isComplete: createButton?.textContent === 'Create GIF'
      };
    });

    if (status.success || status.isComplete) {
      completed = true;
      
      // Take final screenshot
      await page.screenshot({ 
        path: path.join(screenshotPath, `${screenshotCount + 1}-completed.png`),
        fullPage: false
      });
      console.log(`📸 Captured: ${screenshotCount + 1}-completed.png`);
      break;
    }

    await page.waitForTimeout(500);
    attempts++;
  }

  // Take a full page screenshot at the end
  await page.screenshot({ 
    path: path.join(screenshotPath, 'full-page-final.png'),
    fullPage: false 
  });
  
  console.log('\n=== Screenshots captured ===');
  console.log(`Total screenshots: ${screenshotCount + 2}`);
  console.log(`Location: ${screenshotPath}`);
  console.log('\nStages captured:');
  for (const stage of capturedStages) {
    console.log(`  ✓ ${stage}`);
  }
  
  // Keep browser open for a moment
  await page.waitForTimeout(3000);
  await browser.close();
});