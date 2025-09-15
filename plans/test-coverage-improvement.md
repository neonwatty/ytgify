# Test Coverage Improvement Plan

## Current State (Verified)
- **Current Coverage**: 66.88% overall (Lines: 68.75%, Statements: 66.88%, Branches: 61.7%, Functions: 62.96%)
- **Files Tested**: Only 4 out of 137 TypeScript files
- **Test Suites**: 4 test suites with 73 tests
- **Last Updated**: January 2025

## Coverage Breakdown

### ✅ Currently Tested (4 files)
| File | Coverage | Status | Location |
|------|----------|--------|----------|
| popup-modern.tsx | 96.15% | Excellent | src/popup/popup-modern.tsx |
| TimelineScrubber.tsx | 51.51% | Needs improvement | src/content/overlay-wizard/components/TimelineScrubber.tsx |
| aspect-ratio.ts | Tested | Processing module | src/processing/aspect-ratio.ts |
| background/index.ts | Partial | Basic tests only | src/background/index.ts |

### ❌ Major Untested Areas (133 files)

#### 🔴 Critical Core Components (HIGH PRIORITY)
**Content Scripts** (`src/content/`) - 0% coverage (34 files total)
- `index.ts` - Main content script entry point
- `frame-extractor.ts` - Core GIF creation functionality
- `gif-processor.ts` - GIF processing logic
- `injection-manager.ts` - YouTube integration
- `overlay-state.ts` - UI state management
- `cleanup-manager.ts` - Resource cleanup
- `editor-overlay.tsx` - Editor UI components
- `player-integration.ts` - Video player control
- `timeline-overlay.tsx` - Timeline selection UI

**Background Services** (`src/background/`) - Minimal coverage
- `message-handler.ts` - Cross-component communication
- `worker.ts` - Background processing

#### 🔴 GIF Encoding/Processing (CRITICAL)
**Libraries** (`src/lib/`) - 0% coverage (17 files total)
- `gif-encoder.ts` / `gif-encoder-v2.ts` - Core encoding logic
- `instant-frame-capture.ts` - Frame extraction
- `service-worker-video-processor.ts` - Video processing
- `simple-frame-extractor.ts` - Basic frame extraction
- `logger.ts` - Logging system
- `errors.ts` - Error handling
- `utils.ts` - Utility functions
- `encoders/` subdirectory - Multiple encoder implementations

**Processing Pipeline** (`src/processing/`) - 6% coverage (16 files, only aspect-ratio.ts tested)
- `gif-encoder.ts` - GIF encoding
- `frame-extractor.ts` - Frame extraction
- `video-decoder.ts` - Video decoding
- `quality-manager.ts` - Quality optimization
- `resolution-scaler.ts` - Resolution scaling
- `batch-processor.ts` - Batch processing
- `queue-manager.ts` - Queue management
- `canvas-processor.ts` - Canvas operations
- `image-filters.ts` - Image filtering
- `file-size-estimator.ts` - Size estimation
- `encoding-options.ts` - Encoding configurations
- `task-manager.ts` - Task orchestration

#### 🟡 UI Components (MEDIUM PRIORITY)
**Overlay Wizard Screens** (`src/content/overlay-wizard/screens/`) - 0% coverage (7 files)
- `WelcomeScreen.tsx`
- `QuickCaptureScreen.tsx`
- `TextOverlayScreenV2.tsx`
- `ProcessingScreen.tsx`
- `SuccessScreen.tsx`
- `FormatSelectionScreen.tsx`
- `TextOverlayScreen.tsx`

**Popup Screens** (`src/popup/screens/`) - 0% coverage (2 files)
- `WelcomeScreen.tsx`
- `QuickCaptureScreen.tsx`

**Hooks** (`src/popup/hooks/`) - 0% coverage
- `useScreenNavigation.ts`
- `useAutoProgression.ts`

**Editor** (`src/editor/`) - 0% coverage
- Editor components and functionality

**Shared Components** (`src/components/`) - 0% coverage
- Reusable UI components

#### 🟡 Supporting Modules (MEDIUM PRIORITY)
- `src/utils/` - Utility functions
- `src/monitoring/` - Performance monitoring
- `src/shared/` - Shared resources
- `src/themes/` - Theme configurations

#### 🟢 Type Definitions (LOW PRIORITY)
- `src/types/` - TypeScript interfaces and types

## Prioritized Testing Strategy

