/**
 * Aspect ratio calculation and management utilities
 * Provides tools for maintaining aspect ratios during scaling operations
 * and handling common aspect ratio formats (16:9, 4:3, etc.)
 */

interface AspectRatio {
  width: number;
  height: number;
  ratio: number;
  label: string;
  isCommon: boolean;
}

interface DimensionConstraints {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  multipleOf?: number; // Ensure dimensions are multiples of this value
}

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Common aspect ratios for video content
 */
const COMMON_ASPECT_RATIOS: AspectRatio[] = [
  { width: 16, height: 9, ratio: 16/9, label: '16:9 (Widescreen)', isCommon: true },
  { width: 4, height: 3, ratio: 4/3, label: '4:3 (Standard)', isCommon: true },
  { width: 21, height: 9, ratio: 21/9, label: '21:9 (Ultrawide)', isCommon: true },
  { width: 1, height: 1, ratio: 1, label: '1:1 (Square)', isCommon: true },
  { width: 9, height: 16, ratio: 9/16, label: '9:16 (Vertical)', isCommon: true },
  { width: 3, height: 2, ratio: 3/2, label: '3:2 (Classic)', isCommon: true }
];

export class AspectRatioCalculator {
  /**
   * Calculate aspect ratio from dimensions
   */
  calculateRatio(width: number, height: number): number {
    if (height === 0) return 0;
    return width / height;
  }

  /**
   * Get simplified aspect ratio (e.g., 1920x1080 -> 16:9)
   */
  getSimplifiedRatio(width: number, height: number): AspectRatio {
    const ratio = this.calculateRatio(width, height);
    
    // Check if it matches a common ratio (with tolerance)
    const tolerance = 0.02;
    for (const commonRatio of COMMON_ASPECT_RATIOS) {
      if (Math.abs(ratio - commonRatio.ratio) < tolerance) {
        return commonRatio;
      }
    }

    // Calculate GCD to simplify the ratio
    const gcd = this.calculateGCD(width, height);
    const simplifiedWidth = width / gcd;
    const simplifiedHeight = height / gcd;

    return {
      width: simplifiedWidth,
      height: simplifiedHeight,
      ratio,
      label: `${simplifiedWidth}:${simplifiedHeight}`,
      isCommon: false
    };
  }

  /**
   * Calculate dimensions maintaining aspect ratio within constraints
   */
  calculateConstrainedDimensions(
    originalWidth: number,
    originalHeight: number,
    constraints: DimensionConstraints
  ): { width: number; height: number } {
    const aspectRatio = this.calculateRatio(originalWidth, originalHeight);
    
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    // Apply width constraints
    if (constraints.maxWidth && targetWidth > constraints.maxWidth) {
      targetWidth = constraints.maxWidth;
      targetHeight = Math.round(targetWidth / aspectRatio);
    }
    if (constraints.minWidth && targetWidth < constraints.minWidth) {
      targetWidth = constraints.minWidth;
      targetHeight = Math.round(targetWidth / aspectRatio);
    }

    // Apply height constraints
    if (constraints.maxHeight && targetHeight > constraints.maxHeight) {
      targetHeight = constraints.maxHeight;
      targetWidth = Math.round(targetHeight * aspectRatio);
    }
    if (constraints.minHeight && targetHeight < constraints.minHeight) {
      targetHeight = constraints.minHeight;
      targetWidth = Math.round(targetHeight * aspectRatio);
    }

    // Ensure dimensions are multiples if required
    if (constraints.multipleOf) {
      targetWidth = this.roundToMultiple(targetWidth, constraints.multipleOf);
      targetHeight = this.roundToMultiple(targetHeight, constraints.multipleOf);
    }

    return { width: targetWidth, height: targetHeight };
  }

  /**
   * Calculate dimensions for fitting content within bounds (letterbox/pillarbox)
   */
  calculateFitDimensions(
    contentWidth: number,
    contentHeight: number,
    containerWidth: number,
    containerHeight: number,
    mode: 'contain' | 'cover' = 'contain'
  ): {
    width: number;
    height: number;
    x: number;
    y: number;
    scale: number;
  } {
    const contentRatio = this.calculateRatio(contentWidth, contentHeight);
    const containerRatio = this.calculateRatio(containerWidth, containerHeight);

    let scale: number;
    
    if (mode === 'contain') {
      // Fit entire content within container (may add letterbox/pillarbox)
      if (contentRatio > containerRatio) {
        // Content is wider - fit to width
        scale = containerWidth / contentWidth;
      } else {
        // Content is taller - fit to height
        scale = containerHeight / contentHeight;
      }
    } else {
      // Cover entire container (may crop content)
      if (contentRatio > containerRatio) {
        // Content is wider - fit to height
        scale = containerHeight / contentHeight;
      } else {
        // Content is taller - fit to width
        scale = containerWidth / contentWidth;
      }
    }

    const scaledWidth = Math.round(contentWidth * scale);
    const scaledHeight = Math.round(contentHeight * scale);

    // Center the content
    const x = Math.round((containerWidth - scaledWidth) / 2);
    const y = Math.round((containerHeight - scaledHeight) / 2);

    return {
      width: scaledWidth,
      height: scaledHeight,
      x,
      y,
      scale
    };
  }

