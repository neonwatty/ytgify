/**
 * Resolution scaling system for intelligent video frame resizing
 * Provides resolution presets and smart scaling algorithms that maintain
 * aspect ratio and preserve visual quality during downsampling.
 */

import { AspectRatioCalculator } from './aspect-ratio';

interface ResolutionPreset {
  name: string;
  targetHeight: number;
  label: string;
  description: string;
  qualityScore: number; // 0-1, higher is better quality
  fileSizeMultiplier: number; // relative to 360p baseline
}

interface ScaledDimensions {
  width: number;
  height: number;
  scaleFactor: number;
  originalWidth: number;
  originalHeight: number;
  aspectRatio: number;
}

interface ScalingOptions {
  preserveDetails: boolean;
  algorithm: 'bilinear' | 'bicubic' | 'lanczos';
  sharpening: number; // 0-1, post-scaling sharpening
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  {
    name: '480p',
    targetHeight: 480,
    label: '480p HD',
    description: 'Best quality',
    qualityScore: 0.6,
    fileSizeMultiplier: 1.3,
  },
  {
    name: '360p',
    targetHeight: 360,
    label: '360p Compact',
    description: 'Ideal for email',
    qualityScore: 0.4,
    fileSizeMultiplier: 1.0,
  },
  {
    name: '240p',
    targetHeight: 240,
    label: '240p Mini',
    description: 'Quick to share',
    qualityScore: 0.3,
    fileSizeMultiplier: 0.5,
  },
  {
    name: '144p',
    targetHeight: 144,
    label: '144p Nano',
    description: 'Perfect for chat',
    qualityScore: 0.2,
    fileSizeMultiplier: 0.3,
  },
];

export class ResolutionScaler {
  private aspectRatioCalculator: AspectRatioCalculator;

  constructor() {
    this.aspectRatioCalculator = new AspectRatioCalculator();
  }

  /**
   * Calculate scaled dimensions for a given resolution preset
   */
  calculateScaledDimensions(
    originalWidth: number,
    originalHeight: number,
    preset: ResolutionPreset | string
  ): ScaledDimensions {
    const resolutionPreset = typeof preset === 'string' ? this.getPresetByName(preset) : preset;

    if (!resolutionPreset) {
      throw new Error(`Invalid resolution preset: ${preset}`);
    }

    // Calculate dimensions maintaining aspect ratio (supports both upscaling and downscaling)
    const aspectRatio = originalWidth / originalHeight;
    const scaleFactor = resolutionPreset.targetHeight / originalHeight;
    const scaledWidth = Math.round(originalWidth * scaleFactor);
    const scaledHeight = resolutionPreset.targetHeight;

    // Ensure even dimensions for video encoding compatibility
    const evenWidth = this.makeEven(scaledWidth);
    const evenHeight = this.makeEven(scaledHeight);

    return {
      width: evenWidth,
      height: evenHeight,
      scaleFactor,
      originalWidth,
      originalHeight,
      aspectRatio,
    };
  }

  /**
   * Get resolution preset by name
   */
  getPresetByName(name: string): ResolutionPreset | undefined {
    return RESOLUTION_PRESETS.find((preset) => preset.name === name);
  }

  /**
   * Get best preset for target file size
   */
  getPresetForFileSize(
    originalWidth: number,
    originalHeight: number,
    targetFileSizeMB: number,
    baseFileSizeMB: number
  ): ResolutionPreset {
    const fileSizeRatio = targetFileSizeMB / baseFileSizeMB;

    // Find the preset with the closest file size multiplier
    let bestPreset = RESOLUTION_PRESETS[RESOLUTION_PRESETS.length - 1]; // Default to lowest
    let minDiff = Infinity;

    for (const preset of RESOLUTION_PRESETS) {
      const diff = Math.abs(preset.fileSizeMultiplier - fileSizeRatio);
      if (diff < minDiff) {
        minDiff = diff;
        bestPreset = preset;
      }
    }

    return bestPreset;
  }

  /**
   * Apply intelligent scaling to a canvas
   */
  scaleCanvas(
    sourceCanvas: HTMLCanvasElement | OffscreenCanvas,
    targetDimensions: ScaledDimensions,
    options: Partial<ScalingOptions> = {}
  ): HTMLCanvasElement | OffscreenCanvas {
    const scalingOptions: ScalingOptions = {
      preserveDetails: true,
      algorithm: 'bicubic',
      sharpening: 0.2,
      ...options,
    };

    // Create target canvas
    const isOffscreen = sourceCanvas instanceof OffscreenCanvas;
    const targetCanvas = isOffscreen
      ? new OffscreenCanvas(targetDimensions.width, targetDimensions.height)
      : document.createElement('canvas');

    if (!isOffscreen) {
      (targetCanvas as HTMLCanvasElement).width = targetDimensions.width;
      (targetCanvas as HTMLCanvasElement).height = targetDimensions.height;
    }

    const ctx = targetCanvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    if (!ctx) throw new Error('Failed to get canvas context');

    // Set quality rendering hints
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = this.getImageSmoothingQuality(scalingOptions.algorithm);

    // Perform scaling
    if (scalingOptions.preserveDetails && targetDimensions.scaleFactor < 0.5) {
      // For significant downscaling, use multi-step scaling to preserve details
      this.multiStepScale(sourceCanvas, targetCanvas, targetDimensions);
    } else {
      // Direct scaling for minor size changes
      ctx.drawImage(
        sourceCanvas,
        0,
        0,
        sourceCanvas.width,
        sourceCanvas.height,
        0,
        0,
        targetDimensions.width,
        targetDimensions.height
      );
    }

    // Apply sharpening if requested
    if (scalingOptions.sharpening > 0) {
      this.applySharpeningFilter(targetCanvas, scalingOptions.sharpening);
    }

    return targetCanvas;
  }

