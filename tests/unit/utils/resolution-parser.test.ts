import {
  parseResolution,
  getResolutionDimensions,
  isOriginalResolution
} from '@/utils/resolution-parser';

describe('resolution-parser', () => {
  describe('parseResolution', () => {
    it('should parse 144p preset correctly', () => {
      const result = parseResolution('144p');
      expect(result).toEqual({ width: 256, height: 144 });
    });

    it('should parse 240p preset correctly', () => {
      const result = parseResolution('240p');
      expect(result).toEqual({ width: 426, height: 240 });
    });

    it('should parse 360p preset correctly', () => {
      const result = parseResolution('360p');
      expect(result).toEqual({ width: 640, height: 360 });
    });

    it('should parse 480p preset correctly', () => {
      const result = parseResolution('480p');
      expect(result).toEqual({ width: 854, height: 480 });
    });


    it('should parse 1080p preset correctly', () => {
      const result = parseResolution('1080p');
      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it('should return null for original resolution', () => {
      const result = parseResolution('original');
      expect(result).toBeNull();
    });

    it('should parse WIDTHxHEIGHT format', () => {
      const result = parseResolution('1920x1080');
      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it('should parse WIDTH×HEIGHT format with multiplication sign', () => {
      const result = parseResolution('1920×1080');
      expect(result).toEqual({ width: 1920, height: 1080 });
    });

    it('should return fallback for invalid format', () => {
      const result = parseResolution('invalid');
      expect(result).toEqual({ width: 640, height: 480 });
    });

    it('should use custom fallback when provided', () => {
      const result = parseResolution('invalid', { width: 800, height: 600 });
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it('should handle spaces in WIDTHxHEIGHT format', () => {
      const result = parseResolution(' 1920 x 1080 ');
      expect(result).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('getResolutionDimensions', () => {
    it('should return dimensions for 144p', () => {
      const [width, height] = getResolutionDimensions('144p');
      expect(width).toBe(256);
      expect(height).toBe(144);
    });

    it('should return dimensions for 240p', () => {
      const [width, height] = getResolutionDimensions('240p');
      expect(width).toBe(426);
      expect(height).toBe(240);
    });

    it('should return dimensions for 360p', () => {
      const [width, height] = getResolutionDimensions('360p');
      expect(width).toBe(640);
      expect(height).toBe(360);
    });

    it('should return dimensions for 480p', () => {
      const [width, height] = getResolutionDimensions('480p');
      expect(width).toBe(854);
      expect(height).toBe(480);
    });

    it('should return dimensions for 720p', () => {
      const [width, height] = getResolutionDimensions('1080p');
      expect(width).toBe(1920);
      expect(height).toBe(1080);
    });

    it('should return fallback for original resolution', () => {
      const [width, height] = getResolutionDimensions('original', 1920, 1080);
      expect(width).toBe(1920);
      expect(height).toBe(1080);
    });

    it('should parse custom format', () => {
      const [width, height] = getResolutionDimensions('640x360');
      expect(width).toBe(640);
      expect(height).toBe(360);
    });

    it('should return default fallback for invalid format', () => {
      const [width, height] = getResolutionDimensions('invalid');
      expect(width).toBe(640);
      expect(height).toBe(480);
    });

    it('should return custom fallback for invalid format', () => {
      const [width, height] = getResolutionDimensions('invalid', 800, 600);
      expect(width).toBe(800);
      expect(height).toBe(600);
    });
  });

  describe('isOriginalResolution', () => {
    it('should return true for "original"', () => {
      expect(isOriginalResolution('original')).toBe(true);
    });

    it('should return false for "1080p"', () => {
      expect(isOriginalResolution('1080p')).toBe(false);
    });

    it('should return false for custom format', () => {
      expect(isOriginalResolution('1920x1080')).toBe(false);
    });

    it('should return false for invalid format', () => {
      expect(isOriginalResolution('invalid')).toBe(false);
    });
  });
});