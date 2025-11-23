#!/bin/bash

# Start Rails backend for E2E testing
# This script starts the ytgify-share Rails server with proper CORS configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YTGIFY_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$YTGIFY_DIR/../ytgify-share"

echo "🚀 Starting Rails backend for E2E testing..."
echo ""

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
  echo "❌ Error: Backend directory not found at $BACKEND_DIR"
  echo "Expected ytgify-share to be at: $(cd "$YTGIFY_DIR/.." && pwd)/ytgify-share"
  exit 1
fi

# Check if Rails is already running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "✅ Rails server is already running at http://localhost:3000"
  echo ""
  exit 0
fi

echo "📁 Backend directory: $BACKEND_DIR"
echo ""

# Navigate to backend directory
cd "$BACKEND_DIR"

# Check if bundle is installed
if ! command -v bundle &> /dev/null; then
  echo "❌ Error: bundler not found. Please install: gem install bundler"
  exit 1
fi

# Install dependencies if needed
if [ ! -d "vendor/bundle" ] && [ ! -f "Gemfile.lock" ]; then
  echo "📦 Installing dependencies..."
  bundle install
  echo ""
fi

# Ensure database is set up
echo "🗄️  Setting up database..."
bin/rails db:create db:migrate RAILS_ENV=development 2>&1 | grep -v "already exists" || true
echo ""

echo "🔧 Starting Rails server on http://localhost:3000..."
echo "   (CORS will allow requests from chrome-extension://)"
echo ""
echo "💡 Press Ctrl+C to stop the server"
echo ""

# Start Rails server
# Note: CORS is configured in config/initializers/cors.rb to allow extension origins
bin/rails server -p 3000

