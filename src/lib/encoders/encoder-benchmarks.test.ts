/**
 * Performance benchmarking tests for different GIF encoders
 * Compares speed, memory usage, and output quality
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  encoderFactory, 
  selectEncoder, 
  getPerformanceRecommendations,
  EncoderType 
} from './encoder-factory';
import { encodeFrames } from './index';
import { FrameData, EncodingOptions } from './abstract-encoder';

// Test utilities
function createTestFrames(count: number, width: number, height: number): FrameData[] {
  const frames: FrameData[] = [];
  
  for (let i = 0; i < count; i++) {
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Create a simple animated pattern
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const time = i / count;
        
        // Create moving gradient pattern
        data[idx] = Math.floor(128 + 127 * Math.sin((x + i * 10) * 0.1));     // R
        data[idx + 1] = Math.floor(128 + 127 * Math.sin((y + i * 10) * 0.1)); // G
        data[idx + 2] = Math.floor(128 + 127 * Math.sin(i * 0.3));            // B
        data[idx + 3] = 255;                                                   // A
      }
    }
    
    frames.push({
      imageData: new ImageData(data, width, height),
      timestamp: i * 100,
      delay: 100
    });
  }
  
  return frames;
}

function createComplexTestFrames(count: number, width: number, height: number): FrameData[] {
  const frames: FrameData[] = [];
  
  for (let i = 0; i < count; i++) {
    const data = new Uint8ClampedArray(width * height * 4);
    
    // Create complex pattern with more colors and detail
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Complex pattern with multiple sine waves
        const r = Math.floor(128 + 127 * Math.sin((x * 0.05) + (i * 0.2)));
        const g = Math.floor(128 + 127 * Math.sin((y * 0.03) + (i * 0.15)));
        const b = Math.floor(128 + 127 * Math.sin(((x + y) * 0.02) + (i * 0.1)));
        
        // Add some noise for complexity
        const noise = Math.random() * 30 - 15;
        
        data[idx] = Math.max(0, Math.min(255, r + noise));     // R
        data[idx + 1] = Math.max(0, Math.min(255, g + noise)); // G
        data[idx + 2] = Math.max(0, Math.min(255, b + noise)); // B
        data[idx + 3] = 255;                                   // A
      }
    }
    
    frames.push({
      imageData: new ImageData(data, width, height),
      timestamp: i * 100,
      delay: 100
    });
  }
  
  return frames;
}

describe('Encoder Performance Benchmarks', () => {
  const testConfigurations = [
    { name: 'Small Simple', frames: 10, width: 320, height: 240, complex: false },
    { name: 'Medium Simple', frames: 25, width: 480, height: 360, complex: false },
    { name: 'Large Simple', frames: 50, width: 640, height: 480, complex: false },
    { name: 'Small Complex', frames: 10, width: 320, height: 240, complex: true },
    { name: 'Medium Complex', frames: 25, width: 480, height: 360, complex: true }
  ];

  const encodingOptions: EncodingOptions = {
    width: 320,
    height: 240,
    frameRate: 10,
    quality: 'medium',
    loop: true
  };

  beforeAll(async () => {
    // Clear any cached encoder instances
    encoderFactory.clearCache();
  });

  afterAll(() => {
    // Cleanup
    encoderFactory.clearCache();
  });

  test('should detect available encoders', async () => {
    const available = await encoderFactory.getAvailableEncoders();
    
    expect(available).toBeDefined();
    expect(available.length).toBeGreaterThan(0);
    
    console.log('Available encoders:', available.map(e => ({
      name: e.name,
      available: e.available,
      characteristics: e.characteristics
    })));
  });

  test('should provide performance recommendations', async () => {
    const recommendations = await getPerformanceRecommendations();
    
    expect(recommendations).toBeDefined();
    expect(recommendations.recommended).toBeDefined();
    expect(recommendations.reason).toBeDefined();
    
    console.log('Performance recommendations:', recommendations);
  });

  test('should benchmark encoder performance with different configurations', async () => {
    const results = [];
    const availableEncoders = ['gifenc', 'gif.js'] as EncoderType[];
    
    for (const config of testConfigurations) {
      console.log(`\nBenchmarking: ${config.name} (${config.frames} frames, ${config.width}x${config.height})`);
      
      const testFrames = config.complex 
        ? createComplexTestFrames(config.frames, config.width, config.height)
        : createTestFrames(config.frames, config.width, config.height);
      
      const testOptions: EncodingOptions = {
        ...encodingOptions,
        width: config.width,
        height: config.height
      };

      for (const encoderType of availableEncoders) {
        try {
          const encoder = await encoderFactory.getSpecificEncoder(encoderType);
          if (!encoder) {
            console.log(`  ${encoderType}: Not available`);
            continue;
          }

          const memoryBefore = ('memory' in performance) ? (performance as any).memory?.usedJSHeapSize || 0 : 0;
          const startTime = performance.now();
          
          const result = await encoder.encode(testFrames, testOptions);
          
          const encodingTime = performance.now() - startTime;
          const memoryAfter = ('memory' in performance) ? (performance as any).memory?.usedJSHeapSize || 0 : 0;
          const memoryUsed = memoryAfter - memoryBefore;
          const framesPerSecond = (config.frames / encodingTime) * 1000;
          const bytesPerFrame = result.blob.size / config.frames;

          const benchmarkResult = {
            configuration: config.name,
            encoder: encoderType,
            encodingTime: Math.round(encodingTime),
            framesPerSecond: Math.round(framesPerSecond * 10) / 10,
            memoryUsed: Math.round(memoryUsed / 1024), // KB
            outputSize: Math.round(result.blob.size / 1024), // KB
            bytesPerFrame: Math.round(bytesPerFrame),
            efficiency: result.performance.efficiency,
            recommendations: result.performance.recommendations
          };

          results.push(benchmarkResult);

          console.log(`  ${encoderType}:`, {
            time: `${benchmarkResult.encodingTime}ms`,
            fps: `${benchmarkResult.framesPerSecond} fps`,
            memory: `${benchmarkResult.memoryUsed}KB`,
            size: `${benchmarkResult.outputSize}KB`,
            efficiency: benchmarkResult.efficiency.toFixed(2)
          });

          // Basic performance assertions
          expect(encodingTime).toBeLessThan(30000); // Should complete within 30 seconds
          expect(result.blob.size).toBeGreaterThan(0);
          expect(result.metadata.frameCount).toBe(config.frames);
          expect(result.performance.efficiency).toBeGreaterThan(0);

        } catch (error) {
          console.log(`  ${encoderType}: Error - ${error}`);
        }
      }
    }

    // Analysis of results
    if (results.length > 0) {
      console.log('\n=== Benchmark Summary ===');
      
      const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.encoder]) acc[result.encoder] = [];
        acc[result.encoder].push(result);
        return acc;
      }, {} as Record<string, typeof results>);

      for (const [encoder, benchmarks] of Object.entries(groupedResults)) {
        const avgTime = benchmarks.reduce((sum, b) => sum + b.encodingTime, 0) / benchmarks.length;
        const avgFps = benchmarks.reduce((sum, b) => sum + b.framesPerSecond, 0) / benchmarks.length;
        const avgMemory = benchmarks.reduce((sum, b) => sum + b.memoryUsed, 0) / benchmarks.length;
        const avgEfficiency = benchmarks.reduce((sum, b) => sum + b.efficiency, 0) / benchmarks.length;

        console.log(`${encoder} Average Performance:`);
        console.log(`  Encoding Time: ${Math.round(avgTime)}ms`);
        console.log(`  Frames/Second: ${Math.round(avgFps * 10) / 10} fps`);
        console.log(`  Memory Usage: ${Math.round(avgMemory)}KB`);
        console.log(`  Efficiency: ${avgEfficiency.toFixed(3)}`);
      }
    }

    expect(results.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for benchmarks

  test('should compare encoder quality with identical input', async () => {
    const testFrames = createTestFrames(15, 400, 300);
    const testOptions: EncodingOptions = {
      width: 400,
      height: 300,
      frameRate: 10,
      quality: 'high',
      loop: true
    };

    const qualityComparison = [];
    const availableEncoders = ['gifenc', 'gif.js'] as EncoderType[];

    for (const encoderType of availableEncoders) {
      try {
        const encoder = await encoderFactory.getSpecificEncoder(encoderType);
        if (!encoder) continue;

        const result = await encoder.encode(testFrames, testOptions);
        
        qualityComparison.push({
          encoder: encoderType,
          fileSize: result.blob.size,
          efficiency: result.performance.efficiency,
          encodingTime: result.metadata.encodingTime,
          compressionRatio: (testOptions.width * testOptions.height * testFrames.length * 4) / result.blob.size
        });

      } catch (error) {
        console.log(`Quality test failed for ${encoderType}:`, error);
      }
    }

    if (qualityComparison.length > 1) {
      console.log('\n=== Quality Comparison ===');
      qualityComparison.forEach(comp => {
        console.log(`${comp.encoder}:`);
        console.log(`  File Size: ${Math.round(comp.fileSize / 1024)}KB`);
        console.log(`  Compression: ${comp.compressionRatio.toFixed(1)}:1`);
        console.log(`  Efficiency: ${comp.efficiency.toFixed(3)}`);
        console.log(`  Encoding Time: ${Math.round(comp.encodingTime)}ms`);
      });

      // Verify both encoders produce valid output
      qualityComparison.forEach(comp => {
        expect(comp.fileSize).toBeGreaterThan(1000); // At least 1KB
        expect(comp.compressionRatio).toBeGreaterThan(1); // Some compression achieved
        expect(comp.efficiency).toBeGreaterThan(0.1); // Reasonable efficiency
      });
    }

    expect(qualityComparison.length).toBeGreaterThan(0);
  }, 30000);

  test('should handle encoder selection preferences', async () => {
    const testFrames = createTestFrames(5, 200, 150);
    const options: EncodingOptions = {
      width: 200,
      height: 150,
      frameRate: 5,
      quality: 'medium',
      loop: false
    };

    // Test auto selection
    const autoSelection = await selectEncoder('gif', 'auto');
    expect(autoSelection.encoder).toBeDefined();
    expect(autoSelection.reason).toContain('Auto-selected');
    
    console.log('Auto-selected encoder:', {
      name: autoSelection.encoder.name,
      reason: autoSelection.reason,
      characteristics: autoSelection.characteristics
    });

    // Test the selected encoder works
    const result = await autoSelection.encoder.encode(testFrames, options);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.metadata.encoder).toBe(autoSelection.encoder.name);
  });

  test('should provide accurate performance metrics', async () => {
    const testFrames = createTestFrames(20, 300, 200);
    const options: EncodingOptions = {
      width: 300,
      height: 200,
      frameRate: 10,
      quality: 'medium',
      loop: true
    };

    const result = await encodeFrames(testFrames, options);
    
    // Verify metadata accuracy
    expect(result.metadata.frameCount).toBe(20);
    expect(result.metadata.width).toBe(300);
    expect(result.metadata.height).toBe(200);
    expect(result.metadata.encodingTime).toBeGreaterThan(0);
    expect(result.metadata.averageFrameTime).toBeGreaterThan(0);
    expect(result.metadata.encoder).toBeDefined();
    
    // Verify performance metrics
    expect(result.performance.success).toBe(true);
    expect(result.performance.efficiency).toBeGreaterThan(0);
    expect(result.performance.efficiency).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.performance.recommendations)).toBe(true);
    expect(result.performance.peakMemoryUsage).toBeGreaterThanOrEqual(0);
    
    console.log('Performance metrics:', {
      encodingTime: result.metadata.encodingTime + 'ms',
      averageFrameTime: result.metadata.averageFrameTime.toFixed(2) + 'ms',
      efficiency: result.performance.efficiency.toFixed(3),
      recommendations: result.performance.recommendations,
      encoder: result.metadata.encoder
    });
  });
});