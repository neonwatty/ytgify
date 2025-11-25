import { test, expect } from './fixtures';

/**
 * YouTube Layout Integrity Tests (Mock)
 *
 * These tests verify that the extension does not interfere with YouTube's native layout.
 * Uses mock YouTube pages to validate that page elements render correctly when the
 * extension is loaded.
 */
test.describe('YouTube Layout Integrity (Mock)', () => {

  test('Channel videos page renders correctly', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(`${mockServerUrl}/@MockChannel/videos`);

    // Wait for video grid to load
    await page.waitForSelector('ytd-rich-item-renderer', { timeout: 10000 });

    const videos = await page.$$('ytd-rich-item-renderer');
    expect(videos.length).toBeGreaterThan(0);

    // Verify videos are visible and have reasonable dimensions
    const videoDimensions = await page.$$eval(
      'ytd-rich-item-renderer',
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
    videoDimensions.forEach((dim) => {
      expect(dim.visible).toBe(true);
      expect(dim.width).toBeGreaterThan(100);
      expect(dim.height).toBeGreaterThan(100);
      expect(dim.display).not.toBe('none');
    });
  });

  test('Search results page renders correctly', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(`${mockServerUrl}/results?search_query=test`);

    // Wait for search results to load
    await page.waitForSelector('ytd-video-renderer', { timeout: 10000 });

    const results = await page.$$('ytd-video-renderer');
    expect(results.length).toBeGreaterThan(0);

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
      expect(layout.width).toBeGreaterThan(400);
    });
  });

  test('Masthead elements render correctly on channel page', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(`${mockServerUrl}/@MockChannel/videos`);

    // Wait for page to load
    await page.waitForSelector('#masthead-container', { timeout: 10000 });

    // Check masthead elements
    const mastheadElements = await page.evaluate(() => {
      const logo = document.querySelector('#logo');
      const search = document.querySelector('#search');

      const results: Record<string, any> = {};

      if (logo) {
        const logoRect = logo.getBoundingClientRect();
        results.logo = {
          visible: logoRect.width > 0 && logoRect.height > 0,
          width: logoRect.width,
          height: logoRect.height,
        };
      }

      if (search) {
        const searchRect = search.getBoundingClientRect();
        results.search = {
          visible: searchRect.width > 0 && searchRect.height > 0,
          width: searchRect.width,
        };
      }

      return results;
    });

    // Logo should be visible
    if (mastheadElements.logo) {
      expect(mastheadElements.logo.visible).toBe(true);
      expect(mastheadElements.logo.width).toBeGreaterThan(50);
    }

    // Search box should be visible
    if (mastheadElements.search) {
      expect(mastheadElements.search.visible).toBe(true);
      expect(mastheadElements.search.width).toBeGreaterThan(100);
    }
  });

  test('Video titles render correctly on channel page', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(`${mockServerUrl}/@MockChannel/videos`);

    // Wait for video grid to load
    await page.waitForSelector('h3.ytd-rich-item-renderer', { timeout: 10000 });

    // Check video title styles
    const titleStyles = await page.$$eval('h3.ytd-rich-item-renderer', (elements) => {
      return elements.slice(0, 3).map((el) => {
        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          fontSize: parseInt(computed.fontSize),
          visible: rect.width > 0 && rect.height > 0,
          display: computed.display,
          text: el.textContent?.trim() || '',
        };
      });
    });

    // Titles should be visible with reasonable font size
    titleStyles.forEach((style) => {
      expect(style.visible).toBe(true);
      expect(style.fontSize).toBeGreaterThan(10); // Should have reasonable font size
      expect(style.display).not.toBe('none');
      expect(style.text.length).toBeGreaterThan(0); // Should have text content
    });
  });

  test('Grid layout is intact on channel page', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(`${mockServerUrl}/@MockChannel/videos`);

    // Wait for grid to load
    await page.waitForSelector('ytd-rich-grid-renderer', { timeout: 10000 });

    // Check grid layout
    const gridStyles = await page.evaluate(() => {
      const grid = document.querySelector('ytd-rich-grid-renderer');
      if (!grid) return null;

      const computed = window.getComputedStyle(grid);
      const rect = grid.getBoundingClientRect();

      return {
        display: computed.display,
        visible: rect.width > 0 && rect.height > 0,
        width: rect.width,
        height: rect.height,
      };
    });

    expect(gridStyles).not.toBeNull();
    expect(gridStyles!.display).toBe('grid');
    expect(gridStyles!.visible).toBe(true);
    expect(gridStyles!.width).toBeGreaterThan(200);
  });
});
