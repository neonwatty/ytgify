#!/bin/bash

# Script to build extension and run resolution verification tests

set -e

echo "🔨 Building extension..."
npm run build

echo "📁 Creating test output directory..."
mkdir -p tests/outputs/resolution-test

echo "🧪 Running resolution verification tests..."
npx playwright test tests/integration/resolution-verification.spec.ts --headed --workers=1

echo "📊 Test results saved to: tests/outputs/resolution-test/"
echo ""
echo "Generated files:"
ls -la tests/outputs/resolution-test/

echo ""
echo "🎯 Test completed! Check the output directory for generated GIFs."
echo "   You can verify the resolutions manually or use image analysis tools."