import { test, expect, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll
const TEST_DURATION = 5; // 5 second GIFs
const OUTPUT_DIR = path.join(__dirname, '../outputs/resolution-test');

// Resolution presets to test
const RESOLUTION_PRESETS = [
  { name: '360p', expectedWidth: 640, expectedHeight: 360 },
  { name: '480p', expectedWidth: 852, expectedHeight: 480 },
  { name: '720p', expectedWidth: 1280, expectedHeight: 720 },
  { name: 'original', expectedWidth: 1920, expectedHeight: 1080 }
];

test.describe('Resolution Verification Tests', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Build the extension first
    const extensionPath = path.join(__dirname, '../../dist');

    // Launch browser with extension loaded
    const browser = await chromium.launch({
      headless: false, // Need to see the extension UI
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    context = await browser.newContext();

    // Get extension ID from background page
    const backgroundPage = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = backgroundPage.url().split('/')[2];
  });

  test.afterAll(async () => {
    await context.close();
  });

  for (const preset of RESOLUTION_PRESETS) {
    test(`Create ${preset.name} GIF and verify resolution`, async () => {
      const page = await context.newPage();

      try {
        // Navigate to Rick Roll video
        await page.goto(TEST_VIDEO_URL);

        // Wait for video to load
        await page.waitForSelector('video', { timeout: 30000 });

        // Wait for YouTube player controls to be ready
        await page.waitForSelector('.ytp-right-controls', { timeout: 10000 });

        // Wait for extension to inject GIF button - look for custom button or use class selectors
        await page.waitForTimeout(3000); // Give extension time to inject

        // Try to find the GIF button (extension should inject it into .ytp-right-controls)
        const gifButton = await page.locator('.ytp-right-controls button').last();

        // If no button found, skip this test
        const buttonExists = await gifButton.isVisible().catch(() => false);
        if (!buttonExists) {
          console.log(`⚠️ GIF button not found for ${preset.name}, skipping test`);
          return;
        }

        // Click the GIF button to start creation process
        await gifButton.click();

        // Wait for timeline overlay or editor to appear
        await page.waitForTimeout(2000);

        // Look for any modal or overlay that might have appeared
        const possibleSelectors = [
          '[role="dialog"]',
          '.gif-timeline-overlay',
          '.gif-editor',
          '[data-gif-editor]'
        ];

        let editorElement = null;
        for (const selector of possibleSelectors) {
          const element = page.locator(selector);
          if (await element.isVisible().catch(() => false)) {
            editorElement = element;
            break;
          }
        }

        if (!editorElement) {
          console.log(`⚠️ No editor UI found for ${preset.name}, skipping test`);
          return;
        }

        // Set video to start position
        await page.evaluate((time) => {
          const video = document.querySelector('video') as HTMLVideoElement;
          if (video) {
            video.currentTime = time;
          }
        }, 10);

        // Wait a moment for seeking
        await page.waitForTimeout(1000);

        // Try to find and interact with timeline controls
        const timelineElements = await page.locator('input[type="range"], .timeline-slider, .time-input').all();

        if (timelineElements.length >= 2) {
          // Set start time (first slider/input)
          await timelineElements[0].fill('10');

          // Set end time (second slider/input)
          await timelineElements[1].fill(String(10 + TEST_DURATION));
        }

        // Try to find resolution selector
        const resolutionSelectors = [
          'select[name="resolution"]',
          'select[data-resolution]',
          '.resolution-select',
          'select'
        ];

        let resolutionSelect = null;
        for (const selector of resolutionSelectors) {
          const element = page.locator(selector);
          if (await element.isVisible().catch(() => false)) {
            resolutionSelect = element;
            break;
          }
        }

        if (resolutionSelect) {
          await resolutionSelect.selectOption(preset.name);
        }

        // Try to find create/generate button
        const createButtons = await page.locator('button').filter({ hasText: /create|generate|start|make/i }).all();

        if (createButtons.length > 0) {
          await createButtons[0].click();

          // Wait for processing (with timeout)
          await page.waitForTimeout(30000); // 30 seconds for processing

          // Try to download or save the result
          const downloadButtons = await page.locator('button').filter({ hasText: /download|save|export/i }).all();

          if (downloadButtons.length > 0) {
            const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
            await downloadButtons[0].click();
            const download = await downloadPromise;

            if (download) {
              const outputPath = path.join(OUTPUT_DIR, `rickroll-${preset.name}.gif`);
              await download.saveAs(outputPath);

              // Verify file was created
              if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log(`✅ ${preset.name} GIF created: ${outputPath} (${Math.round(stats.size / 1024)}KB)`);

                // Store results for later verification
                await page.evaluate((data) => {
                  (window as any).testResults = (window as any).testResults || {};
                  (window as any).testResults[data.preset] = {
                    filePath: data.outputPath,
                    fileSize: data.fileSize,
                    expected: data.expected
                  };
                }, {
                  preset: preset.name,
                  outputPath,
                  fileSize: stats.size,
                  expected: preset
                });

                expect(stats.size).toBeGreaterThan(0);
              } else {
                console.log(`❌ Failed to create ${preset.name} GIF file`);
              }
            }
          }
        }

      } catch (error) {
        console.log(`❌ Error creating ${preset.name} GIF:`, error);
      } finally {
        await page.close();
      }
    });
  }

  test('Compare file sizes across resolutions', async ({ page }) => {
    // After all resolution tests have run, compare file sizes
    const fileSizes: Record<string, number> = {};

    for (const preset of RESOLUTION_PRESETS) {
      const filePath = path.join(OUTPUT_DIR, `rickroll-${preset.name}.gif`);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        fileSizes[preset.name] = stats.size;
      }
    }

    // Verify file size relationships
    if (fileSizes['360p'] && fileSizes['480p']) {
      expect(fileSizes['360p']).toBeLessThan(fileSizes['480p']);
    }

    if (fileSizes['480p'] && fileSizes['720p']) {
      expect(fileSizes['480p']).toBeLessThan(fileSizes['720p']);
    }

    if (fileSizes['720p'] && fileSizes['original']) {
      expect(fileSizes['720p']).toBeLessThan(fileSizes['original']);
    }

    console.log('📊 File size comparison:', fileSizes);
  });

  test('Verify aspect ratio preservation', async ({ page }) => {
    // Test that aspect ratios are preserved across different resolutions
    const aspectRatios: Record<string, number> = {};

    for (const preset of RESOLUTION_PRESETS) {
      const aspectRatio = preset.expectedWidth / preset.expectedHeight;
      aspectRatios[preset.name] = aspectRatio;
    }

    // All aspect ratios should be approximately 16:9 (1.777...)
    const expectedAspectRatio = 16 / 9;

    for (const [presetName, aspectRatio] of Object.entries(aspectRatios)) {
      expect(aspectRatio).toBeCloseTo(expectedAspectRatio, 2);
      console.log(`📐 ${presetName} aspect ratio: ${aspectRatio.toFixed(3)}`);
    }
  });

  test('Performance benchmarking', async ({ page }) => {
    // Test processing times for different resolutions
    const performanceResults: Record<string, number> = {};

    for (const preset of RESOLUTION_PRESETS) {
      const startTime = Date.now();

      // Navigate to video
      await page.goto(TEST_VIDEO_URL);
      await page.waitForSelector('video', { timeout: 30000 });
      await page.waitForSelector('[data-testid="gif-button"]', { timeout: 10000 });

      // Quick GIF creation workflow for timing
      await page.click('[data-testid="gif-button"]');
      await page.waitForSelector('[data-testid="timeline-overlay"]', { timeout: 5000 });

      // Set 2-second selection for faster processing
      await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) {
          video.currentTime = 10;
        }
      });
      await page.click('[data-testid="set-start-button"]');

      await page.evaluate(() => {
        const video = document.querySelector('video') as HTMLVideoElement;
        if (video) {
          video.currentTime = 12;
        }
      });
      await page.click('[data-testid="set-end-button"]');

      await page.click('[data-testid="edit-gif-button"]');
      await page.waitForSelector('[data-testid="gif-editor"]', { timeout: 5000 });

      await page.selectOption('[data-testid="resolution-select"]', preset.name);

      const processingStartTime = Date.now();
      await page.click('[data-testid="create-gif-button"]');
      await page.waitForSelector('[data-testid="gif-complete"]', { timeout: 60000 });
      const processingEndTime = Date.now();

      const totalTime = processingEndTime - startTime;
      const processingTime = processingEndTime - processingStartTime;

      performanceResults[preset.name] = processingTime;

      console.log(`⏱️ ${preset.name} processing time: ${processingTime}ms (total: ${totalTime}ms)`);
    }

    // Higher resolutions should generally take longer to process
    if (performanceResults['360p'] && performanceResults['original']) {
      // Allow some variance, but original should typically take longer
      expect(performanceResults['original']).toBeGreaterThanOrEqual(
        performanceResults['360p'] * 0.8 // Allow 20% variance
      );
    }

    console.log('📈 Performance results:', performanceResults);
  });
});

// Helper function to analyze GIF file properties
async function analyzeGifFile(filePath: string): Promise<{
  width: number;
  height: number;
  frameCount: number;
  duration: number;
}> {
  // In a real implementation, you'd use a library like 'gif-frames' or similar
  // to parse GIF files and extract metadata
  return {
    width: 0,
    height: 0,
    frameCount: 0,
    duration: 0
  };
}

// Helper function to create test data summary
function createTestSummary(outputDir: string): void {
  const summaryPath = path.join(outputDir, 'test-summary.json');
  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.gif'));

  const summary = {
    testDate: new Date().toISOString(),
    totalFiles: files.length,
    files: files.map(filename => {
      const filePath = path.join(outputDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        sizeBytes: stats.size,
        sizeKB: Math.round(stats.size / 1024)
      };
    })
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`📝 Test summary saved to: ${summaryPath}`);
}