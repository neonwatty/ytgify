#!/usr/bin/env node

/**
 * Development environment setup script
 * Prepares the extension for development and provides helpful information
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const NODE_MODULES = path.join(__dirname, '..', 'node_modules');

async function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function checkDependencies() {
  if (!fs.existsSync(NODE_MODULES)) {
    console.log('📦 Installing dependencies...');
    await execCommand('npm install');
    console.log('✅ Dependencies installed');
  } else {
    console.log('✅ Dependencies already installed');
  }
}

async function buildInitial() {
  console.log('🔨 Creating initial build...');
  await execCommand('npm run build');
  console.log('✅ Initial build complete');
}

function printInstructions() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 SETUP COMPLETE - Development Instructions');
  console.log('='.repeat(60));
  
  console.log('\n🚀 Quick Start Commands:');
  console.log('  npm start          - Start development with hot reload');
  console.log('  npm run dev        - Start webpack in watch mode');
  console.log('  npm run dev:reload - Start file watcher for extension reload');
  console.log('  npm run build      - Create production build');
  console.log('  npm run pack       - Package extension for Chrome Web Store');
  
  console.log('\n🧪 Testing Commands:');
  console.log('  npm test           - Run tests');
  console.log('  npm run test:watch - Run tests in watch mode');
  console.log('  npm run test:coverage - Run tests with coverage');
  
  console.log('\n🔧 Utility Commands:');
  console.log('  npm run lint       - Check code quality');
  console.log('  npm run lint:fix   - Fix linting issues');
  console.log('  npm run typecheck  - Check TypeScript types');
  console.log('  npm run clean      - Clean build directory');
  
  console.log('\n📦 Version Management:');
  console.log('  npm run version:patch - Bump patch version (1.0.0 -> 1.0.1)');
  console.log('  npm run version:minor - Bump minor version (1.0.0 -> 1.1.0)');
  console.log('  npm run version:major - Bump major version (1.0.0 -> 2.0.0)');
  
  console.log('\n🔌 Loading Extension in Chrome:');
  console.log('  1. Open Chrome and navigate to: chrome://extensions/');
  console.log('  2. Enable "Developer mode" (toggle in top right)');
  console.log('  3. Click "Load unpacked"');
  console.log(`  4. Select the dist folder: ${DIST_DIR}`);
  console.log('  5. The extension will appear in your toolbar');
  
  console.log('\n💡 Development Tips:');
  console.log('  • Use "npm start" for the best development experience');
  console.log('  • Install Chrome Extension Reloader for auto-reload');
  console.log('  • Check the Console in extension popup for debugging');
  console.log('  • Use Chrome DevTools for background script debugging');
  console.log('  • Content script logs appear in the webpage console');
  
  console.log('\n📚 Project Structure:');
  console.log('  src/');
  console.log('  ├── background/   - Service worker scripts');
  console.log('  ├── content/      - Content scripts for YouTube pages');
  console.log('  ├── popup/        - Extension popup UI');
  console.log('  ├── components/   - Shared React components');
  console.log('  ├── lib/          - Utility functions');
  console.log('  └── types/        - TypeScript type definitions');
  
  console.log('\n' + '='.repeat(60));
  console.log('Happy coding! 🎉');
  console.log('='.repeat(60) + '\n');
}

async function main() {
  try {
    console.log('🚀 YTgify - Development Setup');
    console.log('='.repeat(60));
    
    // Check and install dependencies
    await checkDependencies();
    
    // Create initial build
    await buildInitial();
    
    // Print helpful instructions
    printInstructions();
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();