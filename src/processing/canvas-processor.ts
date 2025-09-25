/**
 * Canvas Frame Processing Pipeline
 * Handles resizing, cropping, and visual adjustments for frame data
 * Optimized for performance with efficient pixel manipulation
 */

import { ExtractedFrame } from './frame-extractor';
import { ImageFilters } from './image-filters';

interface ProcessingConfig {
  // Resizing options
  targetWidth?: number;
  targetHeight?: number;
  maintainAspectRatio?: boolean;
  scalingMode?: 'fit' | 'fill' | 'stretch' | 'crop';

  // Cropping options
  cropArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Visual adjustments
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  saturation?: number; // -100 to 100

  // Quality options
  quality?: 'low' | 'medium' | 'high';
  enableFiltering?: boolean;
}

interface ProcessedFrame {
  imageData: ImageData;
  timestamp: number;
  frameIndex: number;
  originalDimensions: { width: number; height: number };
  processedDimensions: { width: number; height: number };
  processingTime: number;
}

interface ProcessingProgress {
  framesProcessed: number;
  totalFrames: number;
  currentFrameIndex: number;
  averageProcessingTime: number;
  elapsedTime: number;
}

interface ProcessingResult {
  frames: ProcessedFrame[];
  metadata: {
    totalFrames: number;
    averageProcessingTime: number;
    totalProcessingTime: number;
    originalDimensions: { width: number; height: number };
    finalDimensions: { width: number; height: number };
  };
}

