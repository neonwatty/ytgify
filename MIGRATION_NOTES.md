# WXT Migration Notes

## Phase 2 Status: Partially Complete

### Completed (Tasks 2.1-2.4)
- ✅ Task 2.1: Shadow DOM CSS bundle created (`entrypoints/content/style.css`, 3,414 lines)
- ✅ Task 2.2: WXT content script wrapper implemented with `defineContentScript`
- ✅ Task 2.3: WXT-based navigation using `MatchPattern` and `wxt:locationchange`
- ✅ Task 2.4: Shadow DOM UI manager with `createShadowRootUi` for React overlays

### Blocked (Task 2.5)
- ⚠️ YouTubeGifMaker migration blocked by path alias resolution issue

## Critical Blocker: Path Alias Resolution

### The Problem

WXT's entrypoint extraction phase runs **before** Vite's alias resolution, causing imports from `src/*` using `@/*` aliases to fail with:

```
Cannot find module '@/lib/logger' imported from '/Users/jeremywatt/Desktop/ytgify/src/content/injection-manager.ts'
resolved id: /Users/jeremywatt/Desktop/ytgify/lib/logger (missing src/)
```

### Root Cause

1. **Project Structure**: Uses `@/*` → `src/*` path aliases (standard TypeScript pattern)
2. **WXT Default**: `@/*` → `./*` (project root by default)
3. **GitHub Issue**: [wxt-dev/wxt#1663](https://github.com/wxt-dev/wxt/issues/1663) - WXT doesn't support custom wildcard path mappings

### Attempted Solutions (All Failed)

1. ✗ **vite-tsconfig-paths plugin**: Doesn't run during entrypoint extraction
2. ✗ **Vite resolve.alias**: Doesn't run during entrypoint extraction
3. ✗ **WXT alias config**: Only supports base paths, not wildcards (`@/lib/*` → `src/lib/*`)
4. ✗ **Manual sub-path aliases**: Entrypoint extraction ignores them

### Resolution Options

#### Option 1: Wait for WXT Fix (Recommended)
Monitor [GitHub issue #1663](https://github.com/wxt-dev/wxt/issues/1663) for wildcard alias support.

**Pros**: Clean solution, no codebase changes
**Cons**: Timeline unknown, blocks migration completion

#### Option 2: Restructure Project
Move all `src/*` files to project root to match WXT's default `@/*` → `./*`.

**Pros**: Unblocks migration immediately
**Cons**:
- Disrupts existing file organization
- Breaks all existing imports
- Conflicts with standard project conventions

#### Option 3: Convert to Relative Imports
Replace all `@/*` imports in `src/**` files with relative paths (`../`, `../../`).

**Pros**: No structural changes required
**Cons**:
- ~100+ files need manual conversion
- Less maintainable (path updates when files move)
- Breaks TypeScript path alias convention

#### Option 4: Dual Codebase (Current State)
Maintain both old Webpack build (`src/content/index.ts`) and new WXT infrastructure side-by-side.

**Pros**:
- Extension remains functional
- WXT infrastructure ready for integration
- No forced decisions

**Cons**:
- Duplicate code maintenance
- Migration incomplete

## Current Workaround

The `entrypoints/content/gif-maker.ts` file exists with all necessary WXT refactoring complete, but cannot be imported due to path alias issues. Once resolved, the integration is a single line:

```typescript
// Currently blocked
// import { YouTubeGifMaker } from './gif-maker';
// const gifMaker = new YouTubeGifMaker(ctx, navigator, uiManager);
```

## Build Status

- **WXT Build**: ✅ Functional (555.06 kB)
- **Content Script**: ✅ 167.71 kB (includes React + shadow DOM)
- **CSS**: ✅ 29.47 kB (shadow DOM isolated)
- **Navigation**: ✅ Fully integrated with WXT patterns
- **UI Manager**: ✅ Shadow DOM React overlay system ready
- **Main Logic**: ⚠️ Blocked by path aliases

## Next Steps

1. **Immediate**: Document blocker and maintain dual build
2. **Short-term**: Monitor WXT issue #1663 for resolution
3. **Medium-term**: If no WXT fix, evaluate Option 3 (relative imports conversion)
4. **Long-term**: Complete migration once path aliases resolved

## Files Created

### WXT Infrastructure
- `entrypoints/content/index.ts` - WXT content script wrapper
- `entrypoints/content/navigation.ts` - WXT-based navigation (454 lines)
- `entrypoints/content/ui-manager.ts` - Shadow DOM UI manager (174 lines)
- `entrypoints/content/style.css` - Merged CSS bundle (3,414 lines)
- `entrypoints/content/gif-maker.ts` - Refactored YouTubeGifMaker (2,035 lines, **BLOCKED**)

### Configuration
- `wxt.config.ts` - WXT configuration with attempted alias fixes
- `.wxt/tsconfig.json` - Auto-generated WXT TypeScript config

## References

- [WXT TypeScript Configuration](https://wxt.dev/guide/essentials/config/typescript)
- [WXT GitHub Issue #1663](https://github.com/wxt-dev/wxt/issues/1663) - Custom alias paths
- [vite-tsconfig-paths](https://www.npmjs.com/package/vite-tsconfig-paths) - Attempted solution
