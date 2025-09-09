#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to remove (debug/info logs)
const DEBUG_PATTERNS = [
  /console\.(log|debug|info)\([^)]*\);?/g,
  /console\.(log|debug|info)\([^{]*{[^}]*}\);?/g,
  /console\.(log|debug|info)\(`[^`]*`\);?/g,
];

// Patterns to keep (warnings and errors)
const KEEP_PATTERNS = [
  /console\.(error|warn)/,
];

// Files to skip
const SKIP_FILES = [
  'logger.ts',
  'logger.js',
  'setup.ts',
  'test.ts',
  '.test.',
  '.spec.',
  'debug',
];

function shouldSkipFile(filePath) {
  return SKIP_FILES.some(skip => filePath.includes(skip));
}

function removeDebugLogs(filePath) {
  if (shouldSkipFile(filePath)) {
    console.log(`Skipping: ${filePath}`);
    return { removed: 0, kept: 0 };
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let removed = 0;
  let kept = 0;

  // Count console statements that will be kept
  KEEP_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      kept += matches.length;
    }
  });

  // Remove debug console statements
  DEBUG_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      removed += matches.length;
      content = content.replace(pattern, '');
    }
  });

  // Clean up empty lines left behind
  content = content.replace(/^\s*\n\s*\n/gm, '\n');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Processed: ${filePath} (removed: ${removed}, kept: ${kept})`);
  }

  return { removed, kept };
}

function main() {
  const srcFiles = glob.sync('src/**/*.{ts,tsx,js,jsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  let totalRemoved = 0;
  let totalKept = 0;
  let filesModified = 0;

  srcFiles.forEach(file => {
    const { removed, kept } = removeDebugLogs(file);
    totalRemoved += removed;
    totalKept += kept;
    if (removed > 0) {
      filesModified++;
    }
  });

  console.log('\n=== Summary ===');
  console.log(`Files processed: ${srcFiles.length}`);
  console.log(`Files modified: ${filesModified}`);
  console.log(`Debug logs removed: ${totalRemoved}`);
  console.log(`Error/warn logs kept: ${totalKept}`);
  console.log('\nNote: Kept console.error and console.warn for error handling');
  console.log('Skipped logger files and test files');
}

main();