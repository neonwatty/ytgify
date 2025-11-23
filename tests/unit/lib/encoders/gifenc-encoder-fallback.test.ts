/**
 * Unit tests for gifenc encoder fallback palette mechanism
 * Tests the fix for identical consecutive frames bug
 */

import { GifencEncoder } from '../../../../src/lib/encoders/gifenc-encoder';
import { FrameData } from '../../../../src/lib/encoders/abstract-encoder';

describe('GifencEncoder - Fallback Palette Mechanism', () => {
  let encoder: GifencEncoder;

  beforeEach(() => {
    encoder = new GifencEncoder();
  });

  afterEach(() => {
    if (encoder) {
      encoder.abort();
    }
  });

  describe('createFallbackPalette', () => {
    it('should create minimal 2-color palette from pixel data', () => {
      // Access private method via type casting
      const encoderAny = encoder as any;

      // Create test pixel data (red pixels)
      const pixels = new Uint8ClampedArray([
        255, 0, 0, 255,  // Red pixel
        255, 0, 0, 255,  // Red pixel
        255, 0, 0, 255,  // Red pixel
      ]);

      const palette = encoderAny.createFallbackPalette(pixels);

      expect(palette).toBeDefined();
      expect(palette.length).toBe(2);
      expect(palette[0]).toEqual([255, 0, 0]); // First pixel color (red)
      expect(palette[1]).toEqual([0, 0, 0]);   // Black
    });

    it('should handle empty pixel data gracefully', () => {
      const encoderAny = encoder as any;
      const pixels = new Uint8ClampedArray([]);

      const palette = encoderAny.createFallbackPalette(pixels);

      expect(palette).toBeDefined();
      expect(palette.length).toBe(2);
      expect(palette[0]).toEqual([0, 0, 0]); // Default to black
      expect(palette[1]).toEqual([0, 0, 0]);
    });
  });

  describe('applyFallbackPalette', () => {
    it('should map all pixels to index 0', () => {
      const encoderAny = encoder as any;

      // Create test pixel data (10 pixels = 40 bytes)
      const pixels = new Uint8ClampedArray(40);
      const palette = [[255, 0, 0], [0, 0, 0]];

      const indices = encoderAny.applyFallbackPalette(pixels, palette);

      expect(indices).toBeDefined();
      expect(indices.length).toBe(10); // 40 bytes / 4 = 10 pixels
      expect(Array.from(indices)).toEqual(new Array(10).fill(0));
    });

    it('should handle single pixel', () => {
      const encoderAny = encoder as any;

      const pixels = new Uint8ClampedArray([255, 128, 64, 255]);
      const palette = [[255, 128, 64], [0, 0, 0]];

      const indices = encoderAny.applyFallbackPalette(pixels, palette);

      expect(indices.length).toBe(1);
      expect(indices[0]).toBe(0);
    });
  });

  describe('Encoding with identical frames', () => {
    it('should successfully encode GIF with all identical frames', async () => {
      await encoder.initialize();

      // Create frames with completely identical pixel data
      const width = 10;
      const height = 10;
      const pixelData = new Uint8ClampedArray(width * height * 4);

      // Fill all frames with the same solid red color
      for (let i = 0; i < pixelData.length; i += 4) {
        pixelData[i] = 255;     // R
        pixelData[i + 1] = 0;   // G
        pixelData[i + 2] = 0;   // B
        pixelData[i + 3] = 255; // A
      }

      const frames: FrameData[] = [];
      for (let i = 0; i < 20; i++) {
        frames.push({
          imageData: {
            data: pixelData,
            width,
            height,
          } as ImageData,
          timestamp: i * 66.67, // 15 fps = ~66.67ms per frame
          delay: 100,
        });
      }

      // This should NOT throw, even with identical frames
      const result = await encoder.encode(frames, {
        width,
        height,
        frameRate: 15,
        quality: 'high',
        loop: true,
      });

      expect(result).toBeDefined();
      expect(result.blob).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.metadata.frameCount).toBe(20);
      expect(result.performance.success).toBe(true);
    }, 10000);

    it('should successfully encode GIF with alternating identical frames', async () => {
      await encoder.initialize();

      const width = 10;
      const height = 10;

      // Create alternating patterns
      const redPixels = new Uint8ClampedArray(width * height * 4);
      const bluePixels = new Uint8ClampedArray(width * height * 4);

      for (let i = 0; i < redPixels.length; i += 4) {
        redPixels[i] = 255;     // Red
        redPixels[i + 3] = 255;

        bluePixels[i + 2] = 255; // Blue
        bluePixels[i + 3] = 255;
      }

      const frames: FrameData[] = [];
      // Add 15 consecutive red frames (should trigger fallback if quantize fails)
      for (let i = 0; i < 15; i++) {
        frames.push({
          imageData: { data: redPixels, width, height } as ImageData,
          timestamp: i * 66.67,
          delay: 66,
        });
      }
      // Add a blue frame
      frames.push({
        imageData: { data: bluePixels, width, height } as ImageData,
        timestamp: 15 * 66.67,
        delay: 66,
      });

      const result = await encoder.encode(frames, {
        width,
        height,
        frameRate: 15,
        quality: 'high',
        loop: true,
      });

      expect(result).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.metadata.frameCount).toBe(16);
    }, 10000);
  });

  describe('Encoding with low color variance', () => {
    it('should handle monochrome frames', async () => {
      await encoder.initialize();

      const width = 10;
      const height = 10;
      const grayPixels = new Uint8ClampedArray(width * height * 4);

      // All pixels are the same gray
      for (let i = 0; i < grayPixels.length; i += 4) {
        grayPixels[i] = 128;     // R
        grayPixels[i + 1] = 128; // G
        grayPixels[i + 2] = 128; // B
        grayPixels[i + 3] = 255; // A
      }

      const frames: FrameData[] = [];
      for (let i = 0; i < 10; i++) {
        frames.push({
          imageData: { data: grayPixels, width, height } as ImageData,
          timestamp: i * 100,
          delay: 100,
        });
      }

      const result = await encoder.encode(frames, {
        width,
        height,
        frameRate: 10,
        quality: 'high',
        loop: true,
      });

      expect(result).toBeDefined();
      expect(result.blob.size).toBeGreaterThan(0);
      expect(result.metadata.frameCount).toBe(10);
    }, 10000);
  });
});
