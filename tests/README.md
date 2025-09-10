# Test Directory Structure

This directory contains all testing configurations and test files for the YouTube GIF Maker Chrome extension.

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
├── e2e/                  # Playwright E2E tests
│   └── functional-tests.spec.js
├── fixtures/             # Test data and fixtures
│   └── youtube-video-test-matrix.js
├── jest.config.js        # Jest configuration
└── playwright.e2e.config.js # Playwright E2E configuration
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

# Run all tests (unit + E2E)
npm run test:all
```

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
- **Purpose**: Test complete user workflows in real browser
- **Framework**: Playwright
- **Mocking**: None (tests real extension)
- **Location**: Slower, distinct pipeline
- **Coverage**: Full Chrome extension integration

## 🛠️ Adding New Tests

### Unit Tests
1. Create test file in appropriate `tests/unit/XXX/` subdirectory
2. Use `.test.ts(x)` naming convention
3. Import mock utilities from `../__mocks__/`
4. Add any new shared mocks to `__mocks__` directory

### E2E Tests
1. Create test file in `tests/e2e/` directory
2. Use `.spec.js` naming convention
3. Extension will be automatically loaded from `dist/` folder

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

### Playwright (`playwright.e2e.config.js`)
- Tests `tests/e2e/` directory
- Automatic extension loading from `dist/` folder
- Chromium-only for extension testing
- Trace collection on test failure

This structure provides clear separation between different testing approaches while maintaining shared utilities and configurations for consistency.