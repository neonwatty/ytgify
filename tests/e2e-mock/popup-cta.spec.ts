import { test, expect } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * E2E tests for popup footer CTA (primary prompt)
 * Tests engagement-based marketing prompts shown in extension popup
 */

interface EngagementData {
  installDate: number;
  totalGifsCreated: number;
  prompts: {
    primary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
    secondary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
  };
  milestones: {
    milestone10: boolean;
    milestone25: boolean;
    milestone50: boolean;
  };
  popupFooterDismissed: boolean;
}

/**
 * Helper to set engagement data in chrome.storage.local via background service worker
 */
async function setEngagementData(context: BrowserContext, data: Partial<EngagementData>): Promise<void> {
  const defaultData: EngagementData = {
    installDate: Date.now(),
    totalGifsCreated: 0,
    prompts: {
      primary: { shown: false },
      secondary: { shown: false },
    },
    milestones: {
      milestone10: false,
      milestone25: false,
      milestone50: false,
    },
    popupFooterDismissed: false,
  };

  const mergedData = { ...defaultData, ...data };

  // Get background service worker
  const serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length === 0) {
    throw new Error('No service workers found - extension may not be loaded');
  }

  const backgroundPage = serviceWorkers[0];

  // Set data via service worker context
  await backgroundPage.evaluate((mockData) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({ 'engagement-data': mockData }, () => {
        resolve();
      });
    });
  }, mergedData);

  // Wait for storage to settle and propagate
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Helper to read engagement data from chrome.storage.local
 */
async function getEngagementData(context: BrowserContext): Promise<EngagementData | null> {
  const serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length === 0) {
    return null;
  }

  const backgroundPage = serviceWorkers[0];

  return await backgroundPage.evaluate(() => {
    return new Promise<EngagementData>((resolve) => {
      chrome.storage.local.get('engagement-data', (result) => {
        resolve(result['engagement-data'] as EngagementData);
      });
    });
  });
}

/**
 * Helper to open extension popup
 * Waits for popup to be fully loaded before returning
 * Uses retry logic to handle flaky popup loading in headless mode
 */