export class CanvasProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private filters: ImageFilters;
  private isProcessing = false;
  private abortController: AbortController | null = null;

  constructor() {
    // Main canvas for output
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Failed to get 2D rendering context for main canvas');
    }
    this.ctx = context;

    // Offscreen canvas for intermediate processing
    this.offscreenCanvas = document.createElement('canvas');
    const offscreenContext = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    if (!offscreenContext) {
      throw new Error('Failed to get 2D rendering context for offscreen canvas');
    }
    this.offscreenCtx = offscreenContext;

    // Initialize image filters
    this.filters = new ImageFilters();

    // Optimize canvas contexts for performance
    this.optimizeCanvasContexts();
  }

  /**
   * Process a batch of extracted frames with the given configuration
   */
  async processFrames(
    frames: ExtractedFrame[],
    config: ProcessingConfig,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    if (this.isProcessing) {
      throw new Error('Frame processing already in progress');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();

    const startTime = performance.now();
    const processedFrames: ProcessedFrame[] = [];
    const processingTimes: number[] = [];

    try {
      // Determine final output dimensions
      const firstFrame = frames[0];
      if (!firstFrame) {
        throw new Error('No frames to process');
      }

      const outputDimensions = this.calculateOutputDimensions(
        firstFrame.imageData.width,
        firstFrame.imageData.height,
        config
      );

      // Set up canvases with target dimensions
      this.setupCanvases(outputDimensions.width, outputDimensions.height);

      // Process each frame
      for (let i = 0; i < frames.length; i++) {
        if (this.abortController?.signal.aborted) {
          throw new Error('Frame processing cancelled');
        }

        const frame = frames[i];
        const frameStartTime = performance.now();

        const processedFrame = await this.processSingleFrame(frame, config, outputDimensions);
        const processingTime = performance.now() - frameStartTime;

        processedFrames.push(processedFrame);
        processingTimes.push(processingTime);

        // Report progress
        if (onProgress) {
          const elapsedTime = performance.now() - startTime;
          const averageTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

          onProgress({
            framesProcessed: i + 1,
            totalFrames: frames.length,
            currentFrameIndex: i,
            averageProcessingTime: averageTime,
            elapsedTime,
          });
        }

        // Yield control to prevent blocking
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const totalTime = performance.now() - startTime;
      const averageTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;

      return {
        frames: processedFrames,
        metadata: {
          totalFrames: processedFrames.length,
          averageProcessingTime: averageTime,
          totalProcessingTime: totalTime,
          originalDimensions: {
            width: firstFrame.imageData.width,
            height: firstFrame.imageData.height,
          },
          finalDimensions: outputDimensions,
        },
      };
    } finally {
      this.cleanup();
    }
  }

  /**
   * Process a single frame with the given configuration
   */
  async processSingleFrame(
    frame: ExtractedFrame,
    config: ProcessingConfig,
    targetDimensions: { width: number; height: number }
  ): Promise<ProcessedFrame> {
    const startTime = performance.now();

    // Step 1: Load source image data onto offscreen canvas
    this.offscreenCanvas.width = frame.imageData.width;
    this.offscreenCanvas.height = frame.imageData.height;
    this.offscreenCtx.putImageData(frame.imageData, 0, 0);

    // Step 2: Apply cropping if specified
    let workingImageData: ImageData;
    if (config.cropArea) {
      workingImageData = this.applyCropping(frame.imageData, config.cropArea);
      this.offscreenCanvas.width = workingImageData.width;
      this.offscreenCanvas.height = workingImageData.height;
      this.offscreenCtx.putImageData(workingImageData, 0, 0);
    } else {
      workingImageData = frame.imageData;
    }

    // Step 3: Apply resizing
    this.canvas.width = targetDimensions.width;
    this.canvas.height = targetDimensions.height;

    await this.applyResizing(
      this.offscreenCanvas,
      workingImageData.width,
      workingImageData.height,
      targetDimensions,
      config
    );

    // Step 4: Apply visual filters
    let finalImageData = this.ctx.getImageData(
      0,
      0,
      targetDimensions.width,
      targetDimensions.height
    );

    if (config.enableFiltering !== false) {
      finalImageData = await this.applyVisualFilters(finalImageData, config);
    }

    const processingTime = performance.now() - startTime;

    return {
      imageData: finalImageData,
      timestamp: frame.timestamp,
      frameIndex: frame.frameIndex,
      originalDimensions: {
        width: frame.imageData.width,
        height: frame.imageData.height,
      },
      processedDimensions: targetDimensions,
      processingTime,
    };
  }

  /**
   * Cancel ongoing processing
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private applyCropping(imageData: ImageData, cropArea: ProcessingConfig['cropArea']): ImageData {
    if (!cropArea) return imageData;

    // Validate crop area
    const { x, y, width, height } = cropArea;
    const maxX = Math.min(x + width, imageData.width);
    const maxY = Math.min(y + height, imageData.height);
    const actualWidth = maxX - x;
    const actualHeight = maxY - y;

    if (actualWidth <= 0 || actualHeight <= 0) {
      throw new Error('Invalid crop area specified');
    }

    // Create new ImageData for cropped area
    const croppedData = new ImageData(actualWidth, actualHeight);
    const sourceData = imageData.data;
    const targetData = croppedData.data;

    // Copy pixels from source to target
    for (let row = 0; row < actualHeight; row++) {
      for (let col = 0; col < actualWidth; col++) {
        const sourceIndex = ((y + row) * imageData.width + (x + col)) * 4;
        const targetIndex = (row * actualWidth + col) * 4;

        targetData[targetIndex] = sourceData[sourceIndex]; // R
        targetData[targetIndex + 1] = sourceData[sourceIndex + 1]; // G
        targetData[targetIndex + 2] = sourceData[sourceIndex + 2]; // B
        targetData[targetIndex + 3] = sourceData[sourceIndex + 3]; // A
      }
    }

    return croppedData;
  }

  private async applyResizing(
    sourceCanvas: HTMLCanvasElement,
    sourceWidth: number,
    sourceHeight: number,
    targetDimensions: { width: number; height: number },
    config: ProcessingConfig
  ): Promise<void> {
    const { width: targetWidth, height: targetHeight } = targetDimensions;

    // Set image smoothing based on quality setting
    this.ctx.imageSmoothingEnabled = config.quality !== 'low';
    this.ctx.imageSmoothingQuality = config.quality === 'high' ? 'high' : 'medium';

    // Clear the target canvas
    this.ctx.clearRect(0, 0, targetWidth, targetHeight);

    // Calculate scaling and positioning based on scaling mode
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;

    let drawWidth: number;
    let drawHeight: number;
    let drawX = 0;
    let drawY = 0;

    switch (config.scalingMode || 'fit') {
      case 'fit': {
        // Maintain aspect ratio, fit within bounds
        const scale = Math.min(scaleX, scaleY);
        drawWidth = sourceWidth * scale;
        drawHeight = sourceHeight * scale;
        drawX = (targetWidth - drawWidth) / 2;
        drawY = (targetHeight - drawHeight) / 2;
        break;
      }

      case 'fill': {
        // Maintain aspect ratio, fill entire area
        const fillScale = Math.max(scaleX, scaleY);
        drawWidth = sourceWidth * fillScale;
        drawHeight = sourceHeight * fillScale;
        drawX = (targetWidth - drawWidth) / 2;
        drawY = (targetHeight - drawHeight) / 2;
        break;
      }

      case 'stretch':
        // Stretch to exact dimensions
        drawWidth = targetWidth;
        drawHeight = targetHeight;
        break;

      case 'crop': {
        // Scale to fill and crop excess
        const cropScale = Math.max(scaleX, scaleY);
        drawWidth = sourceWidth * cropScale;
        drawHeight = sourceHeight * cropScale;
        drawX = (targetWidth - drawWidth) / 2;
        drawY = (targetHeight - drawHeight) / 2;
        break;
      }

      default:
        drawWidth = targetWidth;
        drawHeight = targetHeight;
    }

    // Draw the resized image
    this.ctx.drawImage(
      sourceCanvas,
      0,
      0,
      sourceWidth,
      sourceHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight
    );
  }

  private async applyVisualFilters(
    imageData: ImageData,
    config: ProcessingConfig
  ): Promise<ImageData> {
    let processedData = imageData;

    // Apply brightness adjustment
    if (config.brightness !== undefined && config.brightness !== 0) {
      processedData = this.filters.adjustBrightness(processedData, config.brightness);
    }

    // Apply contrast adjustment
    if (config.contrast !== undefined && config.contrast !== 0) {
      processedData = this.filters.adjustContrast(processedData, config.contrast);
    }

    // Apply saturation adjustment
    if (config.saturation !== undefined && config.saturation !== 0) {
      processedData = this.filters.adjustSaturation(processedData, config.saturation);
    }

    return processedData;
  }

  private calculateOutputDimensions(
    sourceWidth: number,
    sourceHeight: number,
    config: ProcessingConfig
  ): { width: number; height: number } {
    let targetWidth = config.targetWidth || sourceWidth;
    let targetHeight = config.targetHeight || sourceHeight;

    // If only one dimension is specified and aspect ratio should be maintained
    if (config.maintainAspectRatio !== false) {
      const aspectRatio = sourceWidth / sourceHeight;

      if (config.targetWidth && !config.targetHeight) {
        targetHeight = Math.round(config.targetWidth / aspectRatio);
      } else if (config.targetHeight && !config.targetWidth) {
        targetWidth = Math.round(config.targetHeight * aspectRatio);
      }
    }

    // Ensure dimensions are even numbers (better for video encoding)
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

    // Ensure minimum dimensions
    targetWidth = Math.max(targetWidth, 2);
    targetHeight = Math.max(targetHeight, 2);

    return { width: targetWidth, height: targetHeight };
  }

  private setupCanvases(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private optimizeCanvasContexts(): void {
    // Optimize main context
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'medium';

    // Optimize offscreen context for performance
    this.offscreenCtx.imageSmoothingEnabled = false; // Disable for intermediate operations
  }

  private cleanup(): void {
    this.isProcessing = false;
    this.abortController = null;
  }

  /**
   * Get estimated memory usage for processing operation
   */
  static estimateMemoryUsage(
    frameCount: number,
    sourceWidth: number,
    sourceHeight: number,
    config: ProcessingConfig
  ): number {
    const processor = new CanvasProcessor();
    const outputDims = processor.calculateOutputDimensions(sourceWidth, sourceHeight, config);

    // Calculate memory for source frames (4 bytes per pixel for RGBA)
    const sourceMemory = frameCount * sourceWidth * sourceHeight * 4;

    // Calculate memory for output frames
    const outputMemory = frameCount * outputDims.width * outputDims.height * 4;

    // Add working memory for canvas operations (estimated 2x output for double buffering)
    const workingMemory = outputDims.width * outputDims.height * 4 * 2;

    return sourceMemory + outputMemory + workingMemory;
  }

  /**
   * Utility function to create processing config from GIF settings
   */
  static createConfigFromSettings(
    gifSettings: {
      resolution?: string;
      brightness?: number;
      contrast?: number;
      quality?: 'low' | 'medium' | 'high';
    },
    customConfig?: Partial<ProcessingConfig>
  ): ProcessingConfig {
    // Parse resolution if it's a string
    let targetWidth: number | undefined;
    let targetHeight: number | undefined;

    if (gifSettings.resolution && typeof gifSettings.resolution === 'string') {
      const parts = gifSettings.resolution.split('x');
      if (parts.length === 2) {
        targetWidth = parseInt(parts[0].trim());
        targetHeight = parseInt(parts[1].trim());
      }
    }

    return {
      targetWidth,
      targetHeight,
      maintainAspectRatio: true,
      scalingMode: 'fit',
      brightness: gifSettings.brightness || 0,
      contrast: gifSettings.contrast || 0,
      quality: gifSettings.quality || 'medium',
      enableFiltering: true,
      ...customConfig,
    };
  }
}

/**
 * Convenience function for processing extracted frames
 */
async function _processExtractedFrames(
  frames: ExtractedFrame[],
  config: ProcessingConfig,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessingResult> {
  const processor = new CanvasProcessor();
  return await processor.processFrames(frames, config, onProgress);
}
