# Buffering Safeguards: Comprehensive Plan

**Created:** 2025-11-10
**Status:** Proposed
**Priority:** High (addresses production buffering timeouts)

## Problem Statement

Frame capture fails with "Video buffering too slow" error when:
- Video not fully buffered in target time range
- Network connection slow during capture
- Video decoder taking longer than expected
- YouTube throttling download speed

**Recent Fix Applied:**
- Increased post-seek delays (150-200ms + 200ms buffering penalty)
- Increased duplicate tolerance (10-40 frames instead of 5-30)
- Improved recovery logic (attempts recovery after 2+ duplicates)

**However:** Static timeouts still vulnerable to network variability.

---

## Current State Analysis

### 1. Pre-flight Validation (Limited)
**Location:** `src/content/youtube-detector.ts:484-492`

**Current:** Basic `isVideoReady()` check
- `readyState >= HAVE_METADATA`
- Has source
- Valid duration

**Gap:** No pre-capture buffering validation at target time range. Wizard starts immediately without verifying sufficient buffering.

### 2. Buffering Checks During Capture (Partial)
**Location:** `src/content/gif-processor.ts:431-501`

**Current:**
- `readyState` check (≥2 for HAVE_CURRENT_DATA)
- `buffered` TimeRanges verification
- Stuck detection (readyState unchanged + time unchanged)
- Max timeout: 2000ms per frame (80 attempts × 25ms)

**Location:** `src/lib/simple-frame-extractor.ts:30-130`

**Current (more advanced):**
- Enhanced `waitForVideoReady()` function
- Detects `readyState` stuck at 0/1 for 1 second
- Detects buffer stall (buffer end not progressing)
- Adaptive delays: 100ms/50ms/25ms based on `readyState`
- Network speed estimation: tracks wait times, classifies as fast/medium/slow
- Total wait budget: 120 seconds across all frames

### 3. Adaptive Timeouts (Basic)
**Location:** `src/lib/simple-frame-extractor.ts:209-248`

**Current:**
- Network speed estimate from average wait times:
  - Fast: <300ms average
  - Medium: 300-1000ms average
  - Slow: >1000ms average
- Additional delays: 200ms for slow, 100ms for medium
- Total wait budget prevents infinite hangs

**Gap:** `gif-processor.ts` uses static delays, doesn't dynamically adjust based on observed performance.

### 4. User Controls (None)
**Location:** `src/types/storage.ts:24-31`

**Current:** `UserPreferences` interface exists with:
- `defaultQuality`
- `defaultFrameRate`

**Gap:** No buffering-related settings, timeout controls, or connection quality preferences.

### 5. User Feedback (Silent)
**Location:** `src/content/overlay-wizard/screens/ProcessingScreen.tsx`

**Current:** Shows generic stages
- Capturing/Analyzing/Encoding/Finalizing
- "Reading video data..." message
- No real-time buffering status
- No network issue indication until failure

**Gap:** Users don't know video is buffering vs. processing vs. stuck until timeout error.

### 6. Retry Strategies (Single Recovery)
**Location:** `src/content/gif-processor.ts:566-600`

**Current:**
- Single recovery attempt on duplicate frames (after 2+ consecutive)
- Time nudge strategy: +0.001s or +0.01s offset
- 300ms wait for decode
- Success resets counter; failure accumulates to abort

**Gap:** No exponential backoff, no multiple retry strategies, no fallback to lower settings.

### 7. Graceful Degradation (None)

**Current:** Aborts with error message suggesting manual interventions
- Wait for buffering
- Shorter duration
- Reduce frame rate
- Check network

**Gap:** No automatic frame rate reduction, resolution scaling, or frame skipping.

### 8. Monitoring/Telemetry (Infrastructure Exists)
**Location:** `src/monitoring/metrics-collector.ts` and `performance-tracker.ts`

**Current:** Comprehensive metrics system exists
- Tracks frame extraction duration
- Success/failure rates
- Memory usage
- CPU estimates
- Privacy-compliant analytics

**Gap:** Not tracking buffering-specific failures:
- Timeout frequency by video/network
- Optimal timeout values per connection type
- Frame extraction failure patterns

---

## Comprehensive Safeguards Recommendations

### Phase 1: Immediate Improvements (Quick Wins)