async function openExtensionPopup(context: BrowserContext, maxRetries = 3): Promise<Page | null> {
  // Wait for service workers to be ready
  let serviceWorkers = context.serviceWorkers();
  let swRetries = 0;
  while (serviceWorkers.length === 0 && swRetries < 5) {
    await new Promise(resolve => setTimeout(resolve, 500));
    serviceWorkers = context.serviceWorkers();
    swRetries++;
  }

  if (serviceWorkers.length === 0) {
    console.error('[openExtensionPopup] No service workers found after retries');
    return null;
  }

  // Extract extension ID from service worker URL
  const url = serviceWorkers[0].url();
  const match = url.match(/chrome-extension:\/\/([^\/]+)/);
  if (!match) {
    console.error('[openExtensionPopup] Could not extract extension ID from URL:', url);
    return null;
  }

  const extensionId = match[1];

  // Retry loop for flaky popup loading
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const page = await context.newPage();

    try {
      // Listen for ALL console messages and page errors
      const consoleMessages: string[] = [];
      const pageErrors: string[] = [];

      page.on('console', msg => {
        const text = `[${msg.type()}] ${msg.text()}`;
        consoleMessages.push(text);
        if (msg.type() === 'error') {
          console.warn(`[openExtensionPopup] Console error: ${msg.text()}`);
        }
      });

      page.on('pageerror', error => {
        pageErrors.push(error.message);
        console.error(`[openExtensionPopup] Page error: ${error.message}`);
      });

      page.on('requestfailed', request => {
        console.warn(`[openExtensionPopup] Request failed: ${request.url()} - ${request.failure()?.errorText}`);
      });

      // Navigate and wait for network to settle
      await page.goto(`chrome-extension://${extensionId}/popup.html`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Wait for scripts to load and execute
      await page.waitForTimeout(2000);

      // Debug: Log DOM state
      const debugInfo = await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          rootExists: !!root,
          rootInnerHTML: root?.innerHTML?.substring(0, 300) || 'empty',
          rootChildCount: root?.children?.length || 0,
          hasLoadingSpinner: !!root?.querySelector('.loading'),
          hasPopupModern: !!root?.querySelector('.popup-modern'),
          hasPopupLoading: !!root?.querySelector('[data-testid="popup-loading"]'),
        };
      });
      console.log(`[openExtensionPopup] Attempt ${attempt} - DOM:`, JSON.stringify(debugInfo));

      // Log any page errors captured so far
      if (pageErrors.length > 0) {
        console.warn(`[openExtensionPopup] Attempt ${attempt} - Page errors:`, pageErrors);
      }

      // Check if the page has any content in #root beyond the static spinner
      const hasReactContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        if (!root) return false;
        // Check if React has mounted (look for React-specific elements)
        return root.querySelector('[data-testid="popup-loading"]') !== null ||
               root.querySelector('.popup-modern') !== null ||
               root.children.length > 1 ||
               (root.children.length === 1 && !root.children[0].classList.contains('loading'));
      });

      if (!hasReactContent) {
        // React hasn't mounted yet, wait longer
        await page.waitForTimeout(1000);
      }

      // Try to wait for either loading state or main UI
      try {
        await page.waitForSelector('[data-testid="popup-loading"], .popup-modern', {
          timeout: 8000,
        });
      } catch {
        // If we still don't see React content, log errors and retry
        if (pageErrors.length > 0) {
          console.warn(`[openExtensionPopup] Attempt ${attempt} - Page errors on failure:`, pageErrors);
        }
        console.log(`[openExtensionPopup] Attempt ${attempt} - Console messages:`, consoleMessages.slice(-10));
        if (attempt < maxRetries) {
          console.warn(`[openExtensionPopup] Attempt ${attempt} failed, retrying...`);
          await page.close();
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error('React did not mount in popup');
      }

      // Wait for auth check to complete and main UI to render
      await page.waitForSelector('.popup-modern', {
        timeout: 15000,
      });

      return page;
    } catch (error) {
      if (attempt < maxRetries) {
        console.warn(`[openExtensionPopup] Attempt ${attempt} failed:`, error);
        await page.close();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error(`[openExtensionPopup] All ${maxRetries} attempts failed`);
        await page.close();
        throw error;
      }
    }
  }

  return null;
}

