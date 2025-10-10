# YTgify Chrome Extension

A Chrome extension that enables users to create GIFs directly from YouTube videos with an intuitive visual interface integrated into the YouTube player.

https://github.com/user-attachments/assets/6b9e72b6-032a-430d-9e4c-1d637f9aec20

## Features

- **Integrated GIF button** in YouTube's video player control bar
- **Visual segment selection** with draggable start/end markers on the timeline
- **Live preview** of the GIF loop
- **Text overlay tools** with customizable positioning and styling
- **Personal GIF library** stored locally in the browser
- **Export options** including download, clipboard copy, and library storage

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Chrome browser
- Playwright's Chromium (installed automatically with `npm install`)

### Installation

1. Install dependencies:

```bash
npm install
```

2. Build the extension:

```bash
npm run build
```

For development with hot reload:

```bash
npm run dev
```

### Loading the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `dist` folder from this project

## Project Structure

```
├── src/
│   ├── background/     # Background service worker
│   ├── content/        # Content script for YouTube integration
│   ├── popup/          # Extension popup UI
│   ├── components/     # Reusable React components
│   ├── lib/           # Core libraries and utilities
│   ├── hooks/         # React hooks
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── icons/             # Extension icons
├── tests/             # Test files
└── dist/              # Built extension (generated)
```

## Scripts

### Development
- `npm run dev` - Build in development mode with watch
- `npm run build` - Build for production (development manifest with localhost permissions)
- `npm run build:production` - Build Chrome Web Store package (strips localhost permissions)
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Testing
- `npm test` - Run unit tests
- `npm run test:e2e` - Run real E2E tests against actual YouTube
- `npm run test:e2e:headed` - Run real E2E tests with visible browser
- `npm run test:e2e:mock` - Run mock E2E tests with localhost videos (used in CI)
- `npm run test:e2e:mock:headed` - Run mock E2E tests with visible browser
- `npm run validate:pre-push` - Run full validation suite (lint, typecheck, build, unit tests)

## Production Build for Chrome Web Store

To create a production-ready package for Chrome Web Store submission:

```bash
npm run build:production
```

This script:
1. Builds the extension to `dist/`
2. Copies everything to `dist-production/`
3. **Strips localhost permissions** from `manifest.json` (used only for mock E2E testing in CI)
4. Creates a versioned zip file: `ytgify-v{version}-chrome-store-production.zip`

The development build includes `localhost` permissions in `host_permissions`, `content_scripts.matches`, and `web_accessible_resources.matches` to support mock E2E tests that use local test videos. These permissions are automatically removed from the production build to ensure Chrome Web Store compliance.

## Quality Assurance

This project maintains quality through a combination of manual pre-PR validation and automated CI testing.

### Before Submitting a Pull Request

Run the full validation suite locally:

```bash
# Run linting, type checking, build, and unit tests
npm run validate:pre-push

# Run real E2E tests against actual YouTube
npm run test:e2e
```

**Important**: Real E2E tests must pass before PR submission. These tests verify the extension works correctly with actual YouTube videos and player behavior.

### Automated CI Testing

GitHub Actions automatically runs:
- Linting, type checking, and unit tests
- Build verification
- **Mock E2E tests** using localhost test videos

### Why Two Types of E2E Tests?

**Real E2E tests** (`test:e2e`):
- Test against actual YouTube videos and player
- Required before PR submission to ensure real-world functionality
- Cannot run in CI due to YouTube blocking/rate-limiting CI server IPs

**Mock E2E tests** (`test:e2e:mock`):
- Test using locally-served test videos (requires localhost permissions)
- Run automatically in CI to catch regressions
- Use Playwright's bundled Chromium (the only browser supporting extensions in headless mode)

This dual approach ensures both real YouTube integration and fast automated regression detection.

## Technology Stack

- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Component library
- **Webpack** - Module bundler
- **Chrome Extensions Manifest V3** - Extension platform

## License

MIT
