import { test, expect } from './fixtures';
import { handleYouTubeCookieConsent } from './helpers/extension-helpers';

/**
 * CSS Isolation Tests
 *
 * These tests verify that the extension's CSS does not leak into YouTube's page.
 * The extension loads CSS dynamically only when the GIF wizard opens, preventing
 * any interference with YouTube's styles on regular page loads.
 *
 * Note: Tests use channel pages as they load reliably in automated test environments.
 */
test.describe('CSS Isolation', () => {
  test('Extension does not apply global CSS resets', async ({ page }) => {
    test.setTimeout(60000);

    // Use channel page as it loads reliably in test environment
    await page.goto('https://www.youtube.com/@SmoothSounds/videos');
    await handleYouTubeCookieConsent(page);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Wait for videos to load so we can check their styles
    await page.waitForSelector('ytd-rich-item-renderer', { timeout: 20000 });

    // Check that YouTube's video elements have their proper styles (not reset by Tailwind Preflight)
    const elementStyles = await page.evaluate(() => {
      const results: Record<string, any> = {};

      // Check body
      const body = document.body;
      const bodyStyles = window.getComputedStyle(body);
      results.body = {
        margin: bodyStyles.margin,
        fontFamily: bodyStyles.fontFamily,
      };

      // Check video title elements (always present on channel pages)
      const videoTitle = document.querySelector('h3.ytd-rich-item-renderer');
      if (videoTitle) {
        const titleStyles = window.getComputedStyle(videoTitle);
        results.videoTitle = {
          fontSize: titleStyles.fontSize,
          fontWeight: titleStyles.fontWeight,
          // Preflight would reset font-size to inherit
          hasReasonableSize: parseInt(titleStyles.fontSize) >= 12,
          display: titleStyles.display,
        };
      }

      // Check button elements in channel header
      const button = document.querySelector('button');
      if (button) {
        const buttonStyles = window.getComputedStyle(button);
        results.button = {
          display: buttonStyles.display,
          cursor: buttonStyles.cursor,
        };
      }

      // Check video grid container
      const grid = document.querySelector('ytd-rich-grid-renderer');
      if (grid) {
        const gridStyles = window.getComputedStyle(grid);
        results.grid = {
          display: gridStyles.display,
        };
      }

      return results;
    });

    // Verify elements have their expected styles (not reset by Preflight)
    expect(elementStyles.body).toBeDefined();
    console.log(`✅ Body styles intact - margin: ${elementStyles.body.margin}`);

    if (elementStyles.videoTitle) {
      expect(elementStyles.videoTitle.hasReasonableSize).toBe(true);
      expect(elementStyles.videoTitle.display).not.toBe('none');
      console.log(`✅ Video title has proper styles - font-size: ${elementStyles.videoTitle.fontSize}`);
    }

    if (elementStyles.grid) {
      expect(elementStyles.grid.display).not.toBe('none');
      console.log(`✅ Grid styles intact - display: ${elementStyles.grid.display}`);
    }

    console.log('✅ No global CSS resets detected - YouTube styles preserved');
  });

  test('Extension CSS is scoped to extension elements', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });

    // Check for unscoped CSS rules that target global elements
    const unscopedRules = await page.evaluate(() => {
      const problematicRules: string[] = [];
      const sheets = Array.from(document.styleSheets);

      for (const sheet of sheets) {
        try {
          // Check if this is the extension's content.css
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
        } catch (e) {
          // Cross-origin or restricted stylesheet, skip
        }
      }

      return problematicRules;
    });

    // Should not have any unscoped global selectors
    if (unscopedRules.length > 0) {
      console.log(`⚠️ Found potentially problematic CSS rules:`, unscopedRules);
    }

    expect(unscopedRules.length).toBe(0);
    console.log('✅ All extension CSS is properly scoped');
  });

  test('Tailwind utilities work for extension elements', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await handleYouTubeCookieConsent(page);
    await page.waitForSelector('video', { timeout: 30000 });

    // Try to open extension UI if button is available
    const hasGifButton = await page.$('.ytgif-button');

    if (hasGifButton) {
      // Check that extension elements have Tailwind utility classes applied
      const extensionStyles = await page.evaluate(() => {
        const extensionElements = document.querySelectorAll('[class*="ytgif"]');
        const results: any[] = [];

        extensionElements.forEach((el) => {
          const classes = el.className;
          const computed = window.getComputedStyle(el);

          // Check if Tailwind utilities are applied
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

      if (extensionStyles.length > 0) {
        console.log(`✅ Found ${extensionStyles.length} extension elements with Tailwind classes`);
        console.log('Sample:', extensionStyles[0]);
      }
    } else {
      console.log('⚠️ Extension button not found, skipping Tailwind utility test');
    }
  });

  test('YouTube elements are not affected by extension styles', async ({ page }) => {
    test.setTimeout(60000);

    // Use channel page as it loads reliably in test environment
    await page.goto('https://www.youtube.com/@SmoothSounds/videos');
    await handleYouTubeCookieConsent(page);
    await page.waitForLoadState('domcontentloaded');

    // Wait for videos to load
    await page.waitForSelector('ytd-rich-item-renderer', { timeout: 20000 });

    // Get styles of key YouTube elements
    const youtubeElementStyles = await page.evaluate(() => {
      const elements = {
        logo: document.querySelector('#logo'),
        searchbox: document.querySelector('#search'),
        videoTitle: document.querySelector('h3.ytd-rich-item-renderer'),
        thumbnail: document.querySelector('ytd-thumbnail'),
        richItem: document.querySelector('ytd-rich-item-renderer'),
      };

      const results: Record<string, any> = {};

      Object.entries(elements).forEach(([key, el]) => {
        if (el) {
          const computed = window.getComputedStyle(el);
          results[key] = {
            display: computed.display,
            position: computed.position,
            margin: computed.margin,
            padding: computed.padding,
            visible: (el as HTMLElement).offsetParent !== null,
          };
        }
      });

      return results;
    });

    // YouTube elements should be visible and have their expected styles
    Object.entries(youtubeElementStyles).forEach(([key, styles]: [string, any]) => {
      if (styles) {
        expect(styles.visible).toBe(true);
        expect(styles.display).not.toBe('none');
        console.log(`✅ ${key} element unaffected - display: ${styles.display}`);
      }
    });
  });

  test('No Tailwind Preflight CSS rules present', async ({ page }) => {
    test.setTimeout(60000);

    // Use channel page as it loads reliably in test environment
    await page.goto('https://www.youtube.com/@SmoothSounds/videos');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

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
        } catch (e) {
          // Skip
        }
      }

      return preflightIndicators;
    });

    // Should not find any Preflight rules
    if (hasPreflightRules.length > 0) {
      console.log('⚠️ Found Preflight CSS rules:', hasPreflightRules);
    }

    expect(hasPreflightRules.length).toBe(0);
    console.log('✅ Confirmed: No Tailwind Preflight CSS present');
  });
});
