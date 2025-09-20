import { Page, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Helper functions for Chrome extension testing
 */

/**
 * Get the extension ID from the loaded context
 */
export async function getExtensionId(context: BrowserContext): Promise<string | null> {
  const serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length > 0) {
    const url = serviceWorkers[0].url();
    const match = url.match(/chrome-extension:\/\/([^\/]+)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Open the extension popup page
 */
export async function openExtensionPopup(context: BrowserContext): Promise<Page | null> {
  const extensionId = await getExtensionId(context);
  if (!extensionId) return null;

  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  return page;
}

/**
 * Wait for extension to be fully loaded on YouTube page
 */
export async function waitForExtensionReady(page: Page, timeout: number = 30000): Promise<boolean> {
  try {
    // Wait for the GIF button to be injected
    await page.waitForFunction(
      () => {
        const button = document.querySelector('.ytgif-button, [aria-label*="GIF"]');
        return button !== null;
      },
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if extension is properly injected
 */
export async function isExtensionInjected(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    // Check for any extension-specific elements
    const elements = [
      '.ytgif-button',
      '[aria-label*="GIF"]',
      '.ytgif-overlay-wizard',
    ];
    return elements.some(selector => document.querySelector(selector) !== null);
  });
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${name}-${timestamp}.png`;
  const filePath = path.join(__dirname, '..', '..', 'screenshots', fileName);

  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  await page.screenshot({
    path: filePath,
    fullPage: false,
  });

  return filePath;
}

/**
 * Wait for and dismiss YouTube's cookie consent if present
 */
export async function handleYouTubeCookieConsent(page: Page): Promise<void> {
  try {
    // Check for cookie consent dialog
    const consentButton = page.locator(
      'button:has-text("Accept all"), button:has-text("Reject all"), button:has-text("Accept")'
    ).first();

    if (await consentButton.isVisible({ timeout: 5000 })) {
      await consentButton.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No consent dialog, continue
  }
}

/**
 * Validate that a GIF file was created correctly
 */
export async function validateGifFile(filePath: string): Promise<{
  valid: boolean;
  size: number;
  error?: string;
}> {
  try {
    const stats = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);

    // Check GIF magic number (GIF87a or GIF89a)
    const header = buffer.toString('ascii', 0, 6);
    const isGif = header === 'GIF87a' || header === 'GIF89a';

    if (!isGif) {
      return {
        valid: false,
        size: stats.size,
        error: 'File is not a valid GIF',
      };
    }

    // Check minimum size (at least 100 bytes for a tiny GIF)
    if (stats.size < 100) {
      return {
        valid: false,
        size: stats.size,
        error: 'GIF file is too small',
      };
    }

    return {
      valid: true,
      size: stats.size,
    };
  } catch (error) {
    return {
      valid: false,
      size: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wait for element with smart polling and exponential backoff
 */
export async function waitForElementSmart(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    initialDelay?: number;
    maxRetries?: number;
  } = {}
): Promise<boolean> {
  const { timeout = 30000, initialDelay = 500, maxRetries = 8 } = options;
  const startTime = Date.now();
  let retries = 0;

  while (Date.now() - startTime < timeout && retries < maxRetries) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible();
        if (isVisible) return true;
      }
    } catch {
      // Continue retrying
    }

    const delay = initialDelay * Math.pow(1.5, retries);
    await page.waitForTimeout(Math.min(delay, 5000));
    retries++;
  }

  return false;
}

/**
 * Wait for condition with polling
 */
export async function waitForCondition(
  page: Page,
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    pollInterval?: number;
  } = {}
): Promise<boolean> {
  const { timeout = 30000, pollInterval = 500 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await condition();
      if (result) return true;
    } catch {
      // Continue polling
    }
    await page.waitForTimeout(pollInterval);
  }

  return false;
}

/**
 * Wait for GIF button with retry logic
 */
export async function waitForGifButton(
  page: Page,
  timeout: number = 30000
): Promise<boolean> {
  const selectors = [
    '.ytgif-button',
    '[aria-label*="GIF"]',
    '.ytp-right-controls button.ytgif-button'
  ];

  // Try each selector with a portion of the total timeout
  const timePerSelector = Math.max(5000, timeout / selectors.length);

  for (const selector of selectors) {
    const found = await waitForElementSmart(page, selector, {
      timeout: timePerSelector,
      initialDelay: 300,
      maxRetries: 8
    });
    if (found) return true;
  }

  return false;
}

/**
 * Clean up test artifacts older than specified days
 */
export async function cleanupOldArtifacts(daysOld: number = 7): Promise<void> {
  const dirs = ['screenshots', 'downloads', 'videos'];
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

  for (const dir of dirs) {
    const dirPath = path.join(__dirname, '..', '..', dir);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        if (stats.mtimeMs < cutoffTime) {
          await fs.unlink(filePath);
        }
      }
    } catch {
      // Directory might not exist yet
    }
  }
}

/**
 * Wait for video to be playable
 */
export async function waitForVideoReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const video = document.querySelector('video') as HTMLVideoElement;
      return video && video.readyState >= 3; // HAVE_FUTURE_DATA
    },
    { timeout: 30000 }
  );
}

/**
 * Get video metadata
 */
export async function getVideoMetadata(page: Page): Promise<{
  duration: number;
  currentTime: number;
  paused: boolean;
  width: number;
  height: number;
}> {
  return await page.evaluate(() => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (!video) {
      throw new Error('Video element not found');
    }
    return {
      duration: video.duration,
      currentTime: video.currentTime,
      paused: video.paused,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  });
}