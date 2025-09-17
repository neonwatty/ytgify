/**
 * Tests for aspect ratio calculation logic
 */

import {
  createMockVideoElement,
  assertAspectRatioPreserved,
  assertEvenDimensions,
  assertFitsWithinBounds,
  calculateExpectedDimensions,
  TEST_VIDEO_DIMENSIONS,
  DEFAULT_DIMENSION_TEST_CASES
} from '../../utils/aspect-ratio-helpers';

describe('Aspect Ratio Calculation Logic', () => {
  describe('calculateExpectedDimensions', () => {
    it('should fit landscape video within bounds', () => {
      const result = calculateExpectedDimensions(1920, 1080, 640, 360);
      expect(result.width).toBe(640);
      expect(result.height).toBe(360);
      assertAspectRatioPreserved(1920, 1080, result.width, result.height);
    });

    it('should fit portrait video within bounds', () => {
      const result = calculateExpectedDimensions(1080, 1920, 640, 360);
      // Portrait video should fit to height
      expect(result.height).toBe(360);
      expect(result.width).toBe(202); // Math.floor((360 * 1080/1920) / 2) * 2
      assertAspectRatioPreserved(1080, 1920, result.width, result.height);
    });

    it('should fit ultrawide video within bounds', () => {
      const result = calculateExpectedDimensions(2560, 1080, 640, 360);
      // Ultrawide should fit to width
      expect(result.width).toBe(640);
      expect(result.height).toBe(270); // Math.floor((640 * 1080/2560) / 2) * 2
      assertAspectRatioPreserved(2560, 1080, result.width, result.height);
    });

    it('should fit square video within bounds', () => {
      const result = calculateExpectedDimensions(1080, 1080, 640, 360);
      // Square video should fit to height
      expect(result.height).toBe(360);
      expect(result.width).toBe(360);
      assertAspectRatioPreserved(1080, 1080, result.width, result.height);
    });

    it('should handle 4:3 video', () => {
      const result = calculateExpectedDimensions(1024, 768, 640, 360);
      // 4:3 video in 16:9 bounds should fit to height
      expect(result.height).toBe(360);
      expect(result.width).toBe(480); // 360 * 4/3
      assertAspectRatioPreserved(1024, 768, result.width, result.height);
    });
  });

  describe('Aspect Ratio Assertions', () => {
    it('should validate aspect ratio preservation', () => {
      // Should pass - same ratio
      expect(() => {
        assertAspectRatioPreserved(1920, 1080, 640, 360);
      }).not.toThrow();

      // Should pass - within tolerance
      expect(() => {
        assertAspectRatioPreserved(1920, 1080, 640, 358); // ~1% difference
      }).not.toThrow();

      // Should fail - beyond tolerance
      expect(() => {
        assertAspectRatioPreserved(1920, 1080, 640, 480); // 33% difference
      }).toThrow();
    });

    it('should validate even dimensions', () => {
      // Should pass
      expect(() => {
        assertEvenDimensions(640, 360);
        assertEvenDimensions(1920, 1080);
        assertEvenDimensions(100, 100);
      }).not.toThrow();

      // Should fail
      expect(() => {
        assertEvenDimensions(641, 360);
      }).toThrow();

      expect(() => {
        assertEvenDimensions(640, 361);
      }).toThrow();
    });

    it('should validate bounds fitting', () => {
      // Should pass
      expect(() => {
        assertFitsWithinBounds(640, 360, 640, 360);
        assertFitsWithinBounds(320, 180, 640, 360);
      }).not.toThrow();

      // Should fail
      expect(() => {
        assertFitsWithinBounds(641, 360, 640, 360);
      }).toThrow();

      expect(() => {
        assertFitsWithinBounds(640, 361, 640, 360);
      }).toThrow();
    });
  });

  describe('Default Dimension Calculations', () => {
    it.each(DEFAULT_DIMENSION_TEST_CASES)(
      'should calculate correct dimensions for $description',
      ({ video, expected }) => {
        // Simulate the default calculation logic
        const videoAspectRatio = video.width / video.height;
        let width: number;
        let height: number;

        if (videoAspectRatio > 1) {
          width = 640;
          height = Math.round(640 / videoAspectRatio);
        } else {
          height = 640;
          width = Math.round(640 * videoAspectRatio);
        }

        // Ensure even dimensions
        width = Math.floor(width / 2) * 2;
        height = Math.floor(height / 2) * 2;

        expect(width).toBe(expected.width);
        expect(height).toBe(expected.height);
      }
    );
  });

  describe('Edge Cases', () => {
    it('should handle extreme aspect ratios', () => {
      // Very wide
      const wideResult = calculateExpectedDimensions(5000, 1000, 640, 360);
      assertAspectRatioPreserved(5000, 1000, wideResult.width, wideResult.height);
      assertFitsWithinBounds(wideResult.width, wideResult.height, 640, 360);
      assertEvenDimensions(wideResult.width, wideResult.height);

      // Very tall
      const tallResult = calculateExpectedDimensions(1000, 5000, 640, 360);
      assertAspectRatioPreserved(1000, 5000, tallResult.width, tallResult.height);
      assertFitsWithinBounds(tallResult.width, tallResult.height, 640, 360);
      assertEvenDimensions(tallResult.width, tallResult.height);
    });

    it('should handle tiny dimensions', () => {
      const result = calculateExpectedDimensions(10, 10, 640, 360);
      expect(result.width).toBe(result.height); // Should remain square
      assertFitsWithinBounds(result.width, result.height, 640, 360);
      assertEvenDimensions(result.width, result.height);
    });

    it('should handle odd source dimensions', () => {
      const result = calculateExpectedDimensions(1921, 1081, 640, 360);
      assertEvenDimensions(result.width, result.height);
      assertAspectRatioPreserved(1921, 1081, result.width, result.height, 0.02);
    });
  });

  describe('Real-world Scenarios', () => {
    it.each(TEST_VIDEO_DIMENSIONS)(
      'should handle $description correctly',
      ({ width, height, description }) => {
        const result = calculateExpectedDimensions(width, height, 640, 360);

        // All results should maintain aspect ratio
        assertAspectRatioPreserved(width, height, result.width, result.height);

        // All results should fit within bounds
        assertFitsWithinBounds(result.width, result.height, 640, 360);

        // All results should have even dimensions
        assertEvenDimensions(result.width, result.height);
      }
    );
  });
});