#### 1.1 Real-time Buffering Feedback
**File:** `src/content/overlay-wizard/screens/ProcessingScreen.tsx`

**Goal:** Show users what's happening during buffering waits

**Implementation:**
```typescript
interface BufferingStatus {
  isBuffering: boolean;
  currentFrame: number;
  totalFrames: number;
  bufferedPercentage: number;
  networkSpeed: 'fast' | 'medium' | 'slow';
  estimatedTimeRemaining: number;
}

// Add to ProcessingScreen component:
{processingStatus?.stage === 'CAPTURING' && bufferingStatus && (
  <div className="ytgif-buffering-status">
    <div className="ytgif-buffering-indicator">
      <svg className="ytgif-buffering-spinner">...</svg>
      <span>Waiting for video buffering...</span>
    </div>
    <div className="ytgif-buffering-progress">
      <div className="ytgif-buffering-bar"
           style={{ width: `${bufferingStatus.bufferedPercentage}%` }} />
    </div>
    <div className="ytgif-buffering-info">
      <span>Network: {bufferingStatus.networkSpeed}</span>
      <span>Frame {bufferingStatus.currentFrame}/{bufferingStatus.totalFrames}</span>
      <span>~{bufferingStatus.estimatedTimeRemaining}s remaining</span>
    </div>
  </div>
)}
```

**Messages:**
- "Buffering video data..." (with progress bar)
- "Network slow - this may take a moment"
- "Adjusting settings for slow connection..."

**Benefit:** Users know extension is working, not frozen. Reduces abandonment.

#### 1.2 Multi-strategy Retry System
**File:** `src/content/gif-processor.ts`

**Goal:** Try multiple recovery approaches before aborting

**Implementation:**
```typescript
interface RetryStrategy {
  name: string;
  maxAttempts: number;
  delay: (attempt: number) => number;
  shouldRetry: (error: Error) => boolean;
  onRetry?: (attempt: number) => void;
}

const BUFFERING_RETRY_STRATEGIES: RetryStrategy[] = [
  {
    name: 'quick-retry',
    maxAttempts: 3,
    delay: (attempt) => 100 * Math.pow(2, attempt), // Exponential backoff
    shouldRetry: (error) => error.message.includes('readyState'),
    onRetry: (attempt) => logger.info(`Quick retry ${attempt}`)
  },
  {
    name: 'buffer-wait',
    maxAttempts: 5,
    delay: (attempt) => 1000 * attempt, // Linear increase
    shouldRetry: (error) => error.message.includes('buffering'),
    onRetry: (attempt) => logger.info(`Waiting for buffer ${attempt}`)
  },
  {
    name: 'time-nudge',
    maxAttempts: 3,
    delay: () => 300,
    shouldRetry: (error) => error.message.includes('duplicate'),
    onRetry: (attempt) => {
      videoElement.currentTime += 0.001 * attempt;
    }
  }
];

async function captureFrameWithRetry(
  video: HTMLVideoElement,
  targetTime: number,
  strategies: RetryStrategy[]
): Promise<HTMLCanvasElement> {
  for (const strategy of strategies) {
    for (let attempt = 0; attempt < strategy.maxAttempts; attempt++) {
      try {
        return await captureFrame(video, targetTime);
      } catch (error) {
        if (!strategy.shouldRetry(error)) break;

        strategy.onRetry?.(attempt);
        await new Promise(resolve =>
          setTimeout(resolve, strategy.delay(attempt))
        );
      }
    }
  }
  throw new Error('All retry strategies exhausted');
}
```

**Benefit:** Survives transient network issues, doesn't fail on first timeout.

#### 1.3 Buffering Telemetry Integration
**File:** `src/monitoring/metrics-collector.ts`

**Goal:** Track buffering events to tune timeout defaults

