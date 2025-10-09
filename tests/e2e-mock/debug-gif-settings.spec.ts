import { test } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';
import { YouTubePage, QuickCapturePage, TextOverlayPage, ProcessingPage, SuccessPage } from './page-objects';

/**
 * Debug test to check what settings are being passed to GIF creation
 */
test.describe('Debug: GIF Settings', () => {
  test('Check settings passed to GIF processor', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);

    // Navigate and open wizard
    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();

    // Inject a console spy to capture gifProcessor calls
    await page.evaluate(() => {
      // Spy on console.log
      const originalLog = console.log;
      (window as any).capturedLogs = [];
      console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('[gif-processor]') || message.includes('captureFrames') || message.includes('[ContentScriptGifProcessor]')) {
          (window as any).capturedLogs.push(message);
        }
        originalLog.apply(console, args);
      };
    });

    // Use defaults
    await quickCapture.clickNext();
    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    // Wait for processing to start
    await page.waitForTimeout(5000);

    // Get captured logs
    const capturedLogs = await page.evaluate(() => {
      return (window as any).capturedLogs || [];
    });

    console.log('\n📊 Captured GIF Processor Logs:\n');
    capturedLogs.forEach((log: string) => {
      console.log(log);
    });
  });
});
