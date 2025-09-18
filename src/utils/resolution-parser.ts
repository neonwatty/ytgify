/**
 * Utility for parsing resolution values from UI to dimensions
 */

interface ResolutionDimensions {
  width: number;
  height: number;
}

/**
 * Resolution presets mapping
 */
const RESOLUTION_PRESETS: Record<string, ResolutionDimensions> = {
  '144p': { width: 256, height: 144 },
  '240p': { width: 426, height: 240 },
  '360p': { width: 640, height: 360 },
  '480p': { width: 854, height: 480 },
  '1080p': { width: 1920, height: 1080 },
};

/**
 * Parse resolution string to dimensions
 * @param resolution - Resolution string like "480p", "1080p", "1280x720", or "original"
 * @param fallback - Fallback dimensions if parsing fails
 * @returns Resolution dimensions or null for "original"
 */
export function parseResolution(
  resolution: string,
  fallback: ResolutionDimensions = { width: 640, height: 480 }
): ResolutionDimensions | null {
  // Handle "original" special case
  if (resolution === 'original') {
    return null;
  }

  // Check if it's a preset (480p, 720p, 1080p)
  if (RESOLUTION_PRESETS[resolution]) {
    return RESOLUTION_PRESETS[resolution];
  }

  // Try to parse "WIDTHxHEIGHT" format for backward compatibility
  if (resolution.includes('x')) {
    const parts = resolution.split('x').map(n => parseInt(n.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { width: parts[0], height: parts[1] };
    }
  }

  // Try to parse "WIDTH×HEIGHT" format (with multiplication sign)
  if (resolution.includes('×')) {
    const parts = resolution.split('×').map(n => parseInt(n.trim(), 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { width: parts[0], height: parts[1] };
    }
  }

  // Return fallback if nothing matches
  return fallback;
}

/**
 * Get resolution dimensions with fallback handling
 * @param resolution - Resolution string
 * @param fallbackWidth - Fallback width
 * @param fallbackHeight - Fallback height
 * @returns [width, height] tuple
 */
export function getResolutionDimensions(
  resolution: string,
  fallbackWidth: number = 640,
  fallbackHeight: number = 480
): [number, number] {
  const dimensions = parseResolution(resolution, { width: fallbackWidth, height: fallbackHeight });

  // If null (original), return the fallback
  if (!dimensions) {
    return [fallbackWidth, fallbackHeight];
  }

  return [dimensions.width, dimensions.height];
}

/**
 * Check if resolution string indicates original quality
 * @param resolution - Resolution string to check
 * @returns true if resolution is "original"
 */
export function isOriginalResolution(resolution: string): boolean {
  return resolution === 'original';
}