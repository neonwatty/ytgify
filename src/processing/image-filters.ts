/**
 * Image Filters for Canvas Frame Processing
 * Implements efficient pixel manipulation algorithms for brightness, contrast, saturation, and other effects
 * Optimized for performance with Uint8ClampedArray operations
 */

interface _FilterOptions {
  intensity?: number; // 0-100 for most filters
  preserveAlpha?: boolean;
}

interface _ColorMatrix {
  matrix: number[]; // 4x4 color transformation matrix
}

interface HSLAdjustment {
  hue?: number;        // -180 to 180
  saturation?: number; // -100 to 100  
  lightness?: number;  // -100 to 100
}

export class ImageFilters {
  /**
   * Adjust image brightness
   * @param imageData - Source ImageData object
   * @param brightness - Brightness adjustment (-100 to 100)
   */
  adjustBrightness(imageData: ImageData, brightness: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const adjustment = (brightness / 100) * 255;

    // Process RGB channels, skip alpha
    for (let i = 0; i < data.length; i += 4) {
      data[i] += adjustment;     // R
      data[i + 1] += adjustment; // G
      data[i + 2] += adjustment; // B
      // data[i + 3] remains unchanged (alpha)
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Adjust image contrast
   * @param imageData - Source ImageData object
   * @param contrast - Contrast adjustment (-100 to 100)
   */
  adjustContrast(imageData: ImageData, contrast: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    // Process RGB channels
    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128;         // R
      data[i + 1] = factor * (data[i + 1] - 128) + 128; // G
      data[i + 2] = factor * (data[i + 2] - 128) + 128; // B
      // Alpha channel remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Adjust image saturation
   * @param imageData - Source ImageData object
   * @param saturation - Saturation adjustment (-100 to 100)
   */
  adjustSaturation(imageData: ImageData, saturation: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const saturationMultiplier = (saturation + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Convert to grayscale using luminance formula
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Interpolate between grayscale and original color
      data[i] = gray + saturationMultiplier * (r - gray);         // R
      data[i + 1] = gray + saturationMultiplier * (g - gray);     // G
      data[i + 2] = gray + saturationMultiplier * (b - gray);     // B
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply HSL adjustments to image
   * @param imageData - Source ImageData object
   * @param adjustments - HSL adjustment values
   */
  adjustHSL(imageData: ImageData, adjustments: HSLAdjustment): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const { hue = 0, saturation = 0, lightness = 0 } = adjustments;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;

      // Convert RGB to HSL
      const [h, s, l] = this.rgbToHsl(r, g, b);

      // Apply adjustments
      const newHue = (h + hue / 360) % 1;
      const newSaturation = Math.max(0, Math.min(1, s + saturation / 100));
      const newLightness = Math.max(0, Math.min(1, l + lightness / 100));

      // Convert back to RGB
      const [newR, newG, newB] = this.hslToRgb(newHue, newSaturation, newLightness);

      data[i] = newR * 255;
      data[i + 1] = newG * 255;
      data[i + 2] = newB * 255;
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply gamma correction
   * @param imageData - Source ImageData object
   * @param gamma - Gamma value (0.1 to 3.0, default 1.0)
   */
  adjustGamma(imageData: ImageData, gamma: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const gammaCorrection = 1 / gamma;

    // Pre-calculate lookup table for performance
    const lookupTable = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      lookupTable[i] = Math.pow(i / 255, gammaCorrection) * 255;
    }

    // Apply gamma correction using lookup table
    for (let i = 0; i < data.length; i += 4) {
      data[i] = lookupTable[data[i]];         // R
      data[i + 1] = lookupTable[data[i + 1]]; // G
      data[i + 2] = lookupTable[data[i + 2]]; // B
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply sharpen filter
   * @param imageData - Source ImageData object
   * @param intensity - Sharpen intensity (0 to 100)
   */
  sharpen(imageData: ImageData, intensity: number = 50): ImageData {
    const amount = intensity / 100;
    const kernel = [
      0, -amount, 0,
      -amount, 1 + 4 * amount, -amount,
      0, -amount, 0
    ];

    return this.applyConvolutionFilter(imageData, kernel, 3);
  }

  /**
   * Apply blur filter
   * @param imageData - Source ImageData object
   * @param radius - Blur radius (1 to 10)
   */
  blur(imageData: ImageData, radius: number = 1): ImageData {
    // Simple box blur approximation
    const size = radius * 2 + 1;
    const kernelSize = size * size;
    const kernel = new Array(kernelSize).fill(1 / kernelSize);

    return this.applyConvolutionFilter(imageData, kernel, size);
  }

  /**
   * Apply edge detection filter
   * @param imageData - Source ImageData object
   */
  detectEdges(imageData: ImageData): ImageData {
    const kernel = [
      -1, -1, -1,
      -1, 8, -1,
      -1, -1, -1
    ];

    return this.applyConvolutionFilter(imageData, kernel, 3);
  }

  /**
   * Convert image to grayscale
   * @param imageData - Source ImageData object
   * @param method - Grayscale conversion method
   */
  toGrayscale(imageData: ImageData, method: 'luminance' | 'average' | 'lightness' = 'luminance'): ImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let gray: number;
      switch (method) {
        case 'luminance':
          gray = 0.299 * r + 0.587 * g + 0.114 * b;
          break;
        case 'average':
          gray = (r + g + b) / 3;
          break;
        case 'lightness':
          gray = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
          break;
        default:
          gray = 0.299 * r + 0.587 * g + 0.114 * b;
      }

      data[i] = gray;     // R
      data[i + 1] = gray; // G
      data[i + 2] = gray; // B
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply sepia tone effect
   * @param imageData - Source ImageData object
   * @param intensity - Sepia intensity (0 to 100)
   */
  sepia(imageData: ImageData, intensity: number = 100): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const factor = intensity / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const sepiaR = (r * 0.393 + g * 0.769 + b * 0.189) * factor + r * (1 - factor);
      const sepiaG = (r * 0.349 + g * 0.686 + b * 0.168) * factor + g * (1 - factor);
      const sepiaB = (r * 0.272 + g * 0.534 + b * 0.131) * factor + b * (1 - factor);

      data[i] = sepiaR;
      data[i + 1] = sepiaG;
      data[i + 2] = sepiaB;
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Invert image colors
   * @param imageData - Source ImageData object
   */
  invert(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];         // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply threshold filter (binary black/white)
   * @param imageData - Source ImageData object
   * @param threshold - Threshold value (0 to 255)
   */
  threshold(imageData: ImageData, threshold: number = 128): ImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const binary = gray >= threshold ? 255 : 0;

      data[i] = binary;     // R
      data[i + 1] = binary; // G
      data[i + 2] = binary; // B
      // Alpha remains unchanged
    }

    return new ImageData(data, imageData.width, imageData.height);
  }

  /**
   * Apply convolution filter with given kernel
   * @param imageData - Source ImageData object
   * @param kernel - Convolution kernel
   * @param kernelSize - Size of the kernel (assumes square kernel)
   */
  private applyConvolutionFilter(imageData: ImageData, kernel: number[], kernelSize: number): ImageData {
    const { width, height, data: sourceData } = imageData;
    const outputData = new Uint8ClampedArray(sourceData);
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = halfKernel; y < height - halfKernel; y++) {
      for (let x = halfKernel; x < width - halfKernel; x++) {
        const pixelIndex = (y * width + x) * 4;

        let r = 0, g = 0, b = 0;

        // Apply kernel
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const kernelValue = kernel[ky * kernelSize + kx];
            const pixelY = y + ky - halfKernel;
            const pixelX = x + kx - halfKernel;
            const sampleIndex = (pixelY * width + pixelX) * 4;

            r += sourceData[sampleIndex] * kernelValue;
            g += sourceData[sampleIndex + 1] * kernelValue;
            b += sourceData[sampleIndex + 2] * kernelValue;
          }
        }

        outputData[pixelIndex] = r;
        outputData[pixelIndex + 1] = g;
        outputData[pixelIndex + 2] = b;
        // Alpha remains unchanged
      }
    }

    return new ImageData(outputData, width, height);
  }

  /**
   * Convert RGB to HSL color space
   */
  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // Achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
        default:
          h = 0;
      }
      h /= 6;
    }

    return [h, s, l];
  }

  /**
   * Convert HSL to RGB color space
   */
  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l; // Achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [r, g, b];
  }

  /**
   * Utility method to chain multiple filters
   * @param imageData - Source ImageData object
   * @param filters - Array of filter functions to apply in sequence
   */
  chainFilters(imageData: ImageData, filters: Array<(data: ImageData) => ImageData>): ImageData {
    return filters.reduce((data, filter) => filter(data), imageData);
  }

  /**
   * Create a lookup table for fast color transformations
   * @param transformFunction - Function that maps input value (0-255) to output value
   */
  static createLookupTable(transformFunction: (value: number) => number): Uint8ClampedArray {
    const table = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      table[i] = Math.max(0, Math.min(255, transformFunction(i)));
    }
    return table;
  }

  /**
   * Apply lookup table transformation to image
   * @param imageData - Source ImageData object
   * @param lookupTable - Pre-computed lookup table
   * @param channels - Which channels to apply ('rgb' | 'r' | 'g' | 'b')
   */
  applyLookupTable(imageData: ImageData, lookupTable: Uint8ClampedArray, channels: string = 'rgb'): ImageData {
    const data = new Uint8ClampedArray(imageData.data);

    for (let i = 0; i < data.length; i += 4) {
      if (channels.includes('r')) data[i] = lookupTable[data[i]];
      if (channels.includes('g')) data[i + 1] = lookupTable[data[i + 1]];
      if (channels.includes('b')) data[i + 2] = lookupTable[data[i + 2]];
      // Alpha always preserved
    }

    return new ImageData(data, imageData.width, imageData.height);
  }
}

