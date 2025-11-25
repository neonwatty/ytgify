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
 */
async function openExtensionPopup(context: BrowserContext): Promise<Page | null> {
  const serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length === 0) {
    return null;
  }

  // Extract extension ID from service worker URL
  const url = serviceWorkers[0].url();
  const match = url.match(/chrome-extension:\/\/([^\/]+)/);
  if (!match) {
    return null;
  }

  const extensionId = match[1];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
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

    // Open popup
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Wait for popup to render
    await popup!.waitForSelector('.popup-modern', { timeout: 5000 });

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

    // Open popup
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Wait for popup to render
    await popup!.waitForSelector('.popup-modern', { timeout: 5000 });

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

    // Open popup
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Wait for popup to render
    await popup!.waitForSelector('.popup-modern', { timeout: 5000 });

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

    // Open popup
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();

    // Wait for popup to render
    await popup!.waitForSelector('.popup-modern', { timeout: 5000 });

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

    // Open popup
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();
    await popup!.waitForSelector('.popup-modern', { timeout: 5000 });
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

    // Open popup
    const popup = await openExtensionPopup(context);
    expect(popup).toBeTruthy();
    await popup!.waitForSelector('.popup-modern', { timeout: 5000 });
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