  /**
   * Calculate optimal crop region to achieve target aspect ratio
   */
  calculateCropRegion(
    sourceWidth: number,
    sourceHeight: number,
    targetRatio: number,
    cropMode: 'center' | 'smart' = 'center'
  ): CropRegion {
    const sourceRatio = this.calculateRatio(sourceWidth, sourceHeight);

    let cropWidth: number;
    let cropHeight: number;

    if (sourceRatio > targetRatio) {
      // Source is wider - crop width
      cropHeight = sourceHeight;
      cropWidth = Math.round(cropHeight * targetRatio);
    } else {
      // Source is taller - crop height
      cropWidth = sourceWidth;
      cropHeight = Math.round(cropWidth / targetRatio);
    }

    // Ensure even dimensions for video encoding
    cropWidth = this.makeEven(cropWidth);
    cropHeight = this.makeEven(cropHeight);

    // Calculate crop position based on mode
    let x: number;
    let y: number;

    if (cropMode === 'center') {
      // Center crop
      x = Math.round((sourceWidth - cropWidth) / 2);
      y = Math.round((sourceHeight - cropHeight) / 2);
    } else {
      // Smart crop (placeholder for more intelligent cropping)
      // Could be enhanced with content detection algorithms
      x = Math.round((sourceWidth - cropWidth) / 2);
      y = Math.round((sourceHeight - cropHeight) * 0.33); // Slightly above center
    }

    return {
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: Math.min(cropWidth, sourceWidth),
      height: Math.min(cropHeight, sourceHeight)
    };
  }

  /**
   * Check if dimensions match a common aspect ratio
   */
  isCommonAspectRatio(width: number, height: number, tolerance: number = 0.02): boolean {
    const ratio = this.calculateRatio(width, height);
    
    return COMMON_ASPECT_RATIOS.some(commonRatio => 
      Math.abs(ratio - commonRatio.ratio) < tolerance
    );
  }

  /**
   * Get closest common aspect ratio
   */
  getClosestCommonRatio(width: number, height: number): AspectRatio {
    const ratio = this.calculateRatio(width, height);
    
    let closestRatio = COMMON_ASPECT_RATIOS[0];
    let minDifference = Math.abs(ratio - closestRatio.ratio);

    for (const commonRatio of COMMON_ASPECT_RATIOS) {
      const difference = Math.abs(ratio - commonRatio.ratio);
      if (difference < minDifference) {
        minDifference = difference;
        closestRatio = commonRatio;
      }
    }

    return closestRatio;
  }

  /**
   * Convert pixel dimensions to percentage-based dimensions
   */
  toPercentageDimensions(
    elementWidth: number,
    elementHeight: number,
    containerWidth: number,
    containerHeight: number
  ): { widthPercent: number; heightPercent: number } {
    return {
      widthPercent: (elementWidth / containerWidth) * 100,
      heightPercent: (elementHeight / containerHeight) * 100
    };
  }

  /**
   * Convert percentage-based dimensions to pixel dimensions
   */
  toPixelDimensions(
    widthPercent: number,
    heightPercent: number,
    containerWidth: number,
    containerHeight: number
  ): { width: number; height: number } {
    return {
      width: Math.round((widthPercent / 100) * containerWidth),
      height: Math.round((heightPercent / 100) * containerHeight)
    };
  }

  /**
   * Calculate Greatest Common Divisor (for ratio simplification)
   */
  private calculateGCD(a: number, b: number): number {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    
    return a || 1;
  }

  /**
   * Round to nearest multiple
   */
  private roundToMultiple(value: number, multiple: number): number {
    return Math.round(value / multiple) * multiple;
  }

  /**
   * Make a number even (required for video encoding)
   */
  private makeEven(n: number): number {
    return Math.floor(n / 2) * 2;
  }

  /**
   * Validate dimensions for video encoding compatibility
   */
  validateDimensions(width: number, height: number): {
    valid: boolean;
    issues: string[];
    suggestions: { width: number; height: number };
  } {
    const issues: string[] = [];
    
    // Check if dimensions are even
    if (width % 2 !== 0) {
      issues.push('Width must be even for video encoding');
    }
    if (height % 2 !== 0) {
      issues.push('Height must be even for video encoding');
    }

    // Check minimum dimensions
    if (width < 64) {
      issues.push('Width should be at least 64 pixels');
    }
    if (height < 64) {
      issues.push('Height should be at least 64 pixels');
    }

    // Check maximum dimensions for reasonable GIF size
    if (width > 1920) {
      issues.push('Width exceeds recommended maximum of 1920 pixels');
    }
    if (height > 1080) {
      issues.push('Height exceeds recommended maximum of 1080 pixels');
    }

    const suggestions = {
      width: this.makeEven(Math.max(64, Math.min(1920, width))),
      height: this.makeEven(Math.max(64, Math.min(1080, height)))
    };

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  }
}