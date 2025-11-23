#!/bin/bash

# Token Refresh Debug Test Runner
# This script helps debug JWT token refresh issues during GIF upload

set -e

echo "🔍 Token Refresh Debug Test Runner"
echo "=================================="
echo ""

# Check if backend is running
echo "📡 Checking if Rails backend is running..."
if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Rails backend is not running on http://localhost:3000"
  echo ""
  echo "Please start the backend first:"
  echo "  cd ../ytgify-share"
  echo "  bin/rails server"
  echo ""
  exit 1
fi
echo "✅ Backend is running"
echo ""

# Check if extension is built
echo "🏗️  Checking if extension is built..."
if [ ! -d "dist" ] || [ ! -f "dist/manifest.json" ]; then
  echo "❌ Extension not built. Building now..."
  npm run build
else
  echo "✅ Extension is built"
fi
echo ""

# Determine mode from first argument
MODE="${1:-headed}"

echo "🚀 Running test in $MODE mode..."
echo ""

case "$MODE" in
  "headed")
    echo "Opening visible browser window (recommended for debugging)"
    npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts
    ;;
  "debug")
    echo "Opening Playwright Inspector (step-through debugging)"
    npm run test:e2e:upload:debug -- tests/e2e-upload/token-refresh-debug.spec.ts
    ;;
  "headless")
    echo "Running in headless mode (no UI)"
    npm run test:e2e:upload -- tests/e2e-upload/token-refresh-debug.spec.ts
    ;;
  "scenario1")
    echo "Running only Scenario 1 (expired token)"
    npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts -g "expired token"
    ;;
  "scenario2")
    echo "Running only Scenario 2 (expiring soon)"
    npm run test:e2e:upload:headed -- tests/e2e-upload/token-refresh-debug.spec.ts -g "expiring soon"
    ;;
  *)
    echo "❌ Unknown mode: $MODE"
    echo ""
    echo "Usage: ./run-token-refresh-debug.sh [mode]"
    echo ""
    echo "Available modes:"
    echo "  headed     - Visible browser (default, recommended)"
    echo "  debug      - Step-through debugging with Playwright Inspector"
    echo "  headless   - No UI (faster but less informative)"
    echo "  scenario1  - Only test expired token scenario"
    echo "  scenario2  - Only test proactive refresh scenario"
    echo ""
    echo "Examples:"
    echo "  ./run-token-refresh-debug.sh"
    echo "  ./run-token-refresh-debug.sh headed"
    echo "  ./run-token-refresh-debug.sh debug"
    echo "  ./run-token-refresh-debug.sh scenario1"
    exit 1
    ;;
esac

echo ""
echo "✅ Test complete!"
echo ""
echo "📊 Check the output above for:"
echo "  - Token expired detected: ✅ or ❌"
echo "  - Token refresh success: ✅ or ❌"
echo "  - Upload success: ✅ or ❌"
echo ""
echo "📖 See tests/e2e-upload/README-TOKEN-REFRESH-DEBUG.md for more details"
