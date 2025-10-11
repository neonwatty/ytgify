import { test, expect } from './fixtures';
import { handleYouTubeCookieConsent } from './helpers/extension-helpers';

/**
 * YouTube Layout Integrity Tests
 *
 * These tests verify that the extension does not interfere with YouTube's native layout.
 * The fix involved removing static CSS injection from manifest.json and loading CSS
 * dynamically only when the GIF wizard opens.
 *
 * Note: Subscription and home feed tests are excluded as they don't work in automated
 * test environments (YouTube API limitations), but channel pages work reliably.
 */
test.describe('YouTube Layout Integrity', () => {

  test('Channel videos page renders correctly', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('https://www.youtube.com/@SmoothSounds/videos');
    await handleYouTubeCookieConsent(page);

    // Wait for video grid
    await page.waitForSelector('ytd-rich-item-renderer, ytd-grid-video-renderer', { timeout: 20000 });

    const videos = await page.$$('ytd-rich-item-renderer, ytd-grid-video-renderer');
    expect(videos.length).toBeGreaterThan(0);
    console.log(`✅ Found ${videos.length} videos on channel page`);

    // Verify videos are visible and have reasonable dimensions
    const videoDimensions = await page.$$eval(
      'ytd-rich-item-renderer, ytd-grid-video-renderer',
      (elements) => {
        return elements.slice(0, 3).map((el) => {
          const rect = el.getBoundingClientRect();
          const computed = window.getComputedStyle(el);
          return {
            width: rect.width,
            height: rect.height,
            display: computed.display,
            visible: rect.width > 0 && rect.height > 0,
          };
        });
      }
    );

    // All videos should be visible with reasonable dimensions
    videoDimensions.forEach((dim, index) => {
      expect(dim.visible).toBe(true);
      expect(dim.width).toBeGreaterThan(100);
      expect(dim.height).toBeGreaterThan(100);
      expect(dim.display).not.toBe('none');
    });

    console.log(`✅ Channel videos page layout intact - all videos visible and properly sized`);
  });


  test('Search results page renders correctly', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('https://www.youtube.com/results?search_query=test');
    await handleYouTubeCookieConsent(page);

    // Wait for search results
    await page.waitForSelector('ytd-video-renderer', { timeout: 20000 });

    const results = await page.$$('ytd-video-renderer');
    expect(results.length).toBeGreaterThan(0);
    console.log(`✅ Found ${results.length} search results`);

    // Verify search results have proper layout
    const resultLayouts = await page.$$eval('ytd-video-renderer', (elements) => {
      return elements.slice(0, 3).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          visible: rect.width > 0 && rect.height > 0,
          width: rect.width,
        };
      });
    });

    resultLayouts.forEach((layout) => {
      expect(layout.visible).toBe(true);
      expect(layout.width).toBeGreaterThan(500);
    });

    console.log(`✅ Search results layout intact`);
  });
});
