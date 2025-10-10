#!/bin/bash
# Build production-ready Chrome Web Store package
# This script removes localhost permissions used only for mock E2E testing

set -e

echo "🏭 Building Production Extension for Chrome Web Store"
echo "=================================================="
echo ""

# Step 1: Build the extension
echo "📦 Step 1/5: Building extension..."
npm run build
echo "✅ Extension built successfully"
echo ""

# Step 2: Clean and create dist-production directory
echo "🧹 Step 2/5: Preparing production directory..."
rm -rf dist-production
mkdir -p dist-production
echo "✅ Production directory ready"
echo ""

# Step 3: Copy dist to dist-production
echo "📂 Step 3/5: Copying build files..."
cp -r dist/* dist-production/
echo "✅ Files copied to dist-production/"
echo ""

# Step 4: Strip localhost permissions from manifest.json
echo "✂️  Step 4/5: Removing localhost permissions from manifest..."

# Use node to properly manipulate JSON
node -e "
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'dist-production', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Remove localhost from host_permissions
if (manifest.host_permissions) {
  manifest.host_permissions = manifest.host_permissions.filter(
    perm => !perm.includes('localhost') && !perm.includes('127.0.0.1')
  );
}

// Remove localhost from content_scripts matches
if (manifest.content_scripts) {
  manifest.content_scripts = manifest.content_scripts.map(script => ({
    ...script,
    matches: script.matches.filter(
      match => !match.includes('localhost') && !match.includes('127.0.0.1')
    )
  }));
}

// Remove localhost from web_accessible_resources matches
if (manifest.web_accessible_resources) {
  manifest.web_accessible_resources = manifest.web_accessible_resources.map(resource => ({
    ...resource,
    matches: resource.matches.filter(
      match => !match.includes('localhost') && !match.includes('127.0.0.1')
    )
  }));
}

// Write back to file with proper formatting
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('✅ Localhost permissions removed');
"

echo ""

# Step 5: Create zip file
echo "🗜️  Step 5/5: Creating Chrome Web Store package..."
VERSION=$(node -e "console.log(require('./package.json').version)")
ZIP_NAME="ytgify-v${VERSION}-chrome-store-production.zip"

# Remove old zip if it exists
rm -f "$ZIP_NAME"

# Create new zip from dist-production
cd dist-production
zip -r "../$ZIP_NAME" . > /dev/null
cd ..

FILE_SIZE=$(ls -lh "$ZIP_NAME" | awk '{print $5}')
echo "✅ Created: $ZIP_NAME ($FILE_SIZE)"
echo ""

# Summary
echo "=================================================="
echo "🎉 Production Build Complete!"
echo ""
echo "📦 Package: $ZIP_NAME"
echo "📍 Location: $(pwd)/$ZIP_NAME"
echo "📏 Size: $FILE_SIZE"
echo ""
echo "✅ Ready for Chrome Web Store upload!"
echo "   https://chrome.google.com/webstore/devconsole"
echo ""
echo "⚠️  Note: This build excludes localhost permissions"
echo "   (only used for mock E2E testing)"
echo "=================================================="
