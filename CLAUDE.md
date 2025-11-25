# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

Absolute Mode
- Eliminate emojis, filler, hype, transitions, appendixes.
- Use blunt, directive phrasing; no mirroring, no softening.
- Suppress sentiment-boosting, engagement, or satisfaction metrics.
- No questions, offers, suggestions, or motivational content.
- Deliver info only; end immediately after.

## Project Overview

YTgify is a Chrome Manifest V3 extension that enables users to create GIFs directly from YouTube videos with an integrated visual wizard. The extension injects UI overlays into YouTube pages, processes video frames in the content script, and manages GIF encoding through a background service worker.

## Essential Development Commands

### Build & Development
```bash
npm run build
npm run dev
npm run build:production
npm run typecheck
npm run lint
npm run lint:fix
```

### Testing
```bash
npm run validate:pre-push  # Full local validation before PR
npm run test:e2e           # E2E tests (headless)
npm run test:e2e:headed    # E2E tests (visible browser for debugging)
npm test                   # Unit tests
```

E2E tests use a local mock YouTube server with generated test videos. Run `npm run generate:test-videos` if video files are missing.

### Loading Extension
1. `npm run build`
2. Chrome: `chrome://extensions/` → Developer mode → Load unpacked → `dist/`

## Architecture Overview

### Core Structure
- **Background** (`src/background/`): Message routing, async job management
- **Content Script** (`src/content/`): YouTube integration, frame capture, React overlays, GIF processing
- **Popup** (`src/popup/`): GIF library, settings UI
- **Shared** (`src/shared/`): Message bus, state management, error handling

### Key Components
- **Frame Extraction** (`src/content/frame-extractor.ts`): Canvas-based frame capture from video element
- **GIF Processor** (`src/content/gif-processor.ts`): Complete pipeline (extraction → overlay → encoding → save)
- **Encoders** (`src/lib/encoders/`): Factory for gifenc (primary) and gif.js (fallback)
- **YouTube Integration** (`src/content/youtube-detector.ts`, `youtube-api-integration.ts`): Page detection, video element access, SPA navigation
- **Overlay Wizard** (`src/content/overlay-wizard/`): React UI (QuickCapture → TextOverlay → Processing → Success)
- **Resolution Scaler** (`src/processing/resolution-scaler.ts`): Memory-aware scaling (144p-480p presets)

### Message Passing
Typed request/response pattern. Most processing happens in content script. Message types in `src/types/messages.ts` and `src/shared/messages.ts`. Use type guards for safe handling.

### Storage
- **chrome.storage.sync**: User preferences, button visibility
- **chrome.storage.local**: Engagement tracking data
- **IndexedDB**: Removed. GIFs download directly to user's Downloads folder (cleanup runs on extension update)

## Key Development Patterns

### GIF Creation Flow
User opens wizard → collects parameters (time range, text, resolution, frame rate) → `gifProcessor.processVideoToGif()` orchestrates extraction/overlay/encoding → success screen with preview/download. GIFs download directly to Downloads folder (no persistence in extension).

### YouTube Shorts
Disabled due to technical limitations. Show user-friendly message when detected.

### Error Handling
Centralized in `src/lib/errors.ts`. All async operations wrapped in try-catch with actionable user messages.

## Important Implementation Details

- **Localhost Permissions**: Used only for mock E2E tests. NEVER include in Chrome Web Store. `npm run build:production` strips them automatically.
- **CSS Loading**: Dynamically injected on wizard open, removed on close (Chrome Web Store compliance).
- **Memory Management**: Reject processing if `(width * height * 4 * 2) / (1024 * 1024) > 1000 MB`. Ensure even dimensions.
- **WebCodecs**: Not used (browser compatibility issues). Canvas-based extraction more reliable.
- **Button Visibility**: Default hidden. Toggle in popup saves to `chrome.storage.sync.buttonVisibility`.

## File Organization

- `src/types/*.ts`: Shared interfaces
- `src/utils/*.ts`: Pure functions
- `src/processing/*.ts`: Image/video processing
- `src/monitoring/*.ts`: Performance tracking
- `src/shared/*.ts`: Cross-context utilities

## Testing

### E2E Test Videos
Generate with `npm run generate:test-videos`. Use `getMockVideoUrl('veryShort', mockServerUrl)` helper in tests. Tests run against a local mock YouTube server that serves synthetic videos.

### E2E Test Structure
- `tests/e2e-mock/` - All E2E tests using mock YouTube server
- `tests/e2e-mock/fixtures/mock-youtube/` - HTML templates for mock YouTube pages
- `tests/e2e-mock/fixtures/videos/` - Generated test video files
- `tests/e2e-mock/helpers/` - Mock server, video helpers, network profiles

## Common Development Tasks

- **New Resolution Preset**: Update `src/processing/resolution-scaler.ts`, `src/content/index.ts` (resolutionDefaults), and `QuickCaptureScreen.tsx`
- **New Message Type**: Define in `src/types/messages.ts`, add type guard, add handlers, update union types
- **New Encoder**: Implement `AbstractEncoder` in `src/lib/encoders/`, add to factory, update `EncoderType` union
- **Debug GIF Creation**: Check content script logs, enable debug in `src/lib/logger.ts`, verify `youTubeDetector.canCreateGif()`

## Chrome Web Store Compliance

Run `npm run build:production` (strips localhost permissions). Test production build. Verify `dist-production/manifest.json` has no localhost permissions.

## Known Limitations

Shorts not supported. Max ~30s GIF duration. Chrome/Chromium only. Desktop only. Live streams not recommended. No GIF library in extension (GIFs download directly to Downloads folder).