**Implementation:**
```typescript
interface BufferingMetric {
  frameNumber: number;
  targetTime: number;
  waitDuration: number;
  readyState: number;
  bufferedRanges: { start: number; end: number }[];
  networkSpeed: string;
  success: boolean;
  degradationLevel?: number;
}

// Add to MetricsCollector class:
public recordBufferingEvent(metric: BufferingMetric): void {
  this.recordUserAction('buffering-wait', {
    waitDuration: metric.waitDuration,
    success: metric.success,
    networkSpeed: metric.networkSpeed
  });

  if (!metric.success) {
    this.recordError({
      type: 'buffering-timeout',
      message: `Frame ${metric.frameNumber} buffering timeout`,
      context: {
        targetTime: metric.targetTime,
        readyState: metric.readyState,
        waitDuration: metric.waitDuration
      }
    });
  }
}

// Aggregate metrics to tune defaults:
public getBufferingInsights(): {
  avgWaitTime: number;
  timeoutRate: number;
  recommendedTimeout: number;
} {
  const bufferingEvents = this.userActions.filter(
    a => a.action === 'buffering-wait'
  );
  const timeouts = bufferingEvents.filter(e => !e.details?.success);

  const avgWaitTime = bufferingEvents.reduce(
    (sum, e) => sum + (e.details?.waitDuration || 0), 0
  ) / bufferingEvents.length;

  const timeoutRate = timeouts.length / bufferingEvents.length;

  // Recommend timeout at 95th percentile of successful waits
  const successfulWaits = bufferingEvents
    .filter(e => e.details?.success)
    .map(e => e.details?.waitDuration || 0)
    .sort((a, b) => a - b);

  const p95Index = Math.floor(successfulWaits.length * 0.95);
  const recommendedTimeout = successfulWaits[p95Index] || 3000;

  return { avgWaitTime, timeoutRate, recommendedTimeout };
}
```

**Integration:** Call `recordBufferingEvent()` in `waitForVideoReady()` for all waits.

**Benefit:** Data-driven timeout tuning, identify problematic videos/network conditions.

---

### Phase 2: User Controls (Empower Users)

#### 2.1 Pre-flight Buffering Validation
**File:** `src/content/buffering-validator.ts` (new)

**Goal:** Check buffering status before starting capture, warn users

**Implementation:**
```typescript
interface BufferingValidation {
  isReady: boolean;
  bufferedPercentage: number;
  estimatedWaitTime?: number;
  warnings: string[];
}

async function validateBufferingForCapture(
  video: HTMLVideoElement,
  startTime: number,
  endTime: number
): Promise<BufferingValidation> {
  const buffered = video.buffered;
  let bufferedInRange = 0;
  const rangeDuration = endTime - startTime;

  // Check buffered coverage
  for (let i = 0; i < buffered.length; i++) {
    const rangeStart = Math.max(buffered.start(i), startTime);
    const rangeEnd = Math.min(buffered.end(i), endTime);
    if (rangeEnd > rangeStart) {
      bufferedInRange += rangeEnd - rangeStart;
    }
  }

  const bufferedPercentage = (bufferedInRange / rangeDuration) * 100;
  const warnings = [];

  if (bufferedPercentage < 50) {
    warnings.push('Less than 50% buffered - may experience delays');
  }

  // Check connection quality (if available)
  const connection = (navigator as any).connection;
  if (connection?.effectiveType === 'slow-2g' ||
      connection?.effectiveType === '2g') {
    warnings.push('Slow connection detected - consider shorter duration');
  }

  return {
    isReady: bufferedPercentage >= 30, // Minimum threshold
    bufferedPercentage,
    estimatedWaitTime: bufferedPercentage < 100
      ? (100 - bufferedPercentage) * 200
      : undefined,
    warnings
  };
}
```

**Integration:**
- Call in `QuickCaptureScreen.tsx` before "Continue to Customize" button enabled
- Show buffering indicator in wizard
- Add "Wait for buffering" button option if < 100%

**Benefit:** Prevents starting capture when video not ready, sets user expectations.

#### 2.2 Connection Quality Settings
**File:** `src/types/storage.ts`

**Goal:** Let users choose buffering behavior based on their connection

**Implementation:**
```typescript
export interface UserPreferences {
  // ... existing fields
  bufferingMode: 'aggressive' | 'balanced' | 'patient';
  networkQuality: 'auto' | 'fast' | 'medium' | 'slow';
  allowFrameSkipping: boolean;
  maxWaitPerFrame: number; // seconds
}

// Preset configurations:
const BUFFERING_PRESETS = {
  aggressive: {
    maxWaitPerFrame: 1,
    allowFrameSkipping: true,
    autoReduceQuality: true,
    description: 'Fast capture, may skip frames or reduce quality'
  },
  balanced: {
    maxWaitPerFrame: 3,
    allowFrameSkipping: false,
    autoReduceQuality: true,
    description: 'Standard capture with quality adjustments if needed'
  },
  patient: {
    maxWaitPerFrame: 10,
    allowFrameSkipping: false,
    autoReduceQuality: false,
    description: 'Wait for full quality, never compromise'
  }
};
```