### 🔴 PRIORITY 1: Core Functionality (CRITICAL - 0% coverage)
**These components form the backbone of the GIF creation pipeline**

#### Content Script Core (`src/content/`)
**Files to test:**
- `frame-extractor.ts` - Extracts frames from YouTube videos
- `gif-processor.ts` - Processes extracted frames
- `injection-manager.ts` - Manages YouTube UI integration
- `player-integration.ts` - Controls video playback during capture
- `overlay-state.ts` - UI state management
- `cleanup-manager.ts` - Resource cleanup

**Test requirements:**
- Frame extraction from video elements
- Message passing with background script
- Error handling for unavailable videos
- Cleanup on navigation
- YouTube API integration

#### GIF Encoding Pipeline (`src/lib/encoders/` & `src/processing/`)
**Files to test:**
- `gif-encoder-v2.ts` - Main encoding logic with multiple backends
- `frame-extractor.ts` - Frame extraction algorithms
- `video-decoder.ts` - Video decoding logic
- `encoding-options.ts` - Configuration management
- `quality-manager.ts` - Quality optimization
- `resolution-scaler.ts` - Resolution scaling

**Test requirements:**
- Different quality settings (low/medium/high)
- Various frame rates (5-30 fps)
- Large video handling (>30s)
- Memory optimization
- Progress tracking
- Error recovery

#### Background Services (`src/background/`)
**Files to test:**
- `message-handler.ts` - Cross-component communication hub
- `worker.ts` - Background processing tasks

**Test requirements:**
- Message routing between components
- Worker task processing
- Error recovery mechanisms
- Chrome API interactions

### 🟡 PRIORITY 2: User Interaction (HIGH - 0% coverage)
**Direct user-facing features that need testing**

#### Timeline & Selection UI
**Files to test:**
- `timeline-overlay.tsx` - Video segment selection
- `editor-overlay.tsx` - GIF editor interface
- `editor-overlay-enhanced.tsx` - Enhanced editor features
- `preview-loop.ts` - Preview playback logic
- `time-selector.ts` - Time selection logic
- `preset-calculator.ts` - Preset configurations

**Test requirements:**
- Timeline segment selection accuracy
- Preview playback functionality
- Settings changes and persistence
- UI component interactions
- Keyboard shortcuts
- Accessibility features

#### Popup Screens (`src/popup/screens/`)
**Files to test:**
- `WelcomeScreen.tsx` - Initial user experience
- `QuickCaptureScreen.tsx` - Quick capture functionality
- `TextOverlayScreenV2.tsx` - Text overlay editor
- `ProcessingScreen.tsx` - Processing status display
- `SuccessScreen.tsx` - Success confirmation screen

**Test requirements:**
- Screen navigation flows
- Form inputs and validation
- Error state displays
- Loading states
- Auto-progression logic

### 🟢 PRIORITY 3: Supporting Systems (MEDIUM - 0% coverage)
**Important but not blocking core functionality**

#### Utilities & Helpers
**Files to test:**
- `lib/errors.ts` - Error handling
- `lib/logger.ts` - Logging system
- `utils/clipboard-manager.ts` - Clipboard operations
- `monitoring/performance-tracker.ts` - Performance monitoring
- `themes/youtube-matcher.ts` - Theme detection

**Test requirements:**
- Error creation and handling
- Logging functionality
- Clipboard operations
- Performance tracking
- Theme matching logic

## Implementation Strategy

### Phase 1: Core GIF Creation Pipeline (Week 1-2)
**Target: +10% coverage (67% → 77%)**

#### Focus Areas:
1. **Content Script Testing**
   - Frame extraction from video elements
   - Message passing between content/background scripts
   - Error handling for edge cases (unavailable videos, memory limits)
   - YouTube integration and cleanup

2. **GIF Encoding Testing**
   - Different quality settings (low/medium/high)
   - Various frame rates and resolutions
   - Memory optimization and progress tracking
   - Multiple encoder backends

3. **Background Service Testing**
   - Message routing and handling
   - Worker task processing
   - Chrome API interactions

### Phase 2: User Interaction Flow (Week 3)
**Target: +8% coverage (77% → 85%)**

#### Focus Areas:
1. **Timeline & Editor Testing**
   - Segment selection accuracy
   - Preview playback functionality
   - Settings persistence
   - UI component interactions

2. **Popup Screen Testing**
   - Navigation flows
   - Form validation
   - Error states
   - Loading states

