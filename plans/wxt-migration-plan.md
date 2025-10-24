# WXT Migration Plan for YTgify

## Executive Summary

Migration of YTgify Chrome extension to WXT framework is **FEASIBLE** and recommended. This will enable cross-browser support (Chrome, Firefox, Edge), improve development experience with faster builds, and reduce bundle size by ~30-40%.

**Last Updated: 2025-01-24** - Updated with comprehensive WXT documentation analysis

## Migration Benefits

### Immediate Gains
- **Cross-browser support**: Single codebase for Chrome, Firefox, Edge, and Chromium-based browsers
- **Faster development**: Vite-based HMR vs current 7+ second Webpack rebuilds
- **Smaller bundle size**: Expected ~30-40% reduction (similar to documented 700KB→400KB cases)
- **Modern tooling**: Vite ecosystem with better tree-shaking and optimization
- **Simplified configuration**: No more complex Webpack configs

### Long-term Advantages
- **Maintainability**: File-based entrypoints with automatic manifest generation
- **Safari pathway**: Better foundation for Safari conversion (though still manual)
- **Module system**: Ability to share code across multiple extensions
- **Auto-imports**: Nuxt-like development experience

## Technical Assessment

### Compatibility Analysis

#### ✅ Fully Compatible
- React-based UI (popup and content overlays)
- TypeScript throughout
- Separate background/content script architecture
- Modern build tooling
- Message passing patterns
- Storage APIs (IndexedDB, chrome.storage)

#### ⚠️ Requires Adaptation
- **Content Script UI**: Must use WXT's `createShadowRootUi` for React overlays
- **CSS Injection**: Switch from dynamic loading to WXT's `cssInjectionMode: 'ui'`
- **SPA Navigation**: Replace custom detector with WXT's `wxt:locationchange` event
- **Web Worker**: Configure as web_accessible_resource in manifest
- **Directory Structure**: Use WXT's entrypoint patterns (no src/ prefix)
- **Popup HTML**: Requires HTML wrapper file for React mounting
- **Production builds**: Use manifest function for environment-based permissions

#### ❌ Limitations
- **Entrypoint Depth**: Can only be 0 or 1 level deep
- **Browser APIs**: Cannot use outside main() function in entrypoints
- Safari support still requires manual conversion with Apple tools
- Some Safari API incompatibilities (webRequest API)

## Detailed Migration Plan

### Phase 1: Setup & Core Migration (Day 1)

#### 1.1 Initialize WXT Project
```bash
git checkout -b feature/wxt-migration
npm install -D wxt
npx wxt init --template react-ts
```

#### 1.2 Create Configuration
Create `wxt.config.ts`:
```typescript
import { defineConfig } from 'wxt';

export default defineConfig({
  // No srcDir - entrypoints at root level
  manifest: ({ mode, browser }) => ({
    name: 'YTgify',
    version: '1.0.8',
    description: 'Turn your favorite YouTube moments into shareable GIFs.',
    permissions: ['storage', 'tabs', 'activeTab', 'downloads'],
    // Environment-based host permissions
    host_permissions: mode === 'development'
      ? ['https://*.youtube.com/*', 'http://localhost:*/*', 'http://127.0.0.1:*/*']
      : ['https://*.youtube.com/*'],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+G',
          mac: 'Command+Shift+G'
        },
        description: 'Open GIF creation wizard'
      }
    },
    // Web accessible resources for worker and assets
    web_accessible_resources: [{
      matches: ['*://*.youtube.com/*'],
      resources: ['gif.worker.js', '*.css', '*.wasm']
    }],
    // Browser-specific adjustments
    ...(browser === 'firefox' ? {
      // Firefox-specific entries if needed
    } : {})
  }),
  runner: {
    startUrls: ['https://youtube.com']
  }
});
```

#### 1.3 Directory Structure Migration
```
ytgify/
├── entrypoints/          # At root, NOT in src/
│   ├── background.ts
│   ├── content/          # Multi-file content script
│   │   ├── index.ts      # Main content script
│   │   └── style.css     # Imported in index.ts
│   └── popup/
│       ├── index.html    # Required HTML wrapper
│       ├── main.tsx      # React app entry
│       └── style.css
├── public/               # Static assets (copied as-is)
│   ├── icons/
│   ├── gif.worker.js     # Web worker file
│   └── *.wasm           # WASM files if needed
├── components/           # Shared React components
├── lib/                  # Library code
├── shared/              # Shared utilities
├── assets/              # Processed assets (optional)
└── wxt.config.ts
```