**UI Location:** `src/content/overlay-wizard/screens/QuickCaptureScreen.tsx`

Add expandable "Advanced" section:
```typescript
<details className="ytgif-advanced-options">
  <summary>Advanced Settings</summary>

  <div className="ytgif-buffering-mode">
    <label>Buffering Mode:</label>
    <select value={bufferingMode} onChange={...}>
      <option value="aggressive">Fast (may skip frames)</option>
      <option value="balanced">Balanced (recommended)</option>
      <option value="patient">Patient (full quality)</option>
    </select>
  </div>

  <div className="ytgif-network-quality">
    <label>Connection Quality:</label>
    <select value={networkQuality} onChange={...}>
      <option value="auto">Auto-detect</option>
      <option value="fast">Fast (WiFi/Ethernet)</option>
      <option value="medium">Medium (4G)</option>
      <option value="slow">Slow (3G or slower)</option>
    </select>
  </div>

  <div className="ytgif-frame-skipping">
    <label>
      <input type="checkbox" checked={allowFrameSkipping} onChange={...} />
      Skip frames if buffering too slow
    </label>
  </div>
</details>
```

**Benefit:** Power users can optimize for their situation, reduces support burden.

#### 2.3 Graceful Degradation
**File:** `src/content/degradation-manager.ts` (new)

**Goal:** Automatically reduce quality instead of failing

**Implementation:**
```typescript
interface DegradationStep {
  level: number;
  action: 'reduce-framerate' | 'reduce-resolution' | 'skip-frames' | 'abort';
  description: string;
  apply: (options: GifProcessingOptions) => GifProcessingOptions;
}

const DEGRADATION_STEPS: DegradationStep[] = [
  {
    level: 1,
    action: 'reduce-framerate',
    description: 'Reducing frame rate to 5 fps for better buffering',
    apply: (opts) => ({ ...opts, frameRate: Math.min(opts.frameRate || 10, 5) })
  },
  {
    level: 2,
    action: 'skip-frames',
    description: 'Skipping duplicate frames to speed up capture',
    apply: (opts) => ({ ...opts, skipDuplicates: true })
  },
  {
    level: 3,
    action: 'reduce-resolution',
    description: 'Reducing resolution to 144p for faster processing',
    apply: (opts) => ({
      ...opts,
      width: 256,
      height: 144,
      resolution: '144p'
    })
  },
  {
    level: 4,
    action: 'abort',
    description: 'Unable to continue - network too slow',
    apply: (opts) => opts
  }
];

async function attemptWithDegradation(
  video: HTMLVideoElement,
  options: GifProcessingOptions,
  onProgressUpdate: (message: string) => void
): Promise<GifProcessingResult> {
  for (const step of DEGRADATION_STEPS) {
    if (step.action === 'abort') {
      throw createError(
        'network',
        'GIF creation failed after multiple quality adjustments. ' +
        'Please wait for video to buffer or try a shorter duration.'
      );
    }

    try {
      const adjustedOptions = step.apply(options);
      onProgressUpdate(step.description);
      return await captureFrames(video, adjustedOptions);
    } catch (error) {
      if (error.message.includes('buffering')) {
        logger.warn(
          `Degradation level ${step.level} failed, trying next: ${step.description}`
        );
        continue; // Try next degradation step
      }
      throw error; // Non-buffering errors re-thrown immediately
    }
  }

  // Shouldn't reach here
  throw createError('unknown', 'Degradation logic error');
}
```

**Integration:** Wrap `captureFrames()` call in `gif-processor.ts`:
```typescript
// In processVideoToGif method:
const result = await attemptWithDegradation(
  videoElement,
  options,
  (message) => {
    this.updateProgress({
      stage: 'CAPTURING',
      message,
      progress: 0
    });
  }
);
```

**Benefit:** Users get lower quality GIF instead of complete failure. Can retry later for full quality.

---

### Phase 3: Intelligence (Adaptive System)

