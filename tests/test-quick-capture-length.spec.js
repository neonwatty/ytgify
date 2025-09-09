const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Quick Capture Default Length Investigation', () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    // Launch browser with extension
    const pathToExtension = path.join(__dirname, '..', 'dist');
    browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ],
      viewport: { width: 1280, height: 720 }
    });
    
    page = browser.pages()[0] || await browser.newPage();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test.beforeEach(async () => {
    // Go to YouTube video
    await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    
    // Wait for video player to load
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });
    
    // Wait a bit for video to start playing and let extension inject
    await page.waitForTimeout(5000);
  });

  test('investigate Quick Capture default time range', async () => {
    console.log('Starting Quick Capture investigation...');
    
    // Get current video time and duration
    const videoData = await page.evaluate(() => {
      const video = document.querySelector('video');
      return {
        currentTime: video?.currentTime || 0,
        duration: video?.duration || 0
      };
    });
    console.log('Video data:', videoData);
    
    // Look for GIF button - try multiple selectors
    let gifButton = await page.locator('[data-tooltip="Create GIF"]').first();
    let buttonExists = await gifButton.isVisible().catch(() => false);
    
    if (!buttonExists) {
      // Try alternative selector
      gifButton = await page.locator('#ytgif-button').first();
      buttonExists = await gifButton.isVisible().catch(() => false);
    }
    
    if (!buttonExists) {
      // Try to find by class
      gifButton = await page.locator('.ytgif-button').first();
      buttonExists = await gifButton.isVisible().catch(() => false);
    }
    
    // Also check if extension injected anything
    const extensionInjected = await page.evaluate(() => {
      return {
        hasButton: !!document.querySelector('#ytgif-button'),
        hasButtonClass: !!document.querySelector('.ytgif-button'),
        hasTooltip: !!document.querySelector('[data-tooltip="Create GIF"]'),
        allButtons: Array.from(document.querySelectorAll('button')).map(b => ({
          id: b.id,
          className: b.className,
          tooltip: b.getAttribute('data-tooltip')
        })).filter(b => b.id || b.tooltip).slice(0, 10)
      };
    });
    console.log('Extension injection check:', extensionInjected);
    console.log('GIF button visible:', buttonExists);
    
    if (buttonExists) {
      // Click GIF button to open wizard
      await gifButton.click();
      console.log('Clicked GIF button');
      
      // Wait for wizard to appear
      await page.waitForSelector('.ytgif-overlay-wizard', { timeout: 5000 });
      console.log('Wizard opened');
      
      // Check if we're on welcome screen
      const welcomeTitle = await page.locator('.ytgif-wizard-title').textContent();
      console.log('Current screen title:', welcomeTitle);
      
      // Get more details about the wizard state
      const wizardDetails = await page.evaluate(() => {
        const wizard = document.querySelector('.ytgif-overlay-wizard');
        const allButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Quick') || b.textContent.includes('Continue'));
        return {
          wizardVisible: wizard ? getComputedStyle(wizard).display : 'not found',
          allButtonTexts: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0).slice(0, 20),
          wizardContent: wizard ? wizard.textContent.substring(0, 500) : 'not found'
        };
      });
      console.log('Wizard details:', JSON.stringify(wizardDetails, null, 2));
      
      // Take a screenshot to see what's on screen
      await page.screenshot({ path: 'tests/screenshots/wizard-state.png' });
      console.log('Screenshot saved to tests/screenshots/wizard-state.png');
      
      // Since it says "Starting automatically...", wait for it to advance
      console.log('Waiting for wizard to auto-advance to Quick Capture...');
      await page.waitForTimeout(3000); // Wait for auto-advance
      
      // Check if we're now on Quick Capture screen
      const newTitle = await page.locator('.ytgif-wizard-title').textContent();
      console.log('Screen after auto-advance:', newTitle);
      
      // If still on welcome, manually click continue
      if (newTitle.includes('Create a GIF')) {
        console.log('Still on welcome, looking for continue button...');
        // Look for any button that might advance the wizard
        const allButtons = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('button')).map(b => ({
            text: b.textContent.trim(),
            className: b.className,
            visible: getComputedStyle(b).display !== 'none'
          })).filter(b => b.visible && b.text);
        });
        console.log('All visible buttons:', allButtons);
      }
      
      // Now check if we're on Quick Capture Preview
      if (newTitle.includes('Quick Capture') || newTitle.includes('Choose Capture')) {
        console.log('=== QUICK CAPTURE PREVIEW INVESTIGATION ===');
        
        // Get all info values to see the displayed duration and other info
        const infoValues = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.ytgif-info-value')).map(el => el.textContent);
        });
        console.log('Info values (Duration, Frames, Size):', infoValues);
        
        // Get the actual time range being used
        const timeRangeInfo = await page.evaluate(() => {
          // Try to find any elements showing time range
          const timeDisplays = Array.from(document.querySelectorAll('.ytgif-time-display, .ytgif-time'));
          const scrubber = document.querySelector('.ytgif-timeline-scrubber');
          
          // Try to extract props from React component if possible
          let reactProps = null;
          try {
            const quickCaptureEl = document.querySelector('.ytgif-quick-capture-screen');
            if (quickCaptureEl) {
              const reactKey = Object.keys(quickCaptureEl).find(key => key.startsWith('__react'));
              if (reactKey) {
                const fiber = quickCaptureEl[reactKey];
                if (fiber && fiber.memoizedProps) {
                  reactProps = {
                    startTime: fiber.memoizedProps.startTime,
                    endTime: fiber.memoizedProps.endTime,
                    currentTime: fiber.memoizedProps.currentTime
                  };
                }
              }
            }
          } catch (e) {}
          
          return {
            timeDisplayTexts: timeDisplays.map(el => el.textContent),
            hasScrubber: !!scrubber,
            reactProps: reactProps
          };
        });
        console.log('Time range info:', JSON.stringify(timeRangeInfo, null, 2));
        
        // Calculate what the duration should be based on video time
        const expectedDuration = await page.evaluate(() => {
          const video = document.querySelector('video');
          if (video) {
            const currentTime = video.currentTime;
            const duration = video.duration;
            // Based on our code changes, it should be currentTime to currentTime + 5
            return {
              currentTime: currentTime,
              expectedStart: currentTime,
              expectedEnd: Math.min(duration, currentTime + 5),
              expectedDuration: Math.min(5, duration - currentTime)
            };
          }
          return null;
        });
        console.log('Expected duration based on video:', expectedDuration);
        
        console.log('=== ISSUE IDENTIFIED ===');
        if (infoValues[0]) {
          const displayedDuration = parseFloat(infoValues[0].replace('s', ''));
          console.log(`Displayed duration: ${displayedDuration}s`);
          console.log(`Expected duration: ${expectedDuration?.expectedDuration || 5}s`);
          console.log(`Difference: ${Math.abs(displayedDuration - (expectedDuration?.expectedDuration || 5))}s`);
        }
        
        // Try to get the actual time range from the component
        const timeRange = await page.evaluate(() => {
          // Try to find the timeline scrubber or any element showing the time range
          const scrubber = document.querySelector('.ytgif-timeline-scrubber');
          const timeDisplays = document.querySelectorAll('.ytgif-time-display');
          const infoValues = document.querySelectorAll('.ytgif-info-value');
          
          return {
            scrubberExists: !!scrubber,
            timeDisplays: Array.from(timeDisplays).map(el => el.textContent),
            infoValues: Array.from(infoValues).map(el => el.textContent),
            // Try to get React props if available
            reactProps: (() => {
              try {
                const wizardElement = document.querySelector('.ytgif-overlay-wizard');
                if (wizardElement) {
                  // Look for React fiber
                  const reactKey = Object.keys(wizardElement).find(key => key.startsWith('__react'));
                  if (reactKey && wizardElement[reactKey]) {
                    const fiber = wizardElement[reactKey];
                    // Try to find props
                    let current = fiber;
                    while (current) {
                      if (current.memoizedProps) {
                        return {
                          found: true,
                          props: JSON.stringify(current.memoizedProps, null, 2).slice(0, 500)
                        };
                      }
                      current = current.child || current.sibling;
                    }
                  }
                }
              } catch (e) {
                return { error: e.message };
              }
              return null;
            })()
          };
        });
        
        console.log('Time range data:', JSON.stringify(timeRange, null, 2));
        
        // Check if there are input fields or sliders we can inspect
        const inputs = await page.evaluate(() => {
          const allInputs = document.querySelectorAll('input');
          return Array.from(allInputs).map(input => ({
            type: input.type,
            value: input.value,
            name: input.name,
            id: input.id,
            className: input.className
          }));
        });
        console.log('Input fields found:', inputs);
        
        // Take a screenshot for visual inspection
        await page.screenshot({ path: 'tests/screenshots/quick-capture-investigation.png' });
        console.log('Screenshot saved to tests/screenshots/quick-capture-investigation.png');
        
        // Try to get the actual props being passed to QuickCaptureScreen
        const quickCaptureData = await page.evaluate(() => {
          // Log to console for debugging
          console.log('[Test] Looking for QuickCaptureScreen data...');
          
          // Try to intercept console logs
          const logs = [];
          const originalLog = console.log;
          console.log = (...args) => {
            logs.push(args.join(' '));
            originalLog.apply(console, args);
          };
          
          // Trigger a re-render or interaction to capture logs
          const backButton = document.querySelector('.ytgif-back-button');
          if (backButton) {
            backButton.click();
            // Wait a bit
            setTimeout(() => {
              const continueBtn = document.querySelector('.ytgif-button-primary');
              if (continueBtn) continueBtn.click();
            }, 100);
          }
          
          return { logs };
        });
        
        console.log('Quick Capture data logs:', quickCaptureData);
      }
    } else {
      console.log('GIF button not found - trying keyboard shortcut');
      
      // Try keyboard shortcut to trigger wizard
      await page.keyboard.down('Control');
      await page.keyboard.down('Shift');
      await page.keyboard.press('G');
      await page.keyboard.up('Shift');
      await page.keyboard.up('Control');
      
      await page.waitForTimeout(2000);
      
      // Check if wizard appeared
      const wizardExists = await page.locator('.ytgif-overlay-wizard').isVisible().catch(() => false);
      console.log('Wizard visible after shortcut:', wizardExists);
      
      if (wizardExists) {
        // Continue with the test
        const welcomeTitle = await page.locator('.ytgif-wizard-title').textContent();
        console.log('Current screen title:', welcomeTitle);
        
        // Click continue to go to Quick Capture
        const continueButton = await page.locator('.ytgif-button-primary').first();
        if (await continueButton.isVisible()) {
          await continueButton.click();
          console.log('Clicked continue button');
          
          // Wait for Quick Capture Preview screen
          await page.waitForTimeout(1000);
          
          // Get the screen title to confirm we're on Quick Capture
          const screenTitle = await page.locator('.ytgif-wizard-title').textContent();
          console.log('Screen after continue:', screenTitle);
          
          // Look for the duration display
          const durationInfo = await page.locator('.ytgif-info-value').first().textContent();
          console.log('Displayed duration:', durationInfo);
          
          // Take a screenshot for visual inspection
          await page.screenshot({ path: 'tests/screenshots/quick-capture-investigation.png' });
          console.log('Screenshot saved to tests/screenshots/quick-capture-investigation.png');
        }
      } else {
        // Take screenshot to see current state
        await page.screenshot({ path: 'tests/screenshots/no-wizard.png' });
      }
    }
  });
});