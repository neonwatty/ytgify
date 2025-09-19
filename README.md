# YouTube GIF Maker Chrome Extension

A Chrome extension that enables users to create GIFs directly from YouTube videos with an intuitive visual interface integrated into the YouTube player.

https://github.com/user-attachments/assets/dea017db-ec8d-41f7-9e9c-a1048cf5ae4c

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

- `npm run dev` - Build in development mode with watch
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run validate:pre-push` - Run full validation suite (same as Git hooks)

## Quality Assurance

This project enforces strict quality standards through automated Git hooks that run **locally** on every commit.

### Why Local Testing?

Testing Chrome extensions that interact with YouTube videos is extremely challenging in CI/CD environments like GitHub Actions due to:

- YouTube blocking/rate-limiting CI server IPs
- Regional content restrictions and cookie consent variations
- Chrome extension loading issues in headless environments
- Video playback requiring real browser environments

Therefore, we use **mandatory pre-commit hooks** to ensure all tests run in a real, local development environment where they can reliably interact with YouTube.

### What Runs Automatically:

- **Every commit** runs: linting, build, type checking, unit tests, and E2E tests
- **No bypassing**: All tests must pass before code enters the repository
- **Expected time**: 3-5 minutes per commit (due to comprehensive E2E testing)
- **Pushing is instant**: No additional validation on push

To manually run the full validation suite:

```bash
npm run validate:pre-push
```

## Technology Stack

- **TypeScript** - Type-safe JavaScript
- **React** - UI framework
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Component library
- **Webpack** - Module bundler
- **Chrome Extensions Manifest V3** - Extension platform

## License

MIT
