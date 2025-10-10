# Test Directory Structure

This directory contains all testing configurations and test files for the YTgify Chrome extension.

## 📁 Directory Structure

```
tests/
├── unit/                 # Jest unit tests (components, utilities, services)
│   ├── components/       # UI component tests
│   │   └── popup.test.tsx
│   ├── background/       # Background worker tests
│   │   └── background.test.ts
│   ├── storage/          # Storage layer tests
│   │   └── storage.test.ts
│   ├── database/         # Database tests
│   │   └── gif-database.test.ts
│   └── __mocks__/       # Shared mock utilities
│       ├── chrome-mocks.ts
│       ├── setup.ts
│       └── styleMock.js
├── e2e/                  # Playwright E2E tests (real YouTube)
│   └── functional-tests.spec.js
├── e2e-mock/             # Playwright mock E2E tests (local mock server)
│   ├── fixtures/
│   │   ├── mock-youtube/ # Mock YouTube page components
│   │   └── videos/       # Test video files (generated)
│   ├── helpers/          # Mock server and utilities
│   ├── wizard-basic.spec.ts # Sample mock tests
│   ├── fixtures.ts       # Mock test fixtures
│   ├── global-setup.ts   # Mock server startup
│   └── global-teardown.ts # Mock server cleanup
├── fixtures/             # Test data and fixtures
│   └── youtube-video-test-matrix.js
├── jest.config.js        # Jest configuration
├── playwright.config.ts  # Playwright config (real YouTube)
└── playwright-mock.config.ts # Playwright config (mock)
```

## 🚀 How to Run Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test
npm run test:unit

# Run with watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test files
npx jest tests/unit/components/popup.test.tsx
```

### End-to-End Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run with browser UI
npm run test:e2e:headed

# Run with debug mode
npm run test:e2e:debug

# Run quick smoke tests in headless mode (default, fast)
npm run test:e2e:fast

# Run quick smoke tests with visible browser (for debugging)
npm run test:e2e:fast:headed

# Run all tests (unit + E2E)
npm run test:all
```

**Note on Headless Mode**: The tests use Playwright's bundled Chromium browser which is the only browser that supports Chrome extensions in headless mode. The `test:e2e:fast` command runs tests in headless mode by default for faster execution. Use `test:e2e:fast:headed` when you need to see the browser for debugging.

### Mock E2E Tests (Playwright - Mock YouTube)

**NEW!** Fast, reliable E2E tests that run against a local mock YouTube server instead of real YouTube.

```bash
# First time setup: Generate test videos
npm run generate:test-videos

# Run all mock E2E tests (recommended for CI)
npm run test:e2e:mock

# Run with browser UI (for development)
npm run test:e2e:mock:headed

# Run with debug mode
npm run test:e2e:mock:debug

# Run with Playwright UI mode
npm run test:e2e:mock:ui

# Run all tests (unit + mock E2E)
npm run test:all:with-mock
```

**Benefits of Mock E2E Tests:**

- ✅ **No external dependencies** - Runs entirely locally
- ✅ **Fast** - No network latency or YouTube rate limiting
- ✅ **Reliable** - No flaky tests from YouTube changes
- ✅ **CI-friendly** - Runs in GitHub Actions without issues
- ✅ **Parallelizable** - Can run multiple tests simultaneously

**When to use each test type:**

- **Mock E2E** (`test:e2e:mock`) - Use for CI, quick validation, and most development
- **Real E2E** (`test:e2e`) - Use for final validation before releases and local testing

### Benchmarks

```bash
# Run encoder benchmarks
npm run test:benchmarks
```

## 📋 Test Types & Organization

### 🔧 Unit Tests (`tests/unit/`)

- **Purpose**: Test individual functions and components in isolation
- **Framework**: Jest + React Testing Library
- **Mocking**: Chrome APIs, browser globals, CSS imports
- **Location**: Fast to run, continuous integration
- **Coverage**: Components, utilities, services, mocks

### 🌐 E2E Tests (`tests/e2e/`)

- **Purpose**: Test complete user workflows in real browser with real YouTube
- **Framework**: Playwright
- **Mocking**: None (tests real extension + real YouTube)
- **Location**: Slower, runs locally or on schedule
- **Coverage**: Full Chrome extension integration with YouTube