**Important:** WXT requires entrypoints to be at root level or one level deep only.

### Phase 2: Content Script & Overlay System (Day 2-3)

#### 2.1 Content Script Migration
Convert `src/content/index.ts` to use WXT patterns:
```typescript
// entrypoints/content/index.ts
import { defineContentScript } from 'wxt/sandbox';
import ReactDOM from 'react-dom/client';
import { OverlayWizard } from '@/components/overlay-wizard';
import './style.css'; // Import CSS directly

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_end',
  cssInjectionMode: 'ui', // For shadow DOM isolation

  main(ctx) {
    let ui: any = null;

    // Handle SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      const watchPattern = new MatchPattern('*://*.youtube.com/watch*');
      if (watchPattern.includes(newUrl)) {
        mountUI();
      } else {
        unmountUI();
      }
    });

    function mountUI() {
      if (ui) return;

      ui = createShadowRootUi(ctx, {
        name: 'ytgify-overlay',
        position: 'inline',
        anchor: 'body',
        onMount: (container) => {
          const root = ReactDOM.createRoot(container);
          root.render(<OverlayWizard />);
          return root;
        },
        onRemove: (root) => {
          root?.unmount();
        },
      });

      ui.mount();
    }

    function unmountUI() {
      ui?.remove();
      ui = null;
    }

    // Initial mount if on watch page
    if (location.href.includes('/watch')) {
      mountUI();
    }
  }
});
```

#### 2.2 CSS Injection Strategy
- **Remove** all dynamic CSS injection code (`chrome.runtime.getURL`)
- **Import** CSS directly in content script: `import './style.css'`
- **Use** `cssInjectionMode: 'ui'` for shadow DOM isolation
- **Benefit**: CSS automatically scoped to shadow root, no conflicts with YouTube styles

#### 2.3 React Overlay Integration
- Use `createShadowRootUi` for proper isolation
- Handle mounting/unmounting with WXT's context lifecycle
- Replace custom navigation detection with `wxt:locationchange` event
- Ensure proper cleanup using `onRemove` callback

### Phase 3: Build System & Assets (Day 3)

#### 3.1 Asset Migration
- Move icons to `public/icons/` (auto-detected by WXT if named correctly)
- Place `gif.worker.js` in `public/` root
- Copy WASM files to `public/`
- **Remove** all `chrome.runtime.getURL()` calls for CSS
- **Update** worker URL references:
```typescript
// Before: chrome.runtime.getURL('gif.worker.js')
// After: Just reference from public
const workerUrl = '/gif.worker.js';
```

#### 3.2 Build Configuration
- Configure Tailwind CSS with PostCSS in `wxt.config.ts`:
```typescript
export default defineConfig({
  vite: () => ({
    css: {
      postcss: './postcss.config.js'
    }
  })
});
```
- Set up TypeScript path aliases in `tsconfig.json` (extend `.wxt/tsconfig.json`)

#### 3.3 Worker & WASM Configuration
- Ensure web_accessible_resources includes worker and WASM files:
```typescript
web_accessible_resources: [{
  matches: ['*://*.youtube.com/*'],
  resources: ['gif.worker.js', '*.wasm']
}]
```
- Test worker loading in content script context
- Validate gifenc and gifski-wasm functionality

### Phase 4: Storage & APIs (Day 3-4)

