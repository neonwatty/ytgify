# Comprehensive Dead Code Removal Plan

## Summary
The app currently only uses a simple popup launcher and content script wizard. All storage functionality is dead code - GIFs are "saved" but never retrieved or displayed anywhere.

## 1. ENTIRE DIRECTORIES TO DELETE

### `/src/storage/` (7 files - ALL UNUSED)
- `database.ts` - IndexedDB GifDatabase implementation
- `index.ts` - StorageManager wrapper
- `chrome-storage.ts` - Chrome storage preferences
- `quota-manager.ts` - Storage quota monitoring
- `settings-cache.ts` - Editor state caching
- `blob-manager.ts` - Blob storage management
- `gif-store.ts` - GIF store management

### `/src/library/` (8 files - ALL UNUSED)
- `bulk-operations.ts` - Bulk GIF operations
- `filter-controls.tsx` - Filter UI components
- `gif-card.tsx` - GIF card display
- `gif-editor.ts` - GIF editing functionality
- `grid-view.tsx` - Grid view component
- `management-tools.tsx` - Storage management tools
- `search-engine.ts` - GIF search functionality
- `storage-monitor.tsx` - Storage monitoring UI

## 2. INDIVIDUAL FILES TO DELETE

### Unused Popup Components
- `/src/popup/popup.tsx` - Old popup with tabs (NOT USED)
- `/src/popup/popup-simple.tsx` - Simple popup variant (NOT USED)
- `/src/popup/components/library-view.tsx` - Library view (NOT CONNECTED)
- `/src/popup/components/settings-view.tsx` - Settings view (NOT CONNECTED)

### Storage-Related Files
- `/src/lib/storage.ts` - Alternative IndexedDB implementation (UNUSED)
- `/src/lib/chrome-gif-storage.ts` - Chrome storage wrapper (FUNCTIONALLY USELESS - saves but never retrieves)

### Test Files for Dead Code
- `/tests/unit/database/gif-database.test.ts` - Tests unused GifDatabase
- `/tests/unit/storage/storage.test.ts` - Tests basic chrome.storage (may keep if you want chrome.storage tests)

### Type Definition Files (if no longer needed)
- `/src/types/storage.ts` - Storage-related types (check if still needed after cleanup)

## 3. FILES TO UPDATE

### `/src/content/index.ts`
- Remove import of `chromeGifStorage` (line 22)
- Remove the saveGif calls (lines 1530-1548 and 1551-1567)
- Clean up the GIF creation complete handler since saving is pointless

### `/src/shared/` files (if they depend on storage)
- `state-manager.ts` - Check and remove storage dependencies
- `preferences.ts` - Check and remove storage dependencies
- `messages.ts` - Check and remove storage dependencies

### `/tests/unit/components/popup.test.tsx`
- Keep this - it tests the ACTIVE popup-modern.tsx

### `/manifest.json`
- Review and potentially simplify permissions:
  - Keep "storage" ONLY if needed for button visibility setting (chrome.storage.sync)
  - Remove if button visibility can be handled differently
  - Current permissions: storage, tabs, activeTab, scripting, clipboardWrite, downloads

## 4. BUILD & CONFIG CLEANUP

### Webpack Configuration
- Check `webpack.config.js` for any references to deleted paths
- Remove any aliases pointing to `/src/storage` or `/src/library`
- Clean up entry points if any reference deleted files

### TypeScript Configuration
- Update `tsconfig.json` path mappings if they reference deleted directories
- Remove paths like `"@/storage/*"` or `"@/library/*"`

### Package.json
- Review if any scripts reference deleted directories
- Check if any dependencies were only used by the deleted code and can be removed

## 5. TYPE SYSTEM CLEANUP

### Review and simplify types in `/src/types/`
- If `storage.ts` is only used by deleted code, remove it entirely
- Check `index.ts` for any exports related to storage that can be removed
- Simplify message types if they include unused storage-related messages

## 6. IMPACT SUMMARY

**Lines of Code to Remove**: ~15,000+ lines
**Files to Delete**: 25+ files
**Directories to Delete**: 2 complete directories
**Potential Config Updates**: 3-4 files

**What Remains**:
- Simple popup launcher (`popup-modern.tsx`) - just toggle button visibility
- Content script wizard for GIF creation
- Background worker for processing
- GIFs are created and downloaded directly, no storage

## 7. POST-CLEANUP VERIFICATION

After removal, verify:
1. Extension still builds successfully (`npm run build`)
2. Type checking passes (`npm run typecheck`)
3. Remaining tests pass (`npm test`)
4. Extension loads in Chrome without errors
5. GIF creation workflow still works (create & download)
6. Button visibility toggle still works

This removal will significantly simplify the codebase, eliminate all unused storage infrastructure, and make the extension's actual functionality much clearer.