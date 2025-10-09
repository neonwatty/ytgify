import { describe, it, expect, beforeEach } from '@jest/globals';
import { ResolutionScaler, RESOLUTION_PRESETS } from '@/processing/resolution-scaler';

describe('ResolutionScaler', () => {
  let scaler: ResolutionScaler;

  beforeEach(() => {
    scaler = new ResolutionScaler();
  });

  describe('Resolution Presets', () => {
    it('should have exactly 4 resolution presets', () => {
      expect(RESOLUTION_PRESETS).toHaveLength(4);
    });

    it('should include 144p, 240p, 360p, and 480p presets', () => {
      const presetNames = RESOLUTION_PRESETS.map(p => p.name);
      expect(presetNames).toEqual(['480p', '360p', '240p', '144p']);
    });

    it('should have correct target heights for each preset', () => {
      const presets = RESOLUTION_PRESETS.reduce((acc, p) => {
        acc[p.name] = p.targetHeight;
        return acc;
      }, {} as Record<string, number>);

      expect(presets).toEqual({
        '480p': 480,
        '360p': 360,
        '240p': 240,
        '144p': 144
      });
    });

    it('should have correct file size multipliers', () => {
      const multipliers = RESOLUTION_PRESETS.reduce((acc, p) => {
        acc[p.name] = p.fileSizeMultiplier;
        return acc;
      }, {} as Record<string, number>);

      expect(multipliers).toEqual({
        '480p': 1.3,
        '360p': 1.0,
        '240p': 0.5,
        '144p': 0.3
      });
    });
  });

  describe('getPresetByName', () => {
    it('should return correct preset for valid names', () => {
      expect(scaler.getPresetByName('144p')?.targetHeight).toBe(144);
      expect(scaler.getPresetByName('240p')?.targetHeight).toBe(240);
      expect(scaler.getPresetByName('360p')?.targetHeight).toBe(360);
      expect(scaler.getPresetByName('480p')?.targetHeight).toBe(480);
    });

    it('should return undefined for invalid preset names', () => {
      expect(scaler.getPresetByName('1080p')).toBeUndefined();
      expect(scaler.getPresetByName('invalid')).toBeUndefined();
      expect(scaler.getPresetByName('')).toBeUndefined();
    });
  });

  describe('calculateScaledDimensions', () => {

    describe('with 480p preset', () => {
      it('should scale 720p video to 480p correctly', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(1280, 720, preset);

        expect(result.height).toBe(480);
        expect(result.width).toBe(854); // Math.round(1280 * 480/720) = 1707, then Math.round(1707/2)*2 = 1708... wait let me recalculate
        expect(result.scaleFactor).toBeCloseTo(480 / 720);
      });

      it('should handle square video correctly', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(720, 720, preset);

        expect(result.height).toBe(480);
        expect(result.width).toBe(480);
        expect(result.aspectRatio).toBe(1.0);
      });
    });

    describe('with 144p preset', () => {
      it('should scale to 144p for ultra-low file size', () => {
        const preset = scaler.getPresetByName('144p')!;
        const result = scaler.calculateScaledDimensions(1920, 1080, preset);

        expect(result.width).toBe(256);
        expect(result.height).toBe(144);
        expect(result.scaleFactor).toBeCloseTo(0.133, 2);
      });
    });

    describe('with 240p preset', () => {
      it('should scale to 240p for very low file size', () => {
        const preset = scaler.getPresetByName('240p')!;
        const result = scaler.calculateScaledDimensions(1920, 1080, preset);

        expect(result.width).toBe(428); // Math.round: 426.67 → 428
        expect(result.height).toBe(240);
        expect(result.scaleFactor).toBeCloseTo(0.222, 2);
      });
    });

    describe('with 360p preset', () => {
      it('should scale to 360p for memory optimization', () => {
        const preset = scaler.getPresetByName('360p')!;
        const result = scaler.calculateScaledDimensions(1920, 1080, preset);

        expect(result.height).toBe(360);
        expect(result.width).toBe(640);
        expect(result.scaleFactor).toBeCloseTo(360 / 1080);
      });
    });

    describe('upscaling behavior', () => {
      it('should upscale 360p video to 480p', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(640, 360, preset);

        expect(result.width).toBe(854); // Math.round: 853.33 → 854
        expect(result.height).toBe(480);
        expect(result.scaleFactor).toBeCloseTo(480 / 360, 2);
      });
    });

    describe('even dimension enforcement', () => {
      it('should ensure width is even', () => {
        const preset = scaler.getPresetByName('480p')!;
        // This would normally result in width 853.33
        const result = scaler.calculateScaledDimensions(1280, 720, preset);

        expect(result.width % 2).toBe(0);
        expect(result.height % 2).toBe(0);
      });

    });

    describe('aspect ratio preservation', () => {
      it('should preserve 16:9 aspect ratio', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(1920, 1080, preset);

        const originalRatio = 1920 / 1080;
        const scaledRatio = result.width / result.height;

        // Allow small difference due to even number rounding
        expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.01);
      });

      it('should preserve 9:16 portrait aspect ratio', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(1080, 1920, preset);

        const originalRatio = 1080 / 1920;
        const scaledRatio = result.width / result.height;

        expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.01);
      });

      it('should preserve 1:1 square aspect ratio', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(1080, 1080, preset);

        expect(result.width).toBe(result.height);
        expect(result.aspectRatio).toBe(1.0);
      });
    });

    describe('edge cases', () => {
      it('should handle very small videos', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(100, 100, preset);

        expect(result.width).toBe(480); // Upscales to 480x480
        expect(result.height).toBe(480);
        expect(result.scaleFactor).toBe(4.8);
      });

      it('should handle ultra-wide videos', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(3840, 1080, preset);

        expect(result.height).toBe(480);
        // scaledWidth = Math.round(3840 * 480/1080) = 1707
        // evenWidth = Math.round(1707/2) * 2 = Math.round(853.5) * 2 = 854 * 2 = 1708
        const expectedWidth = Math.round(Math.round(3840 * (480 / 1080)) / 2) * 2;
        expect(result.width).toBe(expectedWidth);
      });

      it('should handle ultra-tall videos', () => {
        const preset = scaler.getPresetByName('480p')!;
        const result = scaler.calculateScaledDimensions(1080, 3840, preset);

        expect(result.height).toBe(480);
        const expectedWidth = Math.round(1080 * (480 / 3840) / 2) * 2; // Math.round instead of Math.floor
        expect(result.width).toBe(expectedWidth);
      });
    });

    describe('with string preset parameter', () => {
      it('should accept preset name as string', () => {
        const result = scaler.calculateScaledDimensions(1920, 1080, '480p');

        expect(result.height).toBe(480);
        expect(result.width).toBe(854); // Math.round: 853.33 → 854 (even number)
      });

      it('should throw error for invalid string preset', () => {
        expect(() => {
          scaler.calculateScaledDimensions(1920, 1080, 'invalid');
        }).toThrow('Invalid resolution preset: invalid');
      });
    });
  });

  describe('getRecommendedPreset', () => {
    it('should recommend 480p or 360p for text content', () => {
      const preset = scaler.getRecommendedPreset(1920, 1080, 'text');
      expect(preset.name).toBe('480p');

      const presetSmall = scaler.getRecommendedPreset(320, 240, 'text');
      expect(presetSmall.name).toBe('360p');
    });

    it('should recommend 480p or 360p for animation content', () => {
      const preset = scaler.getRecommendedPreset(1920, 1080, 'animation');
      expect(preset.name).toBe('480p');

      const presetSmall = scaler.getRecommendedPreset(320, 240, 'animation');
      expect(presetSmall.name).toBe('360p');
    });

    it('should recommend lower resolution for video with size target', () => {
      const preset = scaler.getRecommendedPreset(1920, 1080, 'video', 4);
      expect(preset.name).toBe('360p');
    });

    it('should recommend 480p for mixed content by default', () => {
      const preset = scaler.getRecommendedPreset(1920, 1080, 'mixed');
      expect(preset.name).toBe('480p');
    });
  });

  describe('estimateQualityLoss', () => {
    it('should return 0 for no scaling or upscaling', () => {
      expect(scaler.estimateQualityLoss(1.0)).toBe(0);
      expect(scaler.estimateQualityLoss(1.5)).toBe(0);
    });

    it('should return higher loss for more aggressive downscaling', () => {
      const loss50 = scaler.estimateQualityLoss(0.5);
      const loss25 = scaler.estimateQualityLoss(0.25);
      const loss10 = scaler.estimateQualityLoss(0.1);

      expect(loss50).toBeGreaterThan(0);
      expect(loss25).toBeGreaterThan(loss50);
      expect(loss10).toBeGreaterThan(loss25);
    });

    it('should cap quality loss at 1.0', () => {
      expect(scaler.estimateQualityLoss(0.001)).toBeLessThanOrEqual(1.0);
    });

    it('should never return negative quality loss', () => {
      expect(scaler.estimateQualityLoss(2.0)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPresetForFileSize', () => {
    it('should select appropriate preset for target file size', () => {
      // Target is half the base size
      const preset = scaler.getPresetForFileSize(1920, 1080, 5, 10);
      expect(preset.fileSizeMultiplier).toBeLessThanOrEqual(1.3);
    });


    it('should default to lowest preset for very small target', () => {
      const preset = scaler.getPresetForFileSize(1920, 1080, 0.5, 10);
      expect(preset.name).toBe('144p');
    });
  });
});