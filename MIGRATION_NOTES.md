# WXT Migration Notes

## Phase 2 Status: Infrastructure Complete, Integration Pending

### Completed (Tasks 2.1-2.4)
- ✅ Task 2.1: Shadow DOM CSS bundle created (`src/entrypoints/content/style.css`, 3,414 lines)
- ✅ Task 2.2: WXT content script wrapper implemented with `defineContentScript`
- ✅ Task 2.3: WXT-based navigation using `MatchPattern` and `wxt:locationchange`
- ✅ Task 2.4: Shadow DOM UI manager with `createShadowRootUi` for React overlays
- ✅ **Path Alias Fixed**: Set `srcDir: 'src'` in wxt.config.ts, moved entrypoints to src/

### Blocked (Task 2.5)
- ⚠️ YouTubeGifMaker integration blocked by singleton pattern in old codebase

## Critical Blocker: Singleton Pattern

### The Problem (Solved: Path Alias)

**Original Issue**: WXT's entrypoint extraction couldn't resolve `@/*` → `src/*` aliases.

**Solution**: Set `srcDir: 'src'` in `wxt.config.ts` and move `entrypoints/` to `src/entrypoints/`. WXT's built-in `@` alias now correctly points to `src/`.

### New Blocker: Module Load Singletons

The old codebase uses the singleton pattern with module-load initialization:

```typescript
// src/content/youtube-detector.ts
export const youTubeDetector = YouTubeDetector.getInstance(); // ❌ Runs at import

// src/content/injection-manager.ts
export const injectionManager = InjectionManager.getInstance(); // ❌ Runs at import
```

During WXT's build process, these modules are imported to extract entrypoint metadata, causing `window` access before the browser context exists:

```
ERROR window is not defined
  at YouTubeDetector.detectCurrentState (src/content/youtube-detector.ts:226:17)
  at new YouTubeDetector (src/content/youtube-detector.ts:35:30)
```

### Root Cause

1. **Singleton Pattern**: Eager initialization at module load
2. **WXT Build Process**: Executes modules during entrypoint extraction
3. **Browser API Access**: Singletons try to access `window`, `document` during build

### Attempted Solutions

1. ✗ **Lazy getter pattern**: Doesn't work with method calls (`youTubeDetector.onNavigation()`)
2. ✗ **Dynamic imports**: Would require refactoring entire YouTubeGifMaker class

### Resolution Options

#### Option 1: Refactor Singletons to Lazy (Recommended)
Convert eager singletons to lazy initialization or factory functions.

**Affected Files**:
- `src/content/youtube-detector.ts`
- `src/content/injection-manager.ts`
- `src/content/player-integration.ts`
- `src/content/gif-processor.ts`
- `src/content/player-controller.ts`
- `src/themes/theme-detector.ts`

**Approach**: Export factory functions instead of instances:
```typescript
// Before
export const youTubeDetector = YouTubeDetector.getInstance();

// After
export function getYouTubeDetector(): YouTubeDetector {
  return YouTubeDetector.getInstance();
}
```

**Pros**: Clean solution, fixes root cause, improves testability
**Cons**: Requires updating all consumer code (~40 files)

#### Option 2: Continue Webpack Build (Current State)
Keep original build system operational while WXT infrastructure exists separately.

**Pros**:
- Extension remains functional
- WXT infrastructure ready
- No forced decisions

**Cons**:
- Dual maintenance overhead
- Migration incomplete

## Current Status

The `src/entrypoints/content/gif-maker.ts` file exists with all necessary WXT refactoring complete, but cannot be imported due to singleton pattern in old codebase. Once singletons are refactored, integration is a single line:

```typescript
// Currently blocked by singleton pattern
// import { YouTubeGifMaker } from './gif-maker';
// const gifMaker = new YouTubeGifMaker(ctx, navigator, uiManager);
```

## Build Status

- **WXT Build**: ✅ Functional (555.08 kB)
- **Content Script**: ✅ 167.71 kB (includes React + shadow DOM)
- **CSS**: ✅ 29.47 kB (shadow DOM isolated)
- **Navigation**: ✅ Fully integrated with WXT patterns
- **UI Manager**: ✅ Shadow DOM React overlay system ready
- **Path Aliases**: ✅ Resolved with `srcDir: 'src'`
- **Main Logic**: ⚠️ Blocked by singleton pattern

## Next Steps

1. **Immediate**: Document singleton blocker and maintain dual build
2. **Short-term**: Evaluate singleton refactoring effort (~40 files affected)
3. **Medium-term**: Refactor singletons to factory functions (Option 1)
4. **Long-term**: Complete YouTubeGifMaker integration after singleton refactor

## Files Created/Modified

### WXT Infrastructure
- `src/entrypoints/content/index.ts` - WXT content script wrapper
- `src/entrypoints/content/navigation.ts` - WXT-based navigation (454 lines)
- `src/entrypoints/content/ui-manager.ts` - Shadow DOM UI manager (174 lines)
- `src/entrypoints/content/style.css` - Merged CSS bundle (3,414 lines)
- `src/entrypoints/content/gif-maker.ts` - Refactored YouTubeGifMaker (2,035 lines, **BLOCKED**)
- `src/public/` - Moved from root for srcDir compliance
- `src/entrypoints/popup/` - Moved from root for srcDir compliance
- `src/entrypoints/background.ts` - Moved from root for srcDir compliance

### Configuration
- `wxt.config.ts` - Set `srcDir: 'src'` (simplified from complex alias workarounds)
- `.wxt/tsconfig.json` - Auto-generated WXT TypeScript config
- `package.json` - Removed `vite-tsconfig-paths` dependency (no longer needed)

## References

- [WXT TypeScript Configuration](https://wxt.dev/guide/essentials/config/typescript)
- [WXT GitHub Issue #1663](https://github.com/wxt-dev/wxt/issues/1663) - Custom alias paths
- [vite-tsconfig-paths](https://www.npmjs.com/package/vite-tsconfig-paths) - Attempted solution
