/**
 * Processing module exports
 * Central export point for all processing-related functionality
 */

// Frame extraction
export { FrameExtractor } from './frame-extractor';
export type { ExtractedFrame, FrameExtractionConfig, FrameExtractionProgress } from './frame-extractor';

// Video decoding
export { AdvancedVideoDecoder } from './video-decoder';
export type { VideoDecoderOptions, DecodedVideoFrame } from './video-decoder';

// GIF encoding
export { GifEncoder } from './gif-encoder';
export type { 
  GifEncodingConfig,
  GifEncodingProgress,
  GifEncodingResult
} from './gif-encoder';

// Encoding options and optimization
export { 
  EncodingOptimizer,
  EncodingProfiler,
  ENCODING_PRESETS 
} from './encoding-options';
export type {
  GifEncodingOptions,
  GifFrameOptions,
  EncodingPreset,
  GifQualityPreset,
  ContentAnalysis
} from './encoding-options';

// Quality management (new)
export { 
  QualityManager,
  FRAME_RATE_PROFILES,
  QUALITY_PROFILES
} from './quality-manager';
export type {
  QualityControlSettings,
  QualityRecommendation,
  FrameRateProfile,
  QualityProfile
} from './quality-manager';

// File size estimation (new)
export { FileSizeEstimator } from './file-size-estimator';
export type {
  FileSizeEstimate,
  SizeOptimizationSuggestion,
  RealTimeEstimation
} from './file-size-estimator';

// Canvas processing
export { CanvasProcessor } from './canvas-processor';
export type { ProcessingConfig, ProcessedFrame } from './canvas-processor';

// Image filters
export { ImageFilters } from './image-filters';
export type { FilterOptions } from './image-filters';

// Resolution scaling (new)
export { ResolutionScaler, RESOLUTION_PRESETS } from './resolution-scaler';
export type {
  ResolutionPreset,
  ScaledDimensions,
  ScalingOptions
} from './resolution-scaler';

// Aspect ratio utilities (new)
export { AspectRatioCalculator, COMMON_ASPECT_RATIOS } from './aspect-ratio';
export type {
  AspectRatio,
  DimensionConstraints,
  CropRegion
} from './aspect-ratio';

// Progress tracking (new)
export { 
  ProgressTracker,
  globalProgressTracker
} from './progress-tracker';
export type {
  ProgressEvent,
  ProgressData,
  ProgressDetails,
  SubProgress,
  MemoryMetrics,
  ProgressSubscriber,
  CancellationToken,
  TrackerInstance,
  ProgressTrackerOptions
} from './progress-tracker';

// Task management (new)
export {
  TaskManager,
  globalTaskManager
} from './task-manager';
export type {
  ProcessingTask,
  TaskConfig,
  FrameExtractionTaskConfig,
  GifEncodingTaskConfig,
  CompositeTaskConfig,
  TaskResult,
  CompositeTaskResult,
  TaskManagerOptions,
  TaskEventListener,
  TaskEvent
} from './task-manager';

// Batch processing (new)
export {
  BatchProcessor
} from './batch-processor';
export type {
  BatchJobConfig,
  BatchSegment,
  BatchJobResult,
  BatchSegmentResult,
  BatchProcessorOptions,
  BatchProgress,
  BatchJob
} from './batch-processor';

// Queue management (new)
export {
  QueueManager
} from './queue-manager';
export type {
  QueuedJob,
  ResourceRequirements,
  QueueManagerOptions,
  QueueStatistics,
  SchedulingDecision
} from './queue-manager';

// Format encoders (new)
export {
  formatRegistry,
  exportToFormat,
  estimateExportSizes,
  recommendFormat,
  FORMAT_QUALITY_PRESETS
} from './format-encoders';
export type {
  ExportFormat,
  ExportOptions,
  ExportProgress,
  ExportResult,
  FormatEncoder
} from './format-encoders';

// WebP encoder (new)
export {
  WebPEncoder,
  encodeToWebP
} from './webp-encoder';
export type {
  WebPEncodingOptions,
  WebPFrame,
  WebPEncodingProgress,
  WebPEncodingResult
} from './webp-encoder';

// MP4 encoder (placeholder - future enhancement)
export {
  MP4Encoder,
  encodeToMP4,
  checkMP4Support
} from './mp4-encoder';
export type {
  MP4EncodingOptions,
  MP4EncodingProgress,
  MP4EncodingResult
} from './mp4-encoder';