### Phase 3: Integration & E2E Testing (Week 4)
**Target: +5% coverage (85% → 90%)**

#### Focus Areas:
1. **Complete Workflow Testing**
   - End-to-end GIF creation flow
   - Cross-component communication
   - Performance benchmarks
   - Edge cases and error recovery

2. **Supporting Systems**
   - Error handling utilities
   - Logging and monitoring
   - Clipboard operations

### Testing Approach
1. **Unit Tests**: Isolate individual functions and components
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Validate complete user workflows
4. **Performance Tests**: Ensure encoding efficiency

### Mocking Strategy
- Mock Chrome Extension APIs
- Mock YouTube video elements
- Mock canvas and WebGL contexts
- Create test fixtures for video data
- Use React Testing Library for components

### Test Data
- Sample video frames (various resolutions)
- Test GIF outputs for comparison
- Mock Chrome storage data
- Sample error scenarios

## Success Metrics

### Coverage Goals
- **Overall**: 85% minimum (from current 67%)
- **Critical paths**: 95% (frame extraction, encoding)
- **UI components**: 80%
- **Utilities**: 75%

### Quality Metrics
- All tests passing in CI/CD
- No flaky tests
- Test execution under 30 seconds
- Clear test descriptions

### Business Impact
- Reduced production bugs
- Faster feature development
- Improved code confidence
- Better contributor onboarding

## Execution Timeline

### Week 1-2: Priority 1 - Core Functionality
- Content script frame extraction tests
- GIF encoding pipeline tests
- Background service message handling tests
- Chrome API mock setup

### Week 3: Priority 2 - User Interaction
- Timeline overlay component tests
- Editor interface tests
- Popup screen navigation tests
- Preview functionality tests

### Week 4: Priority 3 - Integration & Support
- End-to-end workflow tests
- Utility function tests
- Performance benchmarks
- Error recovery scenarios

## Resources Needed

### Development
- 2-3 developers for 8 weeks
- Test data generation tools
- Performance profiling tools

### Infrastructure
- CI/CD pipeline (✅ already set up)
- Coverage reporting (✅ configured)
- Test fixtures storage

## Chrome API Mocking Strategy

### Required Mock APIs
1. **chrome.runtime**
   - `sendMessage()` - For content/background communication
   - `onMessage.addListener()` - Message listeners
   - `getURL()` - For accessing extension resources

2. **chrome.storage**
   - `local.get()` / `local.set()` - Settings persistence
   - `sync.get()` / `sync.set()` - Synced settings

3. **chrome.tabs**
   - `query()` - Finding active tabs
   - `sendMessage()` - Tab communication

4. **chrome.scripting**
   - `executeScript()` - Script injection

### Mock Implementation Example
```typescript
// tests/__mocks__/chrome.ts
export const mockChrome = {
  runtime: {
    sendMessage: jest.fn((message, callback) => {
      // Simulate async response
      setTimeout(() => callback?.(mockResponses[message.type]), 0);
    }),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`)
  },
  storage: {
    local: createStorageMock(),
    sync: createStorageMock()
  }
};
```

## Coverage-Guided Testing Approach

### 1. Use Coverage Reports to Find Critical Paths
```bash
# Generate detailed coverage report
npm test -- --coverage --coverageReporters=html

# Open coverage/index.html to visualize uncovered lines
# Focus on red (uncovered) branches in critical files
```

### 2. Priority Testing Based on Code Complexity
- **High Complexity + Low Coverage = CRITICAL**
- Use cyclomatic complexity to identify risky untested code
- Focus on functions with multiple branches/conditions

### 3. Incremental Coverage Goals
- **Week 1**: Cover all error paths in critical files
- **Week 2**: Cover happy paths in user-facing features
- **Week 3**: Edge cases and boundary conditions
- **Week 4**: Integration and E2E scenarios

## Detailed Implementation Recommendations

### Phase 1: Core Infrastructure Setup (Day 1-2)

#### 1. Create Test Utilities Module
```typescript
// tests/utils/test-helpers.ts
export const createMockVideo = (duration = 100) => ({
  currentTime: 0,
  duration,
  paused: false,
  play: jest.fn(),
  pause: jest.fn()
});

export const createMockCanvas = () => ({
  getContext: jest.fn(() => createMock2DContext()),
  toBlob: jest.fn((callback) => callback(new Blob()))
});

export const waitForMessageResponse = () =>
  new Promise(resolve => setTimeout(resolve, 10));
