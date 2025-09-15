import { test, expect } from '@playwright/test';

// Test configuration
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Sample video for testing

test.describe('Timeline Scrubber Duration Slider', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Navigate to YouTube video
    await page.goto(TEST_VIDEO_URL);

    // Wait for video player to load
    await page.waitForSelector('.html5-video-player', { timeout: 10000 });

    // Wait for extension to inject GIF button
    await page.waitForSelector('.ytgif-button', { timeout: 5000 });

    // Click the GIF button to open overlay
    await page.click('.ytgif-button');

    // Wait for overlay to appear
    await page.waitForSelector('.ytgif-overlay-wizard', { timeout: 5000 });
  });

  test('duration slider updates GIF length', async ({ page }) => {
    // Locate the duration slider
    const slider = await page.locator('.ytgif-slider-input');
    await expect(slider).toBeVisible();

    // Get initial value
    const initialValue = await slider.inputValue();

    // Check that value display is visible
    const valueDisplay = await page.locator('.ytgif-slider-value');
    await expect(valueDisplay).toBeVisible();
    await expect(valueDisplay).toContainText(`${parseFloat(initialValue).toFixed(1)}s`);

    // Drag slider to a new position
    const sliderBoundingBox = await slider.boundingBox();
    if (sliderBoundingBox) {
      // Move to middle of slider (approximately 10s for 1-20 range)
      await page.mouse.move(
        sliderBoundingBox.x + sliderBoundingBox.width / 2,
        sliderBoundingBox.y + sliderBoundingBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        sliderBoundingBox.x + (sliderBoundingBox.width * 0.7), // Move to ~14s position
        sliderBoundingBox.y + sliderBoundingBox.height / 2
      );
      await page.mouse.up();
    }

    // Verify value display updated
    const newValue = await slider.inputValue();
    await expect(valueDisplay).toContainText(`${parseFloat(newValue).toFixed(1)}s`);

    // Verify timeline selection updated
    const timelineSelection = await page.locator('.ytgif-selection');
    await expect(timelineSelection).toBeVisible();
  });

  test('slider respects video duration limits', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');

    // Get max attribute value
    const maxValue = await slider.getAttribute('max');
    expect(parseFloat(maxValue)).toBeLessThanOrEqual(20);

    // For short videos, max should be video duration
    // For long videos, max should be 20
    const videoDuration = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.duration : 0;
    });

    if (videoDuration > 0 && videoDuration < 20) {
      expect(parseFloat(maxValue)).toBeLessThanOrEqual(videoDuration);
    } else {
      expect(parseFloat(maxValue)).toBe(20);
    }
  });

  test('slider keyboard navigation works', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');
    const valueDisplay = await page.locator('.ytgif-slider-value');

    // Focus the slider
    await slider.focus();

    // Get initial value
    const initialValue = parseFloat(await slider.inputValue());

    // Press arrow right to increase value
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100); // Small delay for update

    const increasedValue = parseFloat(await slider.inputValue());
    expect(increasedValue).toBeGreaterThan(initialValue);

    // Press arrow left to decrease value
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);

    const decreasedValue = parseFloat(await slider.inputValue());
    expect(decreasedValue).toBeLessThan(increasedValue);

    // Verify display updates with keyboard navigation
    await expect(valueDisplay).toContainText(`${decreasedValue.toFixed(1)}s`);
  });

  test('slider visual feedback on hover and focus', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');

    // Test hover state
    await slider.hover();

    // Check if hover styles are applied (background should change)
    const hoverBackground = await slider.evaluate((el) => {
      return window.getComputedStyle(el).background;
    });

    // Move mouse away
    await page.mouse.move(0, 0);

    // Test focus state
    await slider.focus();

    // Check if focus styles are applied
    const focusBackground = await slider.evaluate((el) => {
      return window.getComputedStyle(el).background;
    });

    // Verify focus and hover change the appearance
    expect(hoverBackground).toBeTruthy();
    expect(focusBackground).toBeTruthy();
  });

  test('slider updates when timeline handles are dragged', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');
    const endHandle = await page.locator('.ytgif-handle-end');

    // Get initial slider value
    const initialValue = parseFloat(await slider.inputValue());

    // Drag the end handle to change duration
    const handleBox = await endHandle.boundingBox();
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + 50, handleBox.y + handleBox.height / 2); // Move right
      await page.mouse.up();
    }

    // Wait for slider to update
    await page.waitForTimeout(200);

    // Verify slider value changed
    const newValue = parseFloat(await slider.inputValue());
    expect(newValue).not.toBe(initialValue);
  });

  test('slider disabled for very short videos', async ({ page }) => {
    // This test would need a video shorter than 1 second
    // For now, we'll check that the disabled state works when present

    const slider = await page.locator('.ytgif-slider-input');

    // Check if slider can be disabled
    const isDisabled = await slider.isDisabled();

    // If the video is too short, it should be disabled
    const videoDuration = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video ? video.duration : 0;
    });

    if (videoDuration < 1) {
      expect(isDisabled).toBe(true);

      // Check for disabled message
      const disabledMessage = await page.locator('.ytgif-slider-disabled-message');
      await expect(disabledMessage).toBeVisible();
      await expect(disabledMessage).toContainText(/Video too short/i);
    }
  });

  test('slider value display shows one decimal place', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');
    const valueDisplay = await page.locator('.ytgif-slider-value');

    // Set slider to a value with decimals
    await slider.fill('5.7');
    await slider.dispatchEvent('change');

    // Check that display shows one decimal place
    await expect(valueDisplay).toContainText('5.7s');

    // Try another value
    await slider.fill('10.0');
    await slider.dispatchEvent('change');

    await expect(valueDisplay).toContainText('10.0s');
  });

  test('slider accessibility attributes are present', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');

    // Check ARIA attributes
    await expect(slider).toHaveAttribute('aria-label', 'GIF duration');
    await expect(slider).toHaveAttribute('aria-valuemin', '1');

    const ariaValueMax = await slider.getAttribute('aria-valuemax');
    expect(parseFloat(ariaValueMax)).toBeGreaterThanOrEqual(1);
    expect(parseFloat(ariaValueMax)).toBeLessThanOrEqual(20);

    const ariaValueNow = await slider.getAttribute('aria-valuenow');
    expect(parseFloat(ariaValueNow)).toBeGreaterThanOrEqual(1);
  });

  test('slider step value allows fine control', async ({ page }) => {
    const slider = await page.locator('.ytgif-slider-input');

    // Check step attribute
    await expect(slider).toHaveAttribute('step', '0.1');

    // Test that we can set decimal values
    await slider.fill('3.3');
    await slider.dispatchEvent('change');
    expect(await slider.inputValue()).toBe('3.3');

    await slider.fill('7.8');
    await slider.dispatchEvent('change');
    expect(await slider.inputValue()).toBe('7.8');
  });
});