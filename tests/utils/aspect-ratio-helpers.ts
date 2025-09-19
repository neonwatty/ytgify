/**
 * Test utilities for aspect ratio testing
 */

interface MockVideoDimensions {
  width: number;
  height: number;
  description: string;
}

/**
 * Common video aspect ratios for testing
 */
export const TEST_VIDEO_DIMENSIONS: MockVideoDimensions[] = [
  // Standard aspect ratios
  { width: 1920, height: 1080, description: '16:9 (1080p)' },
  { width: 1280, height: 720, description: '16:9 (720p)' },
  { width: 3840, height: 2160, description: '16:9 (4K)' },

  // 4:3 aspect ratio
  { width: 1024, height: 768, description: '4:3 (XGA)' },
  { width: 800, height: 600, description: '4:3 (SVGA)' },

  // Ultrawide
  { width: 2560, height: 1080, description: '21:9 (Ultrawide)' },
  { width: 3440, height: 1440, description: '21:9 (UWQHD)' },

  // Portrait/Vertical
  { width: 1080, height: 1920, description: '9:16 (Portrait 1080p)' },
  { width: 720, height: 1280, description: '9:16 (Portrait 720p)' },

  // Square
  { width: 1080, height: 1080, description: '1:1 (Square)' },
  { width: 500, height: 500, description: '1:1 (Square Small)' },

  // Edge cases
  { width: 1920, height: 800, description: '2.4:1 (Cinema)' },
  { width: 640, height: 480, description: '4:3 (VGA)' },
  { width: 100, height: 100, description: '1:1 (Very Small)' },
  { width: 4096, height: 2160, description: '1.9:1 (DCI 4K)' },
];

/**
 * Create a mock HTMLVideoElement with specified dimensions
 */
export function createMockVideoElement(width: number, height: number): HTMLVideoElement {
  const video = document.createElement('video') as HTMLVideoElement;

  // Override the read-only properties
  Object.defineProperty(video, 'videoWidth', {
    value: width,
    writable: false,
    configurable: true
  });

  Object.defineProperty(video, 'videoHeight', {
    value: height,
    writable: false,
    configurable: true
  });

  // Mock other necessary properties
  Object.defineProperty(video, 'currentTime', {
    value: 0,
    writable: true,
    configurable: true
  });

  Object.defineProperty(video, 'paused', {
    value: false,
    writable: true,
    configurable: true
  });

  // Mock methods
  video.pause = jest.fn();
  video.play = jest.fn().mockResolvedValue(undefined);

  return video;
}

/**
 * Create a mock canvas context for testing
 */
function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    drawImage: jest.fn(),
    getImageData: jest.fn().mockReturnValue({
      data: new Uint8ClampedArray(4),
      width: 100,
      height: 100,
      colorSpace: 'srgb' as PredefinedColorSpace
    }),
    save: jest.fn(),
    restore: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    textAlign: 'center' as CanvasTextAlign,
    textBaseline: 'middle' as CanvasTextBaseline,
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

/**
 * Assert that dimensions maintain aspect ratio within tolerance
 */
export function assertAspectRatioPreserved(
  originalWidth: number,
  originalHeight: number,
  actualWidth: number,
  actualHeight: number,
  tolerance: number = 0.02
): void {
  const originalRatio = originalWidth / originalHeight;
  const actualRatio = actualWidth / actualHeight;
  const difference = Math.abs(originalRatio - actualRatio) / originalRatio;

  expect(difference).toBeLessThanOrEqual(tolerance);
}

/**
 * Assert that dimensions are even (required for video encoding)
 */
export function assertEvenDimensions(width: number, height: number): void {
  expect(width % 2).toBe(0);
  expect(height % 2).toBe(0);
}

/**
 * Assert that dimensions fit within specified bounds
 */
export function assertFitsWithinBounds(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): void {
  expect(width).toBeLessThanOrEqual(maxWidth);
  expect(height).toBeLessThanOrEqual(maxHeight);
}

/**
 * Calculate expected dimensions for a video fitting within bounds
 */
export function calculateExpectedDimensions(
  videoWidth: number,
  videoHeight: number,
  targetWidth: number,
  targetHeight: number
): { width: number; height: number } {
  const videoAspectRatio = videoWidth / videoHeight;
  const targetAspectRatio = targetWidth / targetHeight;

  let width: number;
  let height: number;

  if (videoAspectRatio > targetAspectRatio) {
    // Video is wider than target - fit to width
    width = targetWidth;
    height = Math.round(targetWidth / videoAspectRatio);
  } else {
    // Video is taller than target - fit to height
    height = targetHeight;
    width = Math.round(targetHeight * videoAspectRatio);
  }

  // Ensure even dimensions
  width = Math.floor(width / 2) * 2;
  height = Math.floor(height / 2) * 2;

  return { width, height };
}

/**
 * Test data for default dimension calculations
 */
export const DEFAULT_DIMENSION_TEST_CASES = [
  {
    video: { width: 1920, height: 1080 },
    expected: { width: 640, height: 360 },
    description: '16:9 landscape'
  },
  {
    video: { width: 1080, height: 1920 },
    expected: { width: 360, height: 640 },
    description: '9:16 portrait'
  },
  {
    video: { width: 1024, height: 768 },
    expected: { width: 640, height: 480 },
    description: '4:3 standard'
  },
  {
    video: { width: 2560, height: 1080 },
    expected: { width: 640, height: 270 },
    description: '21:9 ultrawide'
  },
  {
    video: { width: 1080, height: 1080 },
    expected: { width: 640, height: 640 },
    description: '1:1 square'
  }
];