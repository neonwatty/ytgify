const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test('Test GIF creation speed and percentage display improvements', async () => {
  test.setTimeout(120000);
  
  console.log('=== Testing Optimization Improvements ===\n');
  
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
  
  // Track progress updates
  const progressUpdates = [];
  let startTime = null;
  let optimizingStartTime = null;
  let optimizingEndTime = null;
  
  page.on('console', msg => {
    const text = msg.text();
    
    // Capture progress updates
    if (text.includes('[TimelineWrapper] Progress update received:')) {
      const match = text.match(/stage: (\w+), progress: ([\d.]+), message: (.+)/);
      if (match) {
        const stage = match[1];
        const progress = parseFloat(match[2]);
        const message = match[3];
        
        progressUpdates.push({ stage, progress, message, time: Date.now() });
        
        // Track optimizing phase timing
        if (stage === 'optimizing' && !optimizingStartTime) {
          optimizingStartTime = Date.now();
          console.log('⏱️ Optimizing phase started');
        }
        if (stage === 'compressing' && optimizingStartTime && !optimizingEndTime) {
          optimizingEndTime = Date.now();
          const duration = (optimizingEndTime - optimizingStartTime) / 1000;
          console.log(`⏱️ Optimizing phase completed in ${duration.toFixed(2)}s`);
        }
        
        // Check if percentages in messages are rounded
        const percentMatch = message.match(/(\d+\.\d+)%/);
        if (percentMatch) {
          const percentValue = percentMatch[1];
          if (percentValue.includes('.')) {
            console.log(`❌ UNROUNDED PERCENTAGE FOUND: ${percentValue}% in message: "${message}"`);
          }
        }
      }
    }
  });

  // Navigate to YouTube
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { 
    waitUntil: 'domcontentloaded' 
  });

  // Wait for video and start playing
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
  console.log('Opening GIF creator...');
  const gifButton = await page.$('.ytgif-button, .ytp-button[aria-label*="GIF"]');
  if (!gifButton) {
    throw new Error('GIF button not found');
  }
  
  await gifButton.click();
  await page.waitForTimeout(2000);

  // Start GIF creation
  console.log('Starting GIF creation...\n');
  const createButton = await page.$('.ytgif-timeline-create');
  if (!createButton) {
    throw new Error('Create button not found');
  }
  
  startTime = Date.now();
  await createButton.click();
  
  // Wait for completion
  let completed = false;
  let attempts = 0;
  const maxAttempts = 120; // 60 seconds

  while (!completed && attempts < maxAttempts) {
    const status = await page.evaluate(() => {
      const createButton = document.querySelector('.ytgif-timeline-create');
      const percentageEl = document.querySelector('.ytgif-progress-percentage');
      return {
        buttonText: createButton?.textContent || '',
        isComplete: createButton?.textContent === 'Create GIF',
        displayedPercentage: percentageEl?.textContent || ''
      };
    });
    
    // Check if displayed percentage is rounded
    if (status.displayedPercentage && status.displayedPercentage.includes('.')) {
      console.log(`❌ UNROUNDED PERCENTAGE IN UI: ${status.displayedPercentage}`);
    }

    if (status.isComplete) {
      completed = true;
      const totalTime = (Date.now() - startTime) / 1000;
      console.log(`\n✅ GIF creation completed in ${totalTime.toFixed(2)}s`);
      break;
    }

    await page.waitForTimeout(500);
    attempts++;
  }

  // Analyze results
  console.log('\n=== Performance Analysis ===');
  
  // Count optimizing updates
  const optimizingUpdates = progressUpdates.filter(u => u.stage === 'optimizing');
  console.log(`Optimizing stage had ${optimizingUpdates.length} updates`);
  
  // Check for unrounded percentages
  const unroundedUpdates = progressUpdates.filter(u => {
    const match = u.message.match(/(\d+\.\d+)%/);
    return match && match[1].includes('.');
  });
  
  if (unroundedUpdates.length > 0) {
    console.log(`\n❌ Found ${unroundedUpdates.length} unrounded percentages in messages`);
    console.log('Examples:', unroundedUpdates.slice(0, 3).map(u => u.message));
  } else {
    console.log('\n✅ All percentages are properly rounded!');
  }
  
  // Calculate average time per stage
  const stages = ['extracting', 'encoding', 'optimizing', 'compressing'];
  console.log('\nTime per stage:');
  for (const stage of stages) {
    const stageUpdates = progressUpdates.filter(u => u.stage === stage);
    if (stageUpdates.length > 1) {
      const duration = (stageUpdates[stageUpdates.length - 1].time - stageUpdates[0].time) / 1000;
      console.log(`  ${stage}: ${duration.toFixed(2)}s`);
    }
  }
  
  await page.waitForTimeout(3000);
  await browser.close();
  
  // Assertions
  expect(unroundedUpdates.length).toBe(0);
  expect(completed).toBe(true);
});