#### 4.1 Storage Migration
- **Keep IndexedDB unchanged** (no WXT wrapper needed)
- **Keep chrome.storage as-is** (WXT's storage utilities optional)
- Replace `chrome` with `browser` global for cross-browser compatibility:
```typescript
// Before: chrome.storage.sync.get()
// After: browser.storage.sync.get()
```

#### 4.2 Message Passing
- **Keep existing message passing** (no need for external libraries)
- Update to use `browser` global instead of `chrome`
- Ensure all browser API calls are inside `main()` function:
```typescript
export default defineContentScript({
  main(ctx) {
    // All browser API calls must be here
    browser.runtime.sendMessage(...);
  }
});
```

### Phase 5: Testing & Development (Day 4-5)

#### 5.1 Development Environment
- WXT provides automatic HMR for UI and fast reloads for content/background scripts
- Use `wxt dev` for development with auto-reload
- Test on actual YouTube pages with `runner.startUrls`

#### 5.2 Test Suite Updates
```javascript
// playwright.config.js
const extensionPath = path.join(__dirname, '.output/chrome-mv3');
// Note: Path is .output not dist
```

#### 5.3 Mock Server Adaptation
- Update test fixtures paths to `.output/chrome-mv3`
- Adjust extension loading in Playwright tests
- Keep existing E2E test structure

### Phase 6: Production & Deployment (Day 5)

#### 6.1 Production Build Script
Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "wxt dev",
    "build": "wxt build",
    "build:chrome": "wxt build -b chrome",
    "build:firefox": "wxt build -b firefox",
    "build:edge": "wxt build -b edge",
    "build:production": "wxt build --mode production",
    "zip": "wxt zip",
    "postinstall": "wxt prepare"
  }
}
```

#### 6.2 Permission Management
**No separate config files needed!** Use the manifest function approach:
```typescript
// wxt.config.ts (single file)
export default defineConfig({
  manifest: ({ mode }) => ({
    // Development includes localhost, production doesn't
    host_permissions: mode === 'development'
      ? ['https://*.youtube.com/*', 'http://localhost:*/*']
      : ['https://*.youtube.com/*']
  })
});
```

### Phase 7: Validation & Cleanup (Day 6-7)

#### 7.1 Comprehensive Testing Checklist
- [ ] All existing features functional
- [ ] GIF creation workflow complete
- [ ] Text overlay working in shadow DOM
- [ ] Resolution scaling functional
- [ ] Frame extraction accurate
- [ ] Downloads working
- [ ] Popup UI functional (HTML wrapper working)
- [ ] Keyboard shortcuts working
- [ ] SPA navigation handling (`wxt:locationchange` events)
- [ ] CSS properly isolated in shadow DOM

#### 7.2 Performance Validation
- [ ] Build time < 2 seconds with `wxt build`
- [ ] Bundle size reduced by >25%
- [ ] HMR working for React components
- [ ] Memory usage acceptable
- [ ] No performance regressions

#### 7.3 Cross-Browser Testing
- [ ] Chrome MV3 fully functional (`.output/chrome-mv3`)
- [ ] Firefox version working (`.output/firefox-mv2`)
- [ ] Edge version working (`.output/edge-mv3`)
- [ ] Manifest permissions identical to original
- [ ] Web worker loading correctly across browsers

## Risk Analysis & Mitigation

### High-Risk Areas
1. **Shadow DOM Implementation**
   - Risk: Complex refactor of overlay system for shadow root
   - Mitigation: Test CSS isolation thoroughly, use WXT examples as reference
   - Documentation: [Shadow DOM Guide](https://wxt.dev/guide/essentials/content-scripts.html#content-script-ui)

2. **Worker & WASM Loading**
   - Risk: Web accessible resources configuration issues
   - Mitigation: Test worker URL resolution early, verify WASM loading
   - Solution: Proper `web_accessible_resources` configuration

3. **SPA Navigation Changes**
   - Risk: Custom YouTube detector replacement might miss edge cases
   - Mitigation: Parallel testing of both systems before full switch
   - Documentation: [SPA Support](https://wxt.dev/guide/essentials/content-scripts.html#single-page-applications)

### Medium-Risk Areas
1. **Bundle Size**
   - Risk: May not achieve expected reduction
   - Mitigation: Profile bundles, optimize imports

2. **Firefox Compatibility**
   - Risk: Some APIs may differ
   - Mitigation: Use browser polyfill, test early

### Low-Risk Areas
1. **React Components**
   - Well-isolated, should migrate smoothly

2. **Storage APIs**
   - Standard APIs, minimal changes expected

## Success Metrics

### Required (Migration Blockers)
- ✅ All existing features working
- ✅ Chrome Web Store compliance maintained
- ✅ No data loss for existing users
- ✅ All tests passing

### Target Goals
- ✅ Build time < 2 seconds
- ✅ Bundle size reduction > 25%
- ✅ Firefox version functional
- ✅ Development experience improved

### Stretch Goals
- ✅ Edge version published
- ✅ Safari conversion documented
- ✅ Module extraction for reuse

## Implementation Timeline

| Phase | Duration | Start | End | Notes |
|-------|----------|-------|-----|-------|
| Phase 1: Setup | 1 day | Day 1 | Day 1 | Core WXT setup |
| Phase 2: Content Scripts | **2 days** | Day 2 | Day 3 | **+1 day for shadow DOM complexity** |
| Phase 3: Build System | 0.5 days | Day 3 | Day 3 | Can parallel with Phase 2 |
| Phase 4: Storage/APIs | 0.5 days | Day 3 | Day 4 | Minimal changes needed |
| Phase 5: Testing | 1 day | Day 4 | Day 5 | Update paths and configs |
| Phase 6: Production | 1 day | Day 5 | Day 5 | Build scripts and validation |
| Phase 7: Validation | 2 days | Day 6 | Day 7 | Thorough cross-browser testing |

**Total: ~7-8 working days** (Added 1 day for shadow DOM implementation complexity)

## Post-Migration Tasks

1. **Documentation Updates**
   - Update README.md with new build instructions
   - Revise CLAUDE.md for WXT patterns
   - Create MIGRATION.md with lessons learned

2. **CI/CD Updates**
   - Update GitHub Actions workflows
   - Add multi-browser build matrix
   - Configure automated testing

3. **User Communication**
   - Prepare changelog
   - Test update process
   - Monitor for issues

## Rollback Plan

If critical issues arise:
1. Maintain current Webpack setup on `main` branch
2. Feature flag WXT builds initially
3. Gradual rollout to subset of users
4. Full rollback procedure documented

## Key WXT Concepts & Patterns

### Critical Implementation Notes
1. **Shadow DOM is Essential**: Use `createShadowRootUi` for React overlays to avoid CSS conflicts
2. **No Dynamic CSS Loading**: Import CSS directly in entrypoints
3. **Browser API Restrictions**: All `browser`/`chrome` API calls must be inside `main()` function
4. **Entrypoint Depth Limit**: Maximum one level deep (e.g., `entrypoints/content/index.ts`)
5. **HTML Required for Popup**: Cannot use JSX directly, need HTML wrapper

### Common Pitfalls to Avoid
- ❌ Don't put entrypoints in `src/` directory
- ❌ Don't use separate config files for dev/prod
- ❌ Don't manually inject CSS with `chrome.runtime.getURL`
- ❌ Don't use browser APIs outside `main()` function
- ❌ Don't forget web_accessible_resources for workers

## Documentation Resources

### Essential WXT Documentation
- [Getting Started Guide](https://wxt.dev/guide/)
- [Migration Guide](https://wxt.dev/guide/resources/migrate.html)
- [Content Scripts](https://wxt.dev/guide/essentials/content-scripts.html)
- [Project Structure](https://wxt.dev/guide/essentials/project-structure.html)
- [Manifest Configuration](https://wxt.dev/guide/essentials/config/manifest)
- [E2E Testing](https://wxt.dev/guide/essentials/e2e-testing)
- [API Reference](https://wxt.dev/api/reference/)

### Specific Feature Documentation
- [Shadow DOM UI Creation](https://wxt.dev/guide/essentials/content-scripts.html#content-script-ui)
- [SPA Navigation Support](https://wxt.dev/guide/essentials/content-scripts.html#single-page-applications)
- [Web Accessible Resources](https://wxt.dev/guide/essentials/config/manifest#web-accessible-resources)
- [Environment-Based Config](https://wxt.dev/guide/essentials/config/manifest#global-configuration)

## Conclusion

The migration to WXT is technically feasible and strategically beneficial for YTgify. The primary advantages of cross-browser support, improved development experience, and reduced bundle size outweigh the migration effort. The well-structured codebase and comprehensive test suite minimize migration risks.

### Key Success Factors
- **Shadow DOM Implementation**: Properly isolates overlay from YouTube styles
- **WXT Navigation Events**: Simplifies SPA handling vs custom detection
- **Environment-Based Config**: Single config file with conditional logic
- **Direct CSS Imports**: Cleaner than dynamic injection

### Recommendation
**Proceed with migration** following this updated phased approach. The shadow DOM implementation adds complexity but provides better isolation and maintainability.

---

*Last Updated: 2025-01-24*
*Author: Claude (with comprehensive WXT documentation analysis)*
*Status: Planning Phase - Ready for Implementation*