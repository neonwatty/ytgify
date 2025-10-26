/**
 * Network throttling profiles for E2E testing
 *
 * These profiles simulate different network conditions using Chrome DevTools Protocol (CDP).
 * Apply BEFORE navigating to the page for throttling to affect video downloads.
 *
 * Usage:
 * ```typescript
 * const client = await page.context().newCDPSession(page);
 * await client.send('Network.enable');
 * await client.send('Network.emulateNetworkConditions', NETWORK_PROFILES.slow3G);
 * await page.goto(url); // Throttling now active
 * ```
 */

export interface NetworkProfile {
  offline: boolean;
  latency: number; // milliseconds
  downloadThroughput: number; // bytes per second (-1 = unlimited)
  uploadThroughput: number; // bytes per second (-1 = unlimited)
}

export const NETWORK_PROFILES: Record<string, NetworkProfile> = {
  /**
   * Slow 3G
   * Typical speeds: 400 kbps down/up, 1500ms latency
   * Use for: Testing slow buffering scenarios
   */
  slow3G: {
    offline: false,
    latency: 1500,
    downloadThroughput: (400 * 1024) / 8, // 400 kbps = 50 KB/s
    uploadThroughput: (400 * 1024) / 8,
  },

  /**
   * Fast 3G
   * Typical speeds: 1.6 Mbps down, 750 kbps up, 200ms latency
   * Use for: Testing moderate buffering scenarios
   */
  fast3G: {
    offline: false,
    latency: 200,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps = 200 KB/s
    uploadThroughput: (750 * 1024) / 8, // 750 kbps = 93.75 KB/s
  },

  /**
   * Slow 4G / LTE
   * Typical speeds: 4 Mbps down, 3 Mbps up, 150ms latency
   * Use for: Testing baseline mobile scenarios
   */
  slow4G: {
    offline: false,
    latency: 150,
    downloadThroughput: (4 * 1024 * 1024) / 8, // 4 Mbps = 512 KB/s
    uploadThroughput: (3 * 1024 * 1024) / 8, // 3 Mbps = 384 KB/s
  },

  /**
   * Fast 4G / LTE
   * Typical speeds: 10 Mbps down, 5 Mbps up, 50ms latency
   * Use for: Testing good mobile scenarios
   */
  fast4G: {
    offline: false,
    latency: 50,
    downloadThroughput: (10 * 1024 * 1024) / 8, // 10 Mbps = 1.25 MB/s
    uploadThroughput: (5 * 1024 * 1024) / 8, // 5 Mbps = 640 KB/s
  },

  /**
   * Very Slow (Custom)
   * Extreme throttling: 50 kbps, 2000ms latency
   * Use for: Testing timeout scenarios and very poor connections
   */
  verySlow: {
    offline: false,
    latency: 2000,
    downloadThroughput: (50 * 1024) / 8, // 50 kbps = 6.25 KB/s
    uploadThroughput: (50 * 1024) / 8,
  },

  /**
   * No Throttling (Default)
   * Unlimited bandwidth, no latency
   * Use for: Baseline tests, regression testing
   */
  noThrottle: {
    offline: false,
    latency: 0,
    downloadThroughput: -1, // Unlimited
    uploadThroughput: -1, // Unlimited
  },

  /**
   * Offline
   * No network connectivity
   * Use for: Testing offline error handling
   */
  offline: {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  },
};

/**
 * Helper to apply network profile to a Playwright page
 * @param page - Playwright page instance
 * @param profile - Network profile to apply
 */
export async function applyNetworkProfile(
  page: any,
  profile: NetworkProfile
): Promise<() => Promise<void>> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', profile);

  // Return cleanup function to restore normal network
  return async () => {
    await client.send('Network.emulateNetworkConditions', NETWORK_PROFILES.noThrottle);
    await client.detach();
  };
}

/**
 * Get profile name from profile object (for logging)
 */
export function getProfileName(profile: NetworkProfile): string {
  const entry = Object.entries(NETWORK_PROFILES).find(([_, p]) => p === profile);
  return entry ? entry[0] : 'custom';
}

/**
 * Format throughput for display
 */
export function formatThroughput(bytesPerSecond: number): string {
  if (bytesPerSecond === -1) return 'Unlimited';
  if (bytesPerSecond === 0) return '0';

  const kbps = (bytesPerSecond * 8) / 1024;
  if (kbps < 1024) return `${kbps.toFixed(0)} kbps`;

  const mbps = kbps / 1024;
  return `${mbps.toFixed(1)} Mbps`;
}

/**
 * Log network profile details
 */
export function logNetworkProfile(profile: NetworkProfile): void {
  const name = getProfileName(profile);
  console.log(`[Network Profile] ${name}:`, {
    latency: `${profile.latency}ms`,
    download: formatThroughput(profile.downloadThroughput),
    upload: formatThroughput(profile.uploadThroughput),
    offline: profile.offline,
  });
}