```

#### 2. Set Up Test Data Fixtures
```typescript
// tests/fixtures/
- sample-frames.ts     // Mock video frame data
- gif-settings.ts      // Test GIF configurations
- timeline-data.ts     // Timeline selection fixtures
- error-scenarios.ts   // Common error cases
```

### Phase 2: Critical Path Testing (Week 1)

#### Frame Extraction Tests (frame-extractor.ts)
```typescript
describe('FrameExtractor', () => {
  it('should extract frames at specified intervals');
  it('should handle video element not ready');
  it('should respect memory limits');
  it('should cancel extraction on navigation');
  it('should report progress accurately');
});
```

#### GIF Encoding Tests (gif-encoder-v2.ts)
```typescript
describe('GifEncoderV2', () => {
  it('should encode with different quality settings');
  it('should handle large frame counts (>100)');
  it('should optimize palette for each frame');
  it('should abort encoding on user cancel');
  it('should estimate file size accurately');
});
```

### Phase 3: User Flow Testing (Week 2)

#### Timeline Selection Tests
```typescript
describe('Timeline Selection Flow', () => {
  it('should select valid time range');
  it('should prevent invalid selections');
  it('should update preview on change');
  it('should persist selection state');
});
```

### Phase 4: Integration Testing (Week 3-4)

#### End-to-End GIF Creation
```typescript
describe('Complete GIF Creation', () => {
  it('should create GIF from YouTube video');
  it('should handle network interruptions');
  it('should cleanup resources on failure');
  it('should save to IndexedDB');
});
```

## Next Steps

1. **Immediate Actions (Day 1-2)**
   - Set up comprehensive Chrome API mocks using the strategy above
   - Create test utilities for video/canvas operations
   - Establish test file structure matching src/
   - Install additional testing libraries if needed (e.g., @testing-library/user-event)

2. **Priority 1 Implementation (Week 1-2)**
   - Write unit tests for frame-extractor.ts
   - Test gif-encoder-v2.ts with various configurations
   - Add message-handler.ts communication tests
   - Implement player-integration.ts tests

3. **Priority 2 Implementation (Week 3)**
   - Create React component tests for overlays
   - Test timeline selection accuracy
   - Add popup screen navigation tests

4. **Priority 3 Implementation (Week 4)**
   - Implement E2E GIF creation tests
   - Add performance benchmarks
   - Test error recovery scenarios

5. **Ongoing Maintenance**
   - Monitor coverage trends weekly
   - Add tests incrementally with each PR
   - Refactor code for better testability where needed
   - Use pre-commit hooks to enforce minimum coverage

## Testing Best Practices

### 1. Test Organization
```
tests/
├── unit/                   # Isolated unit tests
│   ├── content/           # Mirror src structure
│   ├── lib/
│   ├── processing/
│   └── background/
├── integration/           # Component interaction tests
│   ├── message-flow/     # Content↔Background communication
│   ├── gif-creation/     # End-to-end GIF workflow
│   └── ui-flows/         # User interaction sequences
├── fixtures/             # Test data and mocks
├── utils/               # Test helpers and utilities
└── __mocks__/          # Module mocks
```

### 2. Test Naming Convention
- **File**: `[component-name].test.ts`
- **Test Suite**: `describe('ComponentName', () => {})`
- **Test Case**: `it('should [expected behavior] when [condition]')`

### 3. Coverage Thresholds
```json
// jest.config.js
"coverageThreshold": {
  "global": {
    "branches": 80,
    "functions": 80,
    "lines": 85,
    "statements": 85
  },
  "src/content/frame-extractor.ts": {
    "branches": 95,
    "functions": 95,
    "lines": 95,
    "statements": 95
  }
}
```

### 4. Continuous Integration Checks
```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: npm test -- --coverage --coverageReporters=json-summary

- name: Check coverage thresholds
  run: npm run test:coverage:check

- name: Comment PR with coverage
  uses: actions/coverage-action@v2
