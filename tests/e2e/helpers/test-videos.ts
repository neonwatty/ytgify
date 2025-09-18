/**
 * Curated list of YouTube videos for testing
 * These are stable, public videos that work well for extension testing
 */

export interface TestVideo {
  url: string;
  title: string;
  duration: number; // in seconds
  description: string;
  stable: boolean; // whether this video is unlikely to be removed
}

export const TEST_VIDEOS: Record<string, TestVideo> = {
  // Very short video - first YouTube video ever
  veryShort: {
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    title: 'Me at the zoo',
    duration: 19,
    description: 'First YouTube video - perfect for quick tests',
    stable: true,
  },

  // Classic test video
  rickRoll: {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Rick Astley - Never Gonna Give You Up',
    duration: 213,
    description: 'Classic Rick Roll - very stable, never going away',
    stable: true,
  },

  // Open source animation
  bigBuckBunny: {
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    title: 'Big Buck Bunny',
    duration: 596,
    description: 'Open source animated film - good for longer GIFs',
    stable: true,
  },

  // Google's test video
  chromeTest: {
    url: 'https://www.youtube.com/watch?v=LXb3EKWsInQ',
    title: 'COSTA RICA IN 4K',
    duration: 325,
    description: 'High quality test video often used for demos',
    stable: true,
  },

  // Very short tech video
  shortTech: {
    url: 'https://www.youtube.com/watch?v=gnyW8wnF2jk',
    title: 'YouTube Shorts Example',
    duration: 60,
    description: 'Short format video for testing quick captures',
    stable: false, // Shorts can be less stable
  },
};

/**
 * Get a test video by duration requirement
 */
export function getVideoByDuration(maxDuration: number): TestVideo {
  const videos = Object.values(TEST_VIDEOS).filter(v => v.duration <= maxDuration && v.stable);
  return videos[0] || TEST_VIDEOS.veryShort;
}

/**
 * Get only stable test videos
 */
export function getStableVideos(): TestVideo[] {
  return Object.values(TEST_VIDEOS).filter(v => v.stable);
}

/**
 * Default video for most tests
 */
export const DEFAULT_TEST_VIDEO = TEST_VIDEOS.veryShort;

/**
 * Timeout configurations based on video duration
 */
export function getTimeoutForVideo(video: TestVideo): number {
  // Base timeout + video duration + buffer
  return 30000 + (video.duration * 1000) + 10000;
}