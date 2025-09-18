# Running E2E Tests - Headed vs Headless Modes

## Important Note About Chrome Extensions and Headless Mode

Chrome extensions **cannot run in traditional headless mode**. This is a limitation of Chromium/Chrome itself. The extension APIs and functionality require a GUI context to work properly.

## How We Handle "Headless" Testing

Since true headless mode isn't possible with extensions, we provide two modes:

### 1. **Pseudo-Headless Mode (Default)**
When you run tests without any flags, the browser window is positioned off-screen:
```bash
# From /tests directory
npx playwright test e2e/wizard-basic.spec.ts

# From project root
npx playwright test tests/e2e/wizard-basic.spec.ts
```

This mode:
- Opens a real browser window (required for extensions)
- Positions it at coordinates `-2400,-2400` (off-screen)
- Sets window size to `1x1` pixels
- Provides a "headless-like" experience without visual distraction
- Works on all platforms (macOS, Windows, Linux)

### 2. **Headed Mode (Visible Browser)**
To see the browser window during test execution, use the `--headed` flag:
```bash
# From /tests directory
npx playwright test e2e/wizard-basic.spec.ts --headed

# From project root
npx playwright test tests/e2e/wizard-basic.spec.ts --headed
```

This mode:
- Opens a visible browser window at normal position
- Useful for debugging and watching test execution
- Shows exactly what the test is doing

## Running Specific Test Suites

### Resolution Tests
```bash
# Pseudo-headless (default)
npx playwright test e2e/wizard-basic.spec.ts --grep "resolution|Resolution"

# With visible browser
npx playwright test e2e/wizard-basic.spec.ts --grep "resolution|Resolution" --headed
```

### FPS Tests
```bash
# Pseudo-headless (default)
npx playwright test e2e/wizard-basic.spec.ts --grep "fps|FPS"

# With visible browser
npx playwright test e2e/wizard-basic.spec.ts --grep "fps|FPS" --headed
```

### GIF Length Tests
```bash
# Pseudo-headless (default)
npx playwright test e2e/wizard-basic.spec.ts --grep "GIF length"

# With visible browser
npx playwright test e2e/wizard-basic.spec.ts --grep "GIF length" --headed
```

## CI/CD Environments

For CI environments (GitHub Actions, Jenkins, etc.), you have two options:

### Option 1: Use Pseudo-Headless Mode (Recommended)
The default mode works well in most CI environments:
```bash
npx playwright test tests/e2e/wizard-basic.spec.ts
```

### Option 2: Use Xvfb (Virtual Framebuffer) on Linux
For true headless operation on Linux CI runners:
```bash
# Install Xvfb
sudo apt-get install xvfb

# Run tests with virtual display
xvfb-run -a npx playwright test tests/e2e/wizard-basic.spec.ts
```

## Troubleshooting

### Tests fail with "Extension not loaded"
- Ensure the extension is built: `npm run build`
- Check that `dist/manifest.json` exists
- Verify Chrome/Chromium is properly installed

### Browser window appears even without --headed
- Check that you're not setting `PWDEBUG=1` environment variable
- Verify you're using the latest version of this test configuration

### Tests are slow
- Pseudo-headless mode is slightly faster than headed mode
- Consider running tests in parallel (though be careful with extension state)
- Use `--grep` to run only specific test suites

## Technical Details

The limitation exists because:
1. Chrome extensions use APIs that require a rendering context
2. Background pages and service workers need the full browser environment
3. Content scripts need to interact with actual rendered pages
4. The extension manifest and permissions system requires GUI mode

Our solution uses `headless: false` with off-screen positioning to provide the best compromise between automation needs and Chrome's technical requirements.