```

### 5. Performance Testing Considerations
- Test GIF encoding with various sizes (100KB to 10MB)
- Measure memory usage during frame extraction
- Benchmark encoding speed for different quality settings
- Test with videos of different lengths (5s, 30s, 2min)

## Risk Mitigation

### High-Risk Untested Areas
1. **Memory Management** in frame extraction
   - Risk: Browser crashes with large videos
   - Mitigation: Add memory limit tests

2. **Chrome API Failures**
   - Risk: Extension breaks on API changes
   - Mitigation: Comprehensive API mocking and error handling tests

3. **YouTube Player Changes**
   - Risk: Injection fails with YouTube updates
   - Mitigation: Robust element detection tests

4. **Race Conditions**
   - Risk: Message timing issues
   - Mitigation: Async flow testing with various delays

## Notes

- Focus on testing public APIs, not implementation details
- Write tests that describe behavior, not code structure
- Maintain test performance as coverage grows
- Consider snapshot testing for UI components
- Add visual regression tests for editor UI

## Quick Start Implementation Guide

### 1. First Test to Write (frame-extractor.ts)
```typescript
// tests/unit/content/frame-extractor.test.ts
import { FrameExtractor } from '@/content/frame-extractor';
import { createMockVideo, createMockCanvas } from '../../utils/test-helpers';

describe('FrameExtractor', () => {
  let frameExtractor: FrameExtractor;
  let mockVideo: HTMLVideoElement;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    mockVideo = createMockVideo(30); // 30 second video
    mockCanvas = createMockCanvas();
    frameExtractor = new FrameExtractor(mockVideo, mockCanvas);
  });

  describe('extractFrames', () => {
    it('should extract frames at 1 second intervals', async () => {
      const frames = await frameExtractor.extractFrames({
        startTime: 0,
        endTime: 5,
        frameRate: 1
      });

      expect(frames).toHaveLength(5);
      expect(mockVideo.currentTime).toBe(5);
    });

    it('should handle video load errors', async () => {
      mockVideo.addEventListener = jest.fn((event, callback) => {
        if (event === 'error') setTimeout(callback, 10);
      });

      await expect(frameExtractor.extractFrames({
        startTime: 0,
        endTime: 5,
        frameRate: 1
      })).rejects.toThrow('Video load error');
    });

    it('should respect memory limits', async () => {
      // Test with many frames to trigger memory limit
      const frames = await frameExtractor.extractFrames({
        startTime: 0,
        endTime: 100, // Large range
        frameRate: 10,
        maxMemoryMB: 50
      });

      expect(frames.length).toBeLessThan(1000); // Should be limited
    });
  });
});
```

### 2. Message Handler Test Example
```typescript
// tests/unit/background/message-handler.test.ts
import { MessageHandler } from '@/background/message-handler';
import { mockChrome } from '../../__mocks__/chrome';

describe('MessageHandler', () => {
  let handler: MessageHandler;

  beforeEach(() => {
    global.chrome = mockChrome;
    handler = new MessageHandler();
  });

  it('should route frame extraction requests', async () => {
    const message = {
      type: 'EXTRACT_FRAMES',
      payload: { startTime: 0, endTime: 5 }
    };

    const response = await handler.handleMessage(message);

    expect(response.success).toBe(true);
    expect(response.frames).toBeDefined();
  });

  it('should handle unknown message types', async () => {
    const message = { type: 'UNKNOWN' };

    const response = await handler.handleMessage(message);

    expect(response.success).toBe(false);
    expect(response.error).toContain('Unknown message type');
  });
});
```

### 3. React Component Test Example
```typescript
// tests/unit/content/overlay-wizard/screens/ProcessingScreen.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProcessingScreen } from '@/content/overlay-wizard/screens/ProcessingScreen';

describe('ProcessingScreen', () => {
  it('should display progress percentage', () => {
    render(
      <ProcessingScreen
        progress={75}
        status="Encoding frames..."
      />
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Encoding frames...')).toBeInTheDocument();
  });

  it('should show cancel button when cancellable', () => {
    const onCancel = jest.fn();

    render(
      <ProcessingScreen
        progress={50}
        status="Processing..."
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeInTheDocument();
  });
});
```

### 4. Commands to Start Testing

```bash
# 1. Set up test structure
mkdir -p tests/{unit/{content,lib,processing,background},integration,fixtures,utils}

# 2. Create first test utilities
touch tests/utils/test-helpers.ts
touch tests/__mocks__/chrome.ts
touch tests/fixtures/sample-frames.ts

# 3. Run tests in watch mode while developing
npm run test:watch

# 4. Generate coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html

# 5. Test specific file patterns
npm test frame-extractor     # Test frame extraction
npm test processing          # Test processing modules
npm test content             # Test content scripts
```

This comprehensive plan provides a roadmap to achieve 85-90% test coverage systematically while maintaining code quality and catching critical bugs early.