#### 3.1 Enhanced Adaptive Timeouts
**File:** `src/lib/simple-frame-extractor.ts`

**Goal:** Dynamically scale timeouts based on observed performance

**Implementation:**
```typescript
interface AdaptiveTimeoutConfig {
  baseTimeout: number;
  maxTimeout: number;
  backoffFactor: number;
  consecutiveFailureThreshold: number;
}

class AdaptiveTimeoutManager {
  private recentWaitTimes: number[] = [];
  private consecutiveTimeouts = 0;
  private frameTimes: Map<number, number> = new Map();

  getTimeoutForFrame(
    frameNumber: number,
    config: AdaptiveTimeoutConfig
  ): number {
    // Base timeout scales with consecutive failures
    const failureMultiplier = Math.pow(
      config.backoffFactor,
      this.consecutiveTimeouts
    );
    const adaptiveTimeout = Math.min(
      config.baseTimeout * failureMultiplier,
      config.maxTimeout
    );

    // Consider recent performance
    if (this.recentWaitTimes.length >= 3) {
      const avgRecent = this.recentWaitTimes
        .slice(-3)
        .reduce((a, b) => a + b) / 3;

      // If recent waits are high, preemptively increase timeout
      if (avgRecent > config.baseTimeout * 0.8) {
        return Math.min(avgRecent * 1.5, config.maxTimeout);
      }
    }

    // Look for patterns in frame timing
    if (frameNumber > 5) {
      const recentFrameNumbers = Array.from(this.frameTimes.keys())
        .filter(n => n >= frameNumber - 5);
      const avgFrameTime = recentFrameNumbers
        .map(n => this.frameTimes.get(n) || 0)
        .reduce((a, b) => a + b, 0) / recentFrameNumbers.length;

      if (avgFrameTime > config.baseTimeout * 0.9) {
        return Math.min(avgFrameTime * 1.2, config.maxTimeout);
      }
    }

    return adaptiveTimeout;
  }

  recordWait(frameNumber: number, duration: number, success: boolean) {
    this.recentWaitTimes.push(duration);
    if (this.recentWaitTimes.length > 10) {
      this.recentWaitTimes.shift();
    }

    this.frameTimes.set(frameNumber, duration);

    if (success) {
      this.consecutiveTimeouts = 0;
    } else {
      this.consecutiveTimeouts++;
    }
  }

  reset() {
    this.recentWaitTimes = [];
    this.consecutiveTimeouts = 0;
    this.frameTimes.clear();
  }
}
```

**Integration:** Replace static timeouts in `captureFrames()` with adaptive manager.

**Benefit:** System learns from current capture session, adapts to video-specific characteristics.

#### 3.2 Connection-Aware Defaults
**File:** `src/content/overlay-wizard/screens/QuickCaptureScreen.tsx`

**Goal:** Pre-adjust settings based on detected connection quality

**Implementation:**
```typescript
useEffect(() => {
  // Detect connection quality on mount
  const connection = (navigator as any).connection;

  if (connection) {
    const effectiveType = connection.effectiveType;
    const downlink = connection.downlink; // Mbps

    // Adjust defaults based on connection
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      setDefaultFrameRate(3);
      setDefaultResolution('144p');
      setBufferingMode('patient');
      setWarning('Slow connection detected - settings adjusted');
    } else if (effectiveType === '3g' || downlink < 1.5) {
      setDefaultFrameRate(5);
      setDefaultResolution('240p');
      setBufferingMode('balanced');
    } else {
      // Fast connection - use user's saved preferences
      setDefaultFrameRate(userPreferences.defaultFrameRate || 10);
      setDefaultResolution(userPreferences.defaultResolution || '360p');
      setBufferingMode('balanced');
    }

    // Monitor connection changes during capture
    connection.addEventListener('change', handleConnectionChange);
  }
}, []);
```

**Benefit:** Reduces failures before they happen, better initial experience.

#### 3.3 Predictive Buffering
**File:** `src/content/gif-processor.ts`

**Goal:** Pre-buffer frames ahead of capture to reduce waits

