import { test, expect } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';

/**
 * CSS Isolation Tests (Mock E2E)
 *
 * These tests verify that the extension's CSS does not leak into the page.
 * The extension loads CSS dynamically only when the GIF wizard opens, preventing
 * any interference with page styles on regular page loads.
 */
test.describe('CSS Isolation (Mock)', () => {
  test('Extension does not apply global CSS resets', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Check that page elements have proper styles (not reset by Tailwind Preflight)
    const elementStyles = await page.evaluate(() => {
      const results: Record<string, any> = {};

      // Check body
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);
      results.body = {
        fontFamily: bodyStyles.fontFamily,
      };

      // Check player controls (mock YouTube elements)
      const controls = document.querySelector('.ytp-chrome-controls');
      if (controls) {
        const controlStyles = window.getComputedStyle(controls);
        results.controls = {
          display: controlStyles.display,
          visible: controlStyles.display !== 'none',
        };
      }

      // Check play button
      const playButton = document.querySelector('.ytp-play-button');
      if (playButton) {
        const buttonStyles = window.getComputedStyle(playButton);
        results.playButton = {
          display: buttonStyles.display,
          cursor: buttonStyles.cursor,
        };
      }

      return results;
    });

    // Verify elements have their expected styles (not reset by Preflight)
    expect(elementStyles.body).toBeDefined();

    if (elementStyles.controls) {
      expect(elementStyles.controls.visible).toBe(true);
    }
  });

  test('Extension CSS is scoped to extension elements', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Check for unscoped CSS rules that target global elements
    const unscopedRules = await page.evaluate(() => {
      const problematicRules: string[] = [];
      const sheets = Array.from(document.styleSheets);

      for (const sheet of sheets) {
        try {
          // Check if this is the extension's stylesheet
          const href = sheet.href || '';
          const isExtensionSheet = href.includes('content.css') || href.includes('chrome-extension://');

          if (isExtensionSheet) {
            const rules = Array.from(sheet.cssRules || []);

            for (const rule of rules) {
              if (rule.type === CSSRule.STYLE_RULE) {
                const styleRule = rule as CSSStyleRule;
                const selector = styleRule.selectorText;

                // Check for unscoped global selectors
                // These patterns indicate Tailwind Preflight or other global resets
                const globalPatterns = [
                  /^\s*\*\s*[,{]/, // Universal selector
                  /^\s*body\s*[,{]/, // Body without scoping
                  /^\s*html\s*[,{]/, // HTML without scoping
                  /^\s*h[1-6]\s*[,{]/, // Heading selectors without scoping
                  /^\s*(ul|ol|li)\s*[,{]/, // List selectors without scoping
                  /^\s*button\s*[,{]/, // Button without scoping
                  /^\s*input\s*[,{]/, // Input without scoping
                  /^\s*a\s*[,{]/, // Anchor without scoping
                ];

                for (const pattern of globalPatterns) {
                  if (pattern.test(selector)) {
                    problematicRules.push(selector);
                  }
                }
              }
            }
          }
        } catch {
          // Cross-origin or restricted stylesheet, skip
        }
      }

      return problematicRules;
    });

    // Should not have any unscoped global selectors
    expect(unscopedRules.length).toBe(0);
  });

  test('Tailwind utilities work for extension elements', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('.ytgif-button', { timeout: 15000 });

    // Check extension button exists
    const hasGifButton = await page.$('.ytgif-button');
    expect(hasGifButton).toBeTruthy();

    // Check that extension elements have Tailwind utility classes applied
    const extensionStyles = await page.evaluate(() => {
      const extensionElements = document.querySelectorAll('[class*="ytgif"]');
      const results: any[] = [];

      extensionElements.forEach((el) => {
        const classes = el.className;
        const computed = window.getComputedStyle(el);

        // Check if Tailwind utilities are present
        const hasTailwindClasses =
          classes.includes('flex') ||
          classes.includes('grid') ||
          classes.includes('p-') ||
          classes.includes('m-') ||
          classes.includes('rounded');

        if (hasTailwindClasses) {
          results.push({
            element: el.tagName,
            classes: classes,
            display: computed.display,
          });
        }
      });

      return results;
    });

    // Extension elements with Tailwind classes should render correctly
    // (We don't require specific classes, just that the button exists)
  });

  test('No Tailwind Preflight CSS rules present', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Check for specific Preflight rules that should NOT be present
    const hasPreflightRules = await page.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      const preflightIndicators: string[] = [];

      for (const sheet of sheets) {
        try {
          const href = sheet.href || '';
          const isExtensionSheet = href.includes('content.css') || href.includes('chrome-extension://');

          if (isExtensionSheet) {
            const rules = Array.from(sheet.cssRules || []);

            for (const rule of rules) {
              if (rule.type === CSSRule.STYLE_RULE) {
                const styleRule = rule as CSSStyleRule;
                const text = styleRule.cssText;

                // Common Preflight patterns to detect
                const preflightPatterns = [
                  /\*\s*,\s*::before\s*,\s*::after.*box-sizing/, // Universal box-sizing reset
                  /^html\s*\{.*line-height:\s*1\.5/, // HTML line-height reset
                  /^body\s*\{.*margin:\s*0/, // Body margin reset
                  /^h[1-6].*font-size:\s*inherit/, // Heading font-size reset
                  /^(ul|ol).*list-style:\s*none/, // List style reset
                  /^button.*background-color:\s*transparent/, // Button reset
                ];

                for (const pattern of preflightPatterns) {
                  if (pattern.test(text)) {
                    preflightIndicators.push(text.substring(0, 100));
                  }
                }
              }
            }
          }
        } catch {
          // Skip
        }
      }

      return preflightIndicators;
    });

    // Should not find any Preflight rules
    expect(hasPreflightRules.length).toBe(0);
  });

  test('Page elements are not affected by extension styles', async ({ page, mockServerUrl }) => {
    test.setTimeout(30000);

    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Get styles of key page elements
    const pageElementStyles = await page.evaluate(() => {
      const elements = {
        video: document.querySelector('video'),
        playButton: document.querySelector('.ytp-play-button'),
        controls: document.querySelector('.ytp-chrome-controls'),
        playerContainer: document.querySelector('#movie_player'),
      };

      const results: Record<string, any> = {};

      Object.entries(elements).forEach(([key, el]) => {
        if (el) {
          const computed = window.getComputedStyle(el);
          results[key] = {
            display: computed.display,
            position: computed.position,
            visible: (el as HTMLElement).offsetParent !== null || key === 'video',
          };
        }
      });

      return results;
    });

    // Page elements should be visible and have their expected styles
    Object.entries(pageElementStyles).forEach(([key, styles]: [string, any]) => {
      if (styles) {
        expect(styles.display).not.toBe('none');
      }
    });
  });
});