  /**
   * Multi-step scaling for better quality when significantly downscaling
   */
  private multiStepScale(
    source: HTMLCanvasElement | OffscreenCanvas,
    target: HTMLCanvasElement | OffscreenCanvas,
    dimensions: ScaledDimensions
  ): void {
    const steps = Math.ceil(Math.log2(1 / dimensions.scaleFactor));
    if (steps <= 1) {
      // Not enough downscaling to benefit from multi-step
      const ctx = target.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D;
      if (ctx) {
        ctx.drawImage(
          source,
          0,
          0,
          source.width,
          source.height,
          0,
          0,
          dimensions.width,
          dimensions.height
        );
      }
      return;
    }

    // Create intermediate canvases
    let currentCanvas = source;
    let currentWidth = source.width;
    let currentHeight = source.height;

    for (let i = 0; i < steps - 1; i++) {
      const nextWidth = Math.max(dimensions.width, Math.floor(currentWidth * 0.5));
      const nextHeight = Math.max(dimensions.height, Math.floor(currentHeight * 0.5));

      const intermediateCanvas =
        source instanceof OffscreenCanvas
          ? new OffscreenCanvas(nextWidth, nextHeight)
          : document.createElement('canvas');

      if (!(source instanceof OffscreenCanvas)) {
        (intermediateCanvas as HTMLCanvasElement).width = nextWidth;
        (intermediateCanvas as HTMLCanvasElement).height = nextHeight;
      }

      const ctx = intermediateCanvas.getContext('2d') as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D;
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          currentCanvas,
          0,
          0,
          currentWidth,
          currentHeight,
          0,
          0,
          nextWidth,
          nextHeight
        );
      }

      currentCanvas = intermediateCanvas;
      currentWidth = nextWidth;
      currentHeight = nextHeight;
    }

    // Final step to target dimensions
    const targetCtx = target.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    if (targetCtx) {
      targetCtx.imageSmoothingEnabled = true;
      targetCtx.imageSmoothingQuality = 'high';
      targetCtx.drawImage(
        currentCanvas,
        0,
        0,
        currentWidth,
        currentHeight,
        0,
        0,
        dimensions.width,
        dimensions.height
      );
    }
  }

  /**
   * Apply sharpening filter to combat softness from downscaling
   */
  private applySharpeningFilter(
    canvas: HTMLCanvasElement | OffscreenCanvas,
    strength: number
  ): void {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D;
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Create a copy for the original values
    const original = new Uint8ClampedArray(data);

    // Simple unsharp mask kernel
    const kernel = [0, -strength, 0, -strength, 1 + 4 * strength, -strength, 0, -strength, 0];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          // RGB channels only
          let sum = 0;

          // Apply kernel
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const kidx = ((y + ky) * width + (x + kx)) * 4;
              const kWeight = kernel[(ky + 1) * 3 + (kx + 1)];
              sum += original[kidx + c] * kWeight;
            }
          }

          data[idx + c] = Math.min(255, Math.max(0, Math.round(sum)));
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Get image smoothing quality based on algorithm
   */
  private getImageSmoothingQuality(algorithm: string): 'low' | 'medium' | 'high' {
    switch (algorithm) {
      case 'lanczos':
      case 'bicubic':
        return 'high';
      case 'bilinear':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Make a number even (required for video encoding)
   * Rounds to the nearest even number
   */
  private makeEven(n: number): number {
    return Math.round(n / 2) * 2;
  }

  /**
   * Estimate quality loss for a given scale factor
   */
  estimateQualityLoss(scaleFactor: number): number {
    if (scaleFactor >= 1) return 0; // No loss when upscaling or maintaining size

    // Logarithmic quality loss model
    // More aggressive quality loss as we scale down more
    const loss = 1 - Math.pow(scaleFactor, 0.7);
    return Math.min(1, Math.max(0, loss));
  }

  /**
   * Get recommended preset based on content analysis
   */
  getRecommendedPreset(
    originalWidth: number,
    originalHeight: number,
    contentType: 'text' | 'animation' | 'video' | 'mixed',
    targetFileSizeMB?: number
  ): ResolutionPreset {
    // For text content, maintain higher resolution
    if (contentType === 'text') {
      return originalHeight > 480 ? this.getPresetByName('480p')! : this.getPresetByName('360p')!;
    }

    // For animations, balance quality and size
    if (contentType === 'animation') {
      return originalHeight > 480 ? this.getPresetByName('480p')! : this.getPresetByName('360p')!;
    }

    // For video content, can use lower resolutions
    if (contentType === 'video') {
      if (targetFileSizeMB && targetFileSizeMB < 5) {
        return this.getPresetByName('360p')!;
      }
      return originalHeight > 480 ? this.getPresetByName('480p')! : this.getPresetByName('360p')!;
    }

    // Default mixed content handling
    return originalHeight > 480 ? this.getPresetByName('480p')! : this.getPresetByName('360p')!;
  }
}