### 🎭 Mock E2E Tests (`tests/e2e-mock/`)

- **Purpose**: Test complete user workflows with mock YouTube server
- **Framework**: Playwright + Local HTTP Server
- **Mocking**: YouTube pages & videos (extension is real)
- **Location**: Fast, runs in CI on every PR
- **Coverage**: Full Chrome extension integration without external dependencies
- **Server**: Automatically started during test run via global setup

## 🛠️ Adding New Tests

### Unit Tests

1. Create test file in appropriate `tests/unit/XXX/` subdirectory
2. Use `.test.ts(x)` naming convention
3. Import mock utilities from `../__mocks__/`
4. Add any new shared mocks to `__mocks__` directory

### E2E Tests

1. Create test file in `tests/e2e/` directory
2. Use `.spec.ts` naming convention
3. Extension will be automatically loaded from `dist/` folder
4. Tests run against real YouTube - requires internet connection

### Mock E2E Tests

1. Create test file in `tests/e2e-mock/` directory
2. Use `.spec.ts` naming convention
3. Import fixtures from `./fixtures`
4. Use `getMockVideoUrl()` helper to generate mock video URLs
5. Example:

```typescript
import { test, expect } from './fixtures';
import { getMockVideoUrl } from './helpers/mock-videos';

test('My test', async ({ page, mockServerUrl }) => {
  const videoUrl = getMockVideoUrl('veryShort', mockServerUrl);
  await page.goto(videoUrl);
  // ... rest of test
});
```

6. Available mock videos: `veryShort` (5s), `medium` (10s), `long` (20s), `hd` (15s)
7. Generate test videos: `npm run generate:test-videos` (first time setup)

## 🧪 Mock Utilities

### Chrome API Mocks (`chrome-mocks.ts`)

Shared mocks for Chrome extension APIs:

- Extension manifest and URLs
- Chrome tabs, windows, storage APIs
- Runtime messaging system
- Background worker communications

### Setup Utilities (`setup.ts`)

Global test environment configuration:

- Browser API mocks (localStorage, Blob, Image, etc.)
- Jest DOM matchers and utilities
- React Testing Library setup

### Style Mocks (`styleMock.js`)

Jest mocks for CSS module imports to prevent build errors during testing.

## ✅ Test Best Practices

### File Naming

- Use suffixes: `.test.ts`, `.test.tsx`, `.spec.js`
- Match implementation file names when possible
- Group related tests in describe blocks

### Mock Strategy

```typescript
// Import shared mocks
import { chromeMock } from '../__mocks__/chrome-mocks';

// Mock external dependencies
jest.mock('../../../src/popup/styles-modern.css', () => ({}));

// Use shared mock utilities in tests
// No need to recreate common mocks
```

### Test Organization

```typescript
describe('Feature Component', () => {
  beforeEach(() => {
    // Reset mocks for clean state
  });

  describe('User Interactions', () => {
    test('should handle click events', () => { ... });
  });

  describe('API Integration', () => {
    test('should call Chrome API correctly', () => { ... });
  });
});
```

## 📊 Coverage & Reporting

- Coverage reports generated for `src/**/*.{ts,tsx}` files
- Excludes test utilities and type definitions
- HTML coverage reports available after running `npm run test:coverage`

## 🔧 Configuration

### Jest (`jest.config.js`)

- Scans `tests/unit/` for test files
- Uses `tests/unit/__mocks__/setup.ts` for environment setup
- Excludes config files and E2E tests from coverage

### Playwright (`playwright.config.ts`)

- Tests `tests/e2e/` directory (real YouTube)
- Automatic extension loading from `dist/` folder
- Chromium-only for extension testing
- Trace collection on test failure
- Single worker (sequential) to avoid YouTube rate limiting

### Playwright Mock (`playwright-mock.config.ts`)

- Tests `tests/e2e-mock/` directory (mock YouTube)
- Starts local mock server via global setup
- Automatic extension loading from `dist/` folder
- Chromium-only for extension testing
- Multiple workers (parallel) for faster execution
- No external dependencies

This structure provides clear separation between different testing approaches while maintaining shared utilities and configurations for consistency.
