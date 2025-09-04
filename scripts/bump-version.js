#!/usr/bin/env node

/**
 * Version bump utility for Chrome extension
 * Updates version in both package.json and manifest.json
 */

const fs = require('fs');
const path = require('path');

const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const MANIFEST_JSON = path.join(__dirname, '..', 'manifest.json');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
      parts[2]++;
      break;
    default:
      throw new Error(`Invalid version bump type: ${type}`);
  }
  
  return parts.join('.');
}

function main() {
  const args = process.argv.slice(2);
  const type = args[0] || 'patch';
  
  if (!['major', 'minor', 'patch'].includes(type)) {
    console.error('❌ Invalid version type. Use: major, minor, or patch');
    process.exit(1);
  }

  try {
    console.log('📦 Version Bump Utility');
    console.log('='.repeat(50));

    // Read current versions
    const packageData = readJSON(PACKAGE_JSON);
    const manifestData = readJSON(MANIFEST_JSON);
    
    const currentVersion = packageData.version;
    const newVersion = bumpVersion(currentVersion, type);
    
    console.log(`Current version: ${currentVersion}`);
    console.log(`New version: ${newVersion} (${type} bump)`);
    
    // Update versions
    packageData.version = newVersion;
    manifestData.version = newVersion;
    
    // Write updated files
    writeJSON(PACKAGE_JSON, packageData);
    writeJSON(MANIFEST_JSON, manifestData);
    
    console.log('\n✅ Version updated successfully!');
    console.log('📝 Updated files:');
    console.log('  - package.json');
    console.log('  - manifest.json');
    console.log('\n💡 Next steps:');
    console.log('  1. Commit the version changes');
    console.log('  2. Create a git tag: git tag v' + newVersion);
    console.log('  3. Build and pack the extension: npm run pack');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();