test.describe('Popup CTA - Primary Prompt (Mock)', () => {
  test('shows footer at 5+ GIFs (qualifying state)', async ({ context, extensionId, mockServerUrl }) => {
    expect(extensionId).toBeTruthy();

    // Set qualifying engagement data (5 GIFs, not shown, not dismissed)
    await setEngagementData(context, {
      totalGifsCreated: 5,
      prompts: {
        primary: { shown: false },
        secondary: { shown: false },
      },
      popupFooterDismissed: false,
    });

    // Navigate to mock YouTube video (popup checks current tab)
    const page = await context.newPage();
    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Verify storage was set correctly before opening popup
    const verifyData = await getEngagementData(context);
    expect(verifyData).toBeTruthy();
    expect(verifyData!.totalGifsCreated).toBe(5);

    // Open popup (helper waits for .popup-modern to be ready)
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Wait for footer to render (it checks engagement data on mount)
    await popup!.waitForTimeout(1000);

    // Footer should be visible
    const footer = await popup!.$('.popup-footer');
    expect(footer).toBeTruthy();

    // Verify footer content
    const footerText = await footer!.textContent();
    expect(footerText).toContain('Enjoying YTGify? Leave us a review!');

    // Verify review link and dismiss button exist
    const reviewLink = await popup!.$('a:has-text("Leave us a review!")');
    const dismissBtn = await popup!.$('.dismiss-btn');

    expect(reviewLink).toBeTruthy();
    expect(dismissBtn).toBeTruthy();

    await popup!.close();
    await page.close();
  });

  test('hides footer at <5 GIFs (non-qualifying)', async ({ context, extensionId, mockServerUrl }) => {
    expect(extensionId).toBeTruthy();

    // Set non-qualifying engagement data (4 GIFs)
    await setEngagementData(context, {
      totalGifsCreated: 4,
      prompts: {
        primary: { shown: false },
        secondary: { shown: false },
      },
      popupFooterDismissed: false,
    });

    // Navigate to mock YouTube video
    const page = await context.newPage();
    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Open popup (helper waits for .popup-modern to be ready)
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Footer should NOT be visible
    const footer = await popup!.$('.popup-footer');
    expect(footer).toBeFalsy();

    await popup!.close();
    await page.close();
  });

  test('hides footer when dismissed', async ({ context, extensionId, mockServerUrl }) => {
    expect(extensionId).toBeTruthy();

    // Set qualifying state BUT dismissed
    await setEngagementData(context, {
      totalGifsCreated: 10,
      prompts: {
        primary: { shown: false },
        secondary: { shown: false },
      },
      popupFooterDismissed: true,
    });

    // Navigate to mock YouTube video
    const page = await context.newPage();
    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Open popup (helper waits for .popup-modern to be ready)
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Footer should NOT be visible because it was dismissed
    const footer = await popup!.$('.popup-footer');
    expect(footer).toBeFalsy();

    await popup!.close();
    await page.close();
  });

  test('hides footer when primary already shown', async ({ context, extensionId, mockServerUrl }) => {
    expect(extensionId).toBeTruthy();

    // Set qualifying GIF count BUT primary.shown = true
    await setEngagementData(context, {
      totalGifsCreated: 10,
      prompts: {
        primary: { shown: true },
        secondary: { shown: false },
      },
      popupFooterDismissed: false,
    });

    // Navigate to mock YouTube video
    const page = await context.newPage();
    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Open popup (helper waits for .popup-modern to be ready)
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Footer should NOT be visible because prompt was already shown
    const footer = await popup!.$('.popup-footer');
    expect(footer).toBeFalsy();

    await popup!.close();
    await page.close();
  });

  test('Dismiss button hides footer and persists to storage', async ({ context, extensionId, mockServerUrl }) => {
    expect(extensionId).toBeTruthy();

    // Set qualifying state
    await setEngagementData(context, {
      totalGifsCreated: 5,
      prompts: {
        primary: { shown: false },
        secondary: { shown: false },
      },
      popupFooterDismissed: false,
    });

    // Navigate to mock YouTube video
    const page = await context.newPage();
    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Open popup (helper waits for .popup-modern to be ready)
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();
    await popup!.waitForTimeout(1000);

    // Verify footer is initially visible
    let footer = await popup!.$('.popup-footer');
    expect(footer).toBeTruthy();

    // Click dismiss button
    const dismissBtn = await popup!.$('.dismiss-btn');
    expect(dismissBtn).toBeTruthy();
    await dismissBtn!.click();

    // Wait a moment for state update
    await popup!.waitForTimeout(500);

    // Footer should now be hidden
    footer = await popup!.$('.popup-footer');
    expect(footer).toBeFalsy();

    // Verify dismissal persisted to storage
    const updatedData = await getEngagementData(context);
    expect(updatedData).toBeTruthy();
    expect(updatedData!.popupFooterDismissed).toBe(true);

    await popup!.close();
    await page.close();
  });

  test('Review link triggers Chrome Web Store review page', async ({ context, extensionId, mockServerUrl }) => {
    expect(extensionId).toBeTruthy();

    // Set qualifying state
    await setEngagementData(context, {
      totalGifsCreated: 5,
      prompts: {
        primary: { shown: false },
        secondary: { shown: false },
      },
      popupFooterDismissed: false,
    });

    // Navigate to mock YouTube video
    const page = await context.newPage();
    await page.goto(getMockVideoUrl('veryShort', mockServerUrl));
    await page.waitForSelector('video', { timeout: 10000 });

    // Open popup (helper waits for .popup-modern to be ready)
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();
    await popup!.waitForTimeout(1000);

    // Verify footer is visible
    const footer = await popup!.$('.popup-footer');
    expect(footer).toBeTruthy();

    // Set up listener for new page/tab creation
    const newPagePromise = context.waitForEvent('page');

    // Click review link
    const reviewLink = await popup!.$('a:has-text("Leave us a review!")');
    expect(reviewLink).toBeTruthy();
    await reviewLink!.click();

    // Wait for new page to open
    const newPage = await newPagePromise;
    const newUrl = newPage.url();

    // Verify URL is Chrome Web Store review page
    expect(newUrl).toContain('chromewebstore.google.com');

    await newPage.close();
    await popup!.close();
    await page.close();
  });
});
