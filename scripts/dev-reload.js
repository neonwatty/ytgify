#!/usr/bin/env node

/**
 * Development hot reload script for Chrome extension
 * Watches for file changes and triggers extension reload
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const WATCH_DIRS = ['src', 'manifest.json'];
const DIST_DIR = path.join(__dirname, '..', 'dist');
const RELOAD_FILE = path.join(DIST_DIR, 'reload.txt');

let reloadTimeout;

function triggerReload() {
  clearTimeout(reloadTimeout);
  reloadTimeout = setTimeout(() => {
    // Touch reload file to trigger extension reload
    fs.writeFileSync(RELOAD_FILE, Date.now().toString());
    console.log(`🔄 Extension reload triggered at ${new Date().toLocaleTimeString()}`);
  }, 1000);
}

function watchFiles() {
  console.log('👀 Watching for file changes...');
  console.log('📁 Watched directories:', WATCH_DIRS.join(', '));
  
  WATCH_DIRS.forEach(dir => {
    const fullPath = path.join(__dirname, '..', dir);
    
    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        watchDirectory(fullPath);
      } else {
        watchFile(fullPath);
      }
    }
  });
}

function watchDirectory(dirPath) {
  fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('.swp') && !filename.includes('~')) {
      console.log(`📝 ${eventType}: ${filename}`);
      triggerReload();
    }
  });
}

function watchFile(filePath) {
  fs.watchFile(filePath, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      console.log(`📝 Changed: ${path.basename(filePath)}`);
      triggerReload();
    }
  });
}

// Initialize
console.log('🚀 Chrome Extension Development Reload Script');
console.log('='.repeat(50));

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Start watching
watchFiles();

// Handle exit gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Stopping file watcher...');
  process.exit(0);
});

console.log('\n✅ Ready for development!');
console.log('💡 Tip: Install the Extension Reloader extension for automatic reloading');
console.log('    or manually reload the extension when you see reload triggers\n');