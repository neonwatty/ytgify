import { test } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';
import { YouTubePage, QuickCapturePage, TextOverlayPage, ProcessingPage, SuccessPage } from './page-objects';

/**
 * Debug test to examine frame capture behavior
 */
test.describe('Debug: Frame Capture', () => {
  test('Check captured frames from mock video', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    // Navigate and create GIF (use defaults)
    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(60000);

    await success.waitForScreen();

    // Check debug frames
    const debugFrames = await page.evaluate(() => {
      const win = window as Window & {
        __DEBUG_CAPTURED_FRAMES?: Array<{
          frameNumber: number;
          videoTime: number;
          targetTime: number;
          width: number;
          height: number;
          dataUrl: string;
          isDuplicate: boolean;
        }>;
      };
      return win.__DEBUG_CAPTURED_FRAMES || [];
    });

    console.log('\n📊 Frame Capture Debug Info:\n');
    console.log(`Total frames attempted: ${debugFrames.length}`);
    console.log(`Duplicates found: ${debugFrames.filter(f => f.isDuplicate).length}`);
    console.log(`Unique frames: ${debugFrames.filter(f => !f.isDuplicate).length}`);

    if (debugFrames.length > 0) {
      console.log('\nFrame details:');
      debugFrames.forEach((frame, i) => {
        const status = frame.isDuplicate ? '❌ DUPLICATE' : '✅ UNIQUE';
        const timeAccuracy = (frame.videoTime - frame.targetTime).toFixed(3);
        console.log(
          `  Frame ${frame.frameNumber}: ${status} | ` +
          `Target: ${frame.targetTime.toFixed(3)}s, ` +
          `Actual: ${frame.videoTime.toFixed(3)}s, ` +
          `Diff: ${timeAccuracy}s`
        );
      });

      // Check if video is stuck
      const uniqueTimes = new Set(debugFrames.map(f => f.videoTime.toFixed(3)));
      if (uniqueTimes.size < debugFrames.length / 2) {
        console.log('\n⚠️  WARNING: Video appears to be stuck at same time positions!');
        console.log(`Unique time positions: ${uniqueTimes.size} out of ${debugFrames.length} frames`);
      }
    } else {
      console.log('\n❌ No debug frames captured!');
    }
  });
});
