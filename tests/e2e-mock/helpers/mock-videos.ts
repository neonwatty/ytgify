/**
 * Mock video definitions for testing
 * These videos should exist in tests/e2e-mock/fixtures/videos/
 */

export interface MockVideo {
  id: string;
  title: string;
  duration: number;
  width: number;
  height: number;
  filename: string;
  description: string;
}

/**
 * Available mock videos for testing
 * Each video ID corresponds to a video file that should be generated or placed in fixtures/videos/
 */
export const MOCK_VIDEOS: Record<string, MockVideo> = {
  veryShort: {
    id: 'mock-short',
    title: 'Test Short Video (20s)',
    duration: 20,
    width: 640,
    height: 360,
    filename: 'test-short-20s.webm',
    description: '20-second test video for duration tests (supports 1s-10s GIF creation)'
  },

  medium: {
    id: 'mock-medium',
    title: 'Test Medium Video (10s)',
    duration: 10,
    width: 1280,
    height: 720,
    filename: 'test-medium-10s.webm',
    description: 'Medium length 10-second HD video for standard tests'
  },

  long: {
    id: 'mock-long',
    title: 'Test Long Video (20s)',
    duration: 20,
    width: 1920,
    height: 1080,
    filename: 'test-long-20s.webm',
    description: 'Longer 20-second Full HD video for extended duration tests'
  },

  hd: {
    id: 'mock-hd',
    title: 'Test HD Video (15s)',
    duration: 15,
    width: 1920,
    height: 1080,
    filename: 'test-hd-15s.webm',
    description: '15-second Full HD video for resolution testing'
  }
};

/**
 * Get a mock video URL for the given video key
 * @param videoKey - The key from MOCK_VIDEOS (e.g., 'veryShort', 'medium')
 * @param serverBaseUrl - The base URL of the mock server (e.g., 'http://localhost:3000')
 * @returns Full URL to the mock YouTube watch page
 */
export function getMockVideoUrl(videoKey: string, serverBaseUrl: string): string {
  const video = MOCK_VIDEOS[videoKey];
  if (!video) {
    throw new Error(`Mock video not found: ${videoKey}. Available videos: ${Object.keys(MOCK_VIDEOS).join(', ')}`);
  }
  return `${serverBaseUrl}/watch?v=${video.id}`;
}

/**
 * Get a mock video by duration requirement (finds closest match)
 * @param maxDuration - Maximum duration in seconds
 * @returns The closest matching video
 */
export function getMockVideoByDuration(maxDuration: number): MockVideo {
  const videos = Object.values(MOCK_VIDEOS)
    .filter(v => v.duration <= maxDuration)
    .sort((a, b) => b.duration - a.duration);

  return videos[0] || MOCK_VIDEOS.veryShort;
}

/**
 * Get timeout based on video duration
 * @param video - The mock video
 * @returns Suggested timeout in milliseconds
 */
export function getTimeoutForVideo(video: MockVideo): number {
  // Base timeout + video duration + buffer
  return 20000 + (video.duration * 1000) + 10000;
}

/**
 * Default video for most tests (short video for speed)
 */
export const DEFAULT_MOCK_VIDEO = MOCK_VIDEOS.veryShort;

/**
 * Helper to check if test video files exist
 * NOTE: This is meant to be used in global setup to verify fixtures
 */
export function getRequiredVideoFiles(): string[] {
  return Object.values(MOCK_VIDEOS).map(v => v.filename);
}

/**
 * Get video dimensions by key
 */
export function getVideoDimensions(videoKey: string): { width: number; height: number } {
  const video = MOCK_VIDEOS[videoKey];
  if (!video) {
    throw new Error(`Mock video not found: ${videoKey}`);
  }
  return {
    width: video.width,
    height: video.height
  };
}

/**
 * Test video metadata (mimics YouTube video structure)
 */
export interface TestVideoMetadata {
  url: string;
  title: string;
  duration: number;
  stable: boolean;
}

/**
 * Convert mock video to test video metadata format
 * (Compatible with existing test helpers that expect TestVideo interface)
 */
export function mockVideoToTestVideo(
  videoKey: string,
  serverBaseUrl: string
): TestVideoMetadata {
  const video = MOCK_VIDEOS[videoKey];
  if (!video) {
    throw new Error(`Mock video not found: ${videoKey}`);
  }

  return {
    url: getMockVideoUrl(videoKey, serverBaseUrl),
    title: video.title,
    duration: video.duration,
    stable: true // Mock videos are always stable
  };
}

/**
 * Get all available mock video keys
 */
export function getAvailableMockVideoKeys(): string[] {
  return Object.keys(MOCK_VIDEOS);
}

/**
 * Validation helper to ensure video file paths are correct
 */
export function getVideoFilePath(videoKey: string): string {
  const video = MOCK_VIDEOS[videoKey];
  if (!video) {
    throw new Error(`Mock video not found: ${videoKey}`);
  }
  return `/videos/${video.filename}`;
}