/**
 * Convenience functions for common filter operations
 */
const imageFilters = new ImageFilters();

function _adjustImageBrightness(imageData: ImageData, brightness: number): ImageData {
  return imageFilters.adjustBrightness(imageData, brightness);
}

function _adjustImageContrast(imageData: ImageData, contrast: number): ImageData {
  return imageFilters.adjustContrast(imageData, contrast);
}

function _adjustImageSaturation(imageData: ImageData, saturation: number): ImageData {
  return imageFilters.adjustSaturation(imageData, saturation);
}

function _convertToGrayscale(imageData: ImageData): ImageData {
  return imageFilters.toGrayscale(imageData);
}

/**
 * Batch apply multiple filters efficiently
 */
function _applyFilterChain(
  imageData: ImageData,
  filters: Array<{ type: string; value: number }>
): ImageData {
  let result = imageData;
  const filterInstance = new ImageFilters();

  for (const filter of filters) {
    switch (filter.type) {
      case 'brightness':
        result = filterInstance.adjustBrightness(result, filter.value);
        break;
      case 'contrast':
        result = filterInstance.adjustContrast(result, filter.value);
        break;
      case 'saturation':
        result = filterInstance.adjustSaturation(result, filter.value);
        break;
      case 'gamma':
        result = filterInstance.adjustGamma(result, filter.value);
        break;
      case 'sharpen':
        result = filterInstance.sharpen(result, filter.value);
        break;
      case 'blur':
        result = filterInstance.blur(result, filter.value);
        break;
      case 'sepia':
        result = filterInstance.sepia(result, filter.value);
        break;
      default:
        console.warn(`Unknown filter type: ${filter.type}`);
    }
  }

  return result;
}