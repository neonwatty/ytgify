# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YTgify Chrome Extension - A Chrome extension that creates GIFs from YouTube videos with an integrated visual interface in the YouTube player. The extension uses Manifest V3 and injects UI elements directly into YouTube's video player for seamless GIF creation.

## Essential Commands

### Code Search and Refactoring with ast-grep

ast-grep is a structural search tool that understands TypeScript/JavaScript AST. It's more powerful than text-based search for finding code patterns.

```bash
# Installation (if not already installed)
npm install -g @ast-grep/cli

# Find all React components
ast-grep --pattern 'const $COMP = () => { $$$ }' --lang tsx

# Find all useEffect hooks
ast-grep --pattern 'useEffect(() => { $$$ }, [$$$])' --lang tsx

# Find Chrome API message handlers
ast-grep --pattern 'chrome.runtime.onMessage.addListener($$$)' --lang ts

# Find all interfaces extending a specific type
ast-grep --pattern 'interface $NAME extends $TYPE { $$$ }' --lang ts

# Find React useState declarations
ast-grep --pattern 'const [$STATE, $SETTER] = useState($$$)' --lang tsx

# Find all imports from a specific module
ast-grep --pattern 'import { $$$ } from "@/types"' --lang ts

# Replace pattern example: Update all console.log to use a logger
ast-grep --pattern 'console.log($ARG)' --rewrite 'logger.debug($ARG)' --lang ts

# Find all event handlers in React components
ast-grep --pattern 'on$EVENT={$HANDLER}' --lang tsx

# Find all Chrome storage API calls
ast-grep --pattern 'chrome.storage.$METHOD.$ACTION($$$)' --lang ts
```

For more complex patterns and rules, see [ast-grep documentation](https://ast-grep.github.io/reference/cli.html).

### Development

```bash
npm run dev              # Start webpack in watch mode for development
npm run build            # Build production-ready extension in dist/
npm run clean            # Remove dist directory
```

### Code Quality

```bash
npm run lint             # Run ESLint on src/**/*.{ts,tsx}
npm run typecheck        # Run TypeScript type checking (tsc --noEmit)
```

### Testing

```bash
npm test                 # Run all tests
npm test:watch           # Run tests in watch mode
npm test -- path/to/test # Run a specific test file
npm run validate:pre-push # Run full validation pipeline (same as Git hooks)
```

### Quality Validation

**Important Context**: This project uses mandatory Git hooks instead of GitHub Actions for E2E testing because:

- Chrome extensions interacting with YouTube videos cannot be reliably tested in CI environments
- YouTube blocks/rate-limits GitHub Actions IPs
- Video playback requires real browser environments with proper codecs
- Extension loading in headless Chrome has limitations

All commits and pushes automatically run the full validation suite locally where tests can properly interact with YouTube.

### Loading Extension in Chrome

1. Build the extension: `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Architecture

### Chrome Extension Components

The extension follows Chrome's Manifest V3 architecture with three main entry points:

1. **Background Service Worker** (`src/background/index.ts`)
   - Handles persistent extension logic
   - Manages message passing between components
   - Processes frame extraction and GIF encoding requests
   - Runs as ES module service worker

2. **Content Script** (`src/content/index.ts`)
   - Injects into YouTube pages matching `https://*.youtube.com/*`
   - Inserts GIF button into YouTube player controls
   - Manages timeline overlay for segment selection
   - Communicates with background worker for processing

3. **Popup Interface** (`src/popup/index.tsx`)
   - React-based UI shown when extension icon clicked
   - Provides access to GIF library and settings
   - Tab-based interface (Create/Library views)

### Message Flow Architecture

```
YouTube Page → Content Script → Background Worker → Processing
                     ↓                    ↓
              Timeline Overlay      GIF Encoding
                     ↓                    ↓
               Editor Panel         Storage/Export
```

### Key Data Structures

All GIF-related types are defined in `src/types/index.ts`:

- `GifData`: Complete GIF with blob data and metadata
- `GifSettings`: User-configurable encoding parameters
- `TimelineSelection`: Video segment selection data
- `TextOverlay`: Text overlay configuration

### Build Configuration

The project uses Webpack with multiple entry points configured in `webpack.config.js`:

- Separate bundles for background, content, and popup
- CSS extraction with PostCSS/Tailwind processing
- Automatic manifest and icon copying
- Path aliases (`@/components`, `@/lib`, etc.) for clean imports

### Storage Strategy

- **IndexedDB**: For GIF library storage (blob data + metadata)
- **Chrome Storage API**: For user preferences and settings
- **Temporary Canvas**: For frame manipulation during processing

## Critical Implementation Details

### YouTube Player Integration

The content script uses MutationObserver to detect YouTube's dynamic player loading and injects the GIF button into `.ytp-right-controls`. The button must be styled to match YouTube's native controls.

### Cross-Component Communication

All communication between content script and background worker uses Chrome's message passing API with typed message objects. Frame extraction and GIF encoding are handled asynchronously in the background worker.

### Webpack Path Resolution

The project uses TypeScript path aliases that must match between `tsconfig.json` and `webpack.config.js`. The tsconfig must NOT have `noEmit: true` for webpack builds to work.

### React Component Library

The extension uses Radix UI components (via shadcn/ui pattern) with Tailwind CSS. Components should follow the shadcn pattern of composition with class variance authority for styling variants.

## Product Requirements Context

The extension implements a GIF creation workflow integrated directly into YouTube's player:

1. User clicks GIF button in player controls
2. Timeline overlay appears for segment selection
3. Editor panel opens with live preview
4. User adjusts settings (frame rate, resolution, text overlays)
5. GIF is encoded and saved to library or downloaded

The GIF library provides persistent local storage with search, filtering, and re-editing capabilities.
