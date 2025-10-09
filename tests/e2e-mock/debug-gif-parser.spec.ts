import { test } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';
import { YouTubePage, QuickCapturePage, TextOverlayPage, ProcessingPage, SuccessPage } from './page-objects';
import { examineGifBuffer } from '../debug-gif-structure';
import { urlToBuffer } from './helpers/gif-validator-mock';

/**
 * Debug test to examine GIF structure
 */
test.describe('Debug: GIF Parser', () => {
  test('Examine generated GIF structure', async ({ page, mockServerUrl }) => {
    test.setTimeout(90000);

    const youtube = new YouTubePage(page);
    const quickCapture = new QuickCapturePage(page);
    const textOverlay = new TextOverlayPage(page);
    const processing = new ProcessingPage(page);
    const success = new SuccessPage(page);

    // Navigate and create GIF (use defaults to avoid selector issues)
    await youtube.navigateToVideo(getMockVideoUrl('veryShort', mockServerUrl));
    await youtube.openGifWizard();
    await quickCapture.waitForScreen();
    // Use default settings
    await quickCapture.clickNext();

    await textOverlay.waitForScreen();
    await textOverlay.clickSkip();

    await processing.waitForCompletion(60000);

    await success.waitForScreen();
    const gifUrl = await success.getGifUrl();

    console.log('GIF URL obtained:', gifUrl?.substring(0, 50) + '...');

    // Convert to buffer and examine
    const buffer = await urlToBuffer(page, gifUrl!);
    console.log('\n📊 Examining GIF buffer structure...\n');
    await examineGifBuffer(buffer);
  });
});
