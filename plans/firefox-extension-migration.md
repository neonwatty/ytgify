# Firefox Extension Migration Plan for YTgify

## Architecture Overview
**Approach**: Separate builds with shared core business logic
- Maintain Chrome and Firefox entry points separately
- Share 95% of code through abstraction layer
- Unified build creates both versions simultaneously

## Phase 1: Browser Abstraction Layer

### Create Browser API Wrapper (`src/lib/browser-api/`)
```
src/lib/browser-api/
├── index.ts           # Main export with browser detection
├── types.ts           # Unified type definitions
├── chrome/            # Chrome-specific implementations
│   ├── runtime.ts
│   ├── storage.ts
│   ├── tabs.ts
│   └── downloads.ts
└── firefox/           # Firefox-specific implementations
    ├── runtime.ts
    ├── storage.ts
    ├── tabs.ts
    └── downloads.ts
```

### Key API Mappings
- `browserAPI.runtime.*` → maps to `chrome.*` or `browser.*`
- `browserAPI.storage.*` → handles API differences
- `browserAPI.tabs.*` → unified tab management
- `browserAPI.downloads.*` → consistent download API

## Phase 2: Build Configuration

### Webpack Configuration Updates
```
webpack/
├── webpack.common.cjs    # Shared config
├── webpack.chrome.cjs    # Chrome-specific
└── webpack.firefox.cjs   # Firefox-specific
```

### Package.json Scripts
```json
"build:all": "npm run build:chrome && npm run build:firefox",
"build:chrome": "webpack --config webpack/webpack.chrome.cjs",
"build:firefox": "webpack --config webpack/webpack.firefox.cjs",
"build:production": "scripts/build-production-all.sh"
```

## Phase 3: Manifest Handling

### Manifest Structure
```
manifests/
├── manifest.chrome.json   # Chrome Manifest V3
└── manifest.firefox.json  # Firefox Manifest V3
```

### Firefox Manifest V3 Adjustments
- Replace `"background.service_worker"` with `"background.scripts"`
- Add `"browser_specific_settings"` for Firefox ID
- Use `"browser_action"` instead of `"action"` if needed
- Add Firefox-specific permissions

## Phase 4: Code Refactoring

### Update Import Statements
Replace all direct Chrome API usage:
```typescript
// Before
import { chrome } from '@types/chrome';
chrome.storage.sync.get();

// After
import { browserAPI } from '@/lib/browser-api';
browserAPI.storage.sync.get();
```

### Files to Refactor (21 total)
**High Priority (Core Functionality)**:
- `/src/background/index.ts`
- `/src/background/message-handler.ts`
- `/src/shared/message-bus.ts`
- `/src/shared/state-manager.ts`
- `/src/content/index.ts`

**Medium Priority**:
- `/src/popup/popup-modern.tsx`
- `/src/shared/error-handler.ts`
- `/src/content/gif-processor.ts`
- `/src/lib/encoders/gifjs-encoder.ts`

**Lower Priority**:
- Remaining 12 files with Chrome API usage

## Phase 5: Firefox-Specific Adjustments

### Service Worker → Background Script
Firefox uses event pages instead of service workers:
- Convert service worker lifecycle to background script events
- Adjust message passing for Firefox's async/await pattern
- Handle persistent background page differences

### Asset Loading
- `chrome.runtime.getURL()` → `browser.runtime.getURL()`
- Returns `moz-extension://` URLs instead of `chrome-extension://`

### Storage API Differences
- Firefox requires explicit permissions for unlimited storage
- Session storage API has slight behavioral differences

## Phase 6: Testing Strategy

### E2E Test Updates
```
tests/
├── e2e-chrome/        # Chrome-specific tests
├── e2e-firefox/       # Firefox-specific tests
└── e2e-common/        # Shared test scenarios
```

### Playwright Configuration
- Add Firefox browser context
- Create Firefox-specific test config
- Update mock server for Firefox compatibility

## Phase 7: TypeScript Configuration

### Type Definitions
```typescript
// src/types/browser.d.ts
declare global {
  const browserAPI: BrowserAPI;
  interface Window {
    browser?: typeof browser;
    chrome?: typeof chrome;
  }
}
```

### Install Firefox Types
```bash
npm install --save-dev @types/webextension-polyfill
```

## Phase 8: Production Build

### Build Output Structure
```
dist-chrome/          # Chrome extension files
dist-firefox/         # Firefox extension files
dist-production/
├── ytgify-chrome.zip
└── ytgify-firefox.xpi
```

### CI/CD Updates
- Add Firefox build to GitHub Actions
- Create separate release artifacts
- Update documentation for both versions

## Implementation Order

1. **Week 1**: Browser Abstraction Layer
   - Create API wrapper structure
   - Implement Chrome and Firefox adapters
   - Add comprehensive type definitions

2. **Week 1-2**: Build System
   - Split webpack configurations
   - Create dual manifest files
   - Update build scripts

3. **Week 2-3**: Code Migration
   - Replace Chrome API calls with browserAPI
   - Test each module after migration
   - Fix Firefox-specific issues

4. **Week 3-4**: Testing & Polish
   - Update E2E tests for Firefox
   - Fix edge cases and compatibility issues
   - Performance optimization

5. **Week 4**: Release Preparation
   - Update documentation
   - Create Firefox Add-ons submission
   - Set up automated builds

## Key Benefits

✅ **Maximum Code Sharing**: ~95% shared code between versions
✅ **Type Safety**: Full TypeScript support for both browsers
✅ **Easy Maintenance**: Changes automatically apply to both versions
✅ **Future Proof**: Manifest V3 support for long-term compatibility
✅ **Clean Architecture**: Clear separation of browser-specific code

## Potential Challenges

⚠️ **Service Worker Differences**: Firefox's event page model requires careful handling
⚠️ **API Timing**: Some Firefox APIs have different async behavior
⚠️ **Testing Complexity**: Need to maintain tests for both browsers
⚠️ **User Migration**: Existing Chrome users won't auto-migrate to Firefox

## Success Metrics

- Both extensions pass all E2E tests
- <5% browser-specific code
- Single command builds both versions
- Performance parity between Chrome and Firefox
- Successfully published to Firefox Add-ons store

## Chrome API Usage Analysis

### APIs Currently Used
Based on comprehensive codebase analysis, YTgify uses the following Chrome APIs:

**chrome.runtime**
- `onInstalled`, `onStartup`, `onMessage`, `onSuspend` listeners
- `sendMessage()`, `getManifest()`, `getURL()`, `lastError`
- Used in: 14+ files

**chrome.storage**
- `sync.get()`, `sync.set()`, `sync.clear()`
- `local.get()`, `local.set()`, `local.remove()`, `local.clear()`
- `session.get()`, `session.set()`, `session.remove()`
- `onChanged` listener
- Used in: 15+ files

**chrome.tabs**
- `query()`, `sendMessage()`, `update()`, `create()`
- Used in: 8+ files

**chrome.downloads**
- `download()` for GIF file downloads
- Used in: 2 files

**chrome.commands**
- `onCommand` listener for keyboard shortcuts
- Used in: 1 file

**chrome.management**
- `getSelf()`, `setEnabled()` for error recovery
- Used in: 1 file

### Browser Compatibility Notes
All APIs used have Firefox equivalents in the `browser.*` namespace with minimal behavior differences. The abstraction layer will handle these seamlessly.