**Implementation:**
```typescript
async function prefetchFrameRange(
  video: HTMLVideoElement,
  startTime: number,
  endTime: number,
  frameRate: number
): Promise<void> {
  const frameTimes = [];
  const duration = endTime - startTime;
  const frameCount = Math.ceil(duration * frameRate);
  const frameInterval = duration / frameCount;

  for (let i = 0; i < frameCount; i++) {
    frameTimes.push(startTime + i * frameInterval);
  }

  // Seek to each time to trigger buffering
  for (const time of frameTimes) {
    video.currentTime = time;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Return to start
  video.currentTime = startTime;

  logger.info('[GifProcessor] Pre-buffered frame range', {
    startTime,
    endTime,
    frameCount
  });
}
```

**Integration:** Call before `captureFrames()` starts, only if user enabled "Pre-buffer frames" option.

**Benefit:** Smoother capture with fewer waits, especially for long GIFs.

---

## Implementation Priority

### Phase 1: Immediate (addresses current issue)
**Effort:** ~4-6 hours
**Impact:** High

1. ✅ Enhanced adaptive timeouts in `simple-frame-extractor.ts`
2. ✅ Real-time buffering feedback in `ProcessingScreen.tsx`
3. ✅ Multi-strategy retry system in `gif-processor.ts`

### Phase 2: Short-term (user control)
**Effort:** ~8-12 hours
**Impact:** High

4. Pre-flight buffering validation before capture
5. User preference controls in settings
6. Graceful degradation with user notification

### Phase 3: Long-term (intelligence)
**Effort:** ~16-20 hours
**Impact:** Medium (optimization)

7. Buffering telemetry integration
8. Analytics-driven timeout tuning
9. Predictive buffering based on connection quality

---

## Testing Strategy

### Unit Tests
- `buffering-validator.test.ts` - Validation logic
- `degradation-manager.test.ts` - Degradation steps
- `adaptive-timeout-manager.test.ts` - Timeout calculations

### Integration Tests
- Mock slow network conditions with delay injection
- Test all degradation levels execute correctly
- Verify retry strategies exhaust before abort
- Confirm telemetry records all buffering events

### Manual E2E Tests
1. **Slow connection simulation**
   - Chrome DevTools → Network → Slow 3G
   - Verify degradation activates
   - Confirm user sees buffering feedback

2. **Partial buffering**
   - Start GIF capture on partially buffered video
   - Verify pre-flight validation warns user
   - Confirm capture succeeds with waits

3. **Network interruption**
   - Start capture, throttle network mid-capture
   - Verify retry strategies activate
   - Confirm graceful degradation or error message

---

## Success Metrics

### Phase 1
- Buffering timeout rate < 5% (currently ~15-20%)
- User sees real-time feedback during waits
- Retry recovery success rate > 60%

### Phase 2
- Pre-flight validation reduces timeouts by 30%
- Users with "patient" mode have 0% timeouts
- Graceful degradation produces GIF 80% of the time

### Phase 3
- Adaptive timeouts reduce average wait time by 20%
- Telemetry-driven tuning improves timeout rate monthly
- Connection-aware defaults prevent 50% of slow-network failures

---

## Rollout Plan

1. **Phase 1 (v1.0.11)**
   - Deploy improved timeouts + retry logic
   - A/B test buffering feedback UI
   - Monitor telemetry for 2 weeks

2. **Phase 2 (v1.0.12)**
   - Add user controls to wizard
   - Enable pre-flight validation
   - Deploy graceful degradation (opt-in beta)

3. **Phase 3 (v1.1.0)**
   - Full adaptive timeout system
   - Connection-aware defaults
   - Predictive buffering (experimental)

---

## Related Files

- `src/content/gif-processor.ts` - Main frame capture logic
- `src/lib/simple-frame-extractor.ts` - Advanced buffering waits
- `src/content/youtube-detector.ts` - Video readiness checks
- `src/content/overlay-wizard/screens/ProcessingScreen.tsx` - UI feedback
- `src/content/overlay-wizard/screens/QuickCaptureScreen.tsx` - Settings UI
- `src/types/storage.ts` - User preferences
- `src/monitoring/metrics-collector.ts` - Telemetry

---

## Notes

- Recent fix (v1.0.10) already improved tolerance significantly
- Focus Phase 1 on feedback and retry (don't over-engineer timeouts further)
- Phase 2 user controls are highest value-add for power users
- Phase 3 can be deferred based on Phase 1 telemetry results
