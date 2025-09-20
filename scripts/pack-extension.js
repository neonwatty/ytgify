#!/usr/bin/env node

/**
 * Pack extension for Chrome Web Store submission
 * Creates a production build and packages it as a zip file
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const archiver = require('archiver');

const DIST_DIR = path.join(__dirname, '..', 'dist');
const OUTPUT_DIR = path.join(__dirname, '..', 'releases');
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');

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

async function createZip(version) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `ytgify-v${version}-${timestamp}.zip`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`📦 Package created: ${filename} (${sizeMB} MB)`);
      resolve(outputPath);
    });

    archive.on('error', reject);
    
    archive.pipe(output);
    archive.directory(DIST_DIR, false);
    archive.finalize();
  });
}

async function validateBuild() {
  const requiredFiles = [
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.js'
  ];

  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(DIST_DIR, file))
  );

  if (missingFiles.length > 0) {
    throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
  }

  // Validate manifest.json
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  if (manifest.manifest_version !== 3) {
    throw new Error('Extension must use Manifest V3');
  }

  console.log('✅ Build validation passed');
}

async function main() {
  try {
    console.log('🚀 Chrome Extension Packaging Script');
    console.log('='.repeat(50));

    // Get version from package.json
    const packageData = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    const version = packageData.version;
    console.log(`📌 Version: ${version}`);

    // Create releases directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Clean and build
    console.log('\n🧹 Cleaning previous build...');
    await execCommand('npm run clean');

    console.log('🔨 Building extension...');
    await execCommand('npm run build');

    // Validate build
    console.log('\n🔍 Validating build...');
    await validateBuild();

    // Create zip package
    console.log('\n📦 Creating package...');
    const packagePath = await createZip(version);

    console.log('\n✅ Extension packaged successfully!');
    console.log(`📍 Location: ${packagePath}`);
    console.log('\n📋 Next steps:');
    console.log('1. Test the extension by loading the dist/ folder in Chrome');
    console.log('2. Upload the zip file to Chrome Web Store Developer Dashboard');
    console.log('3. Fill in the store listing details');
    console.log('4. Submit for review');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Check if archiver is installed
try {
  require.resolve('archiver');
  main();
} catch (e) {
  console.log('📦 Installing required dependency: archiver');
  exec('npm install --save-dev archiver', (error) => {
    if (error) {
      console.error('Failed to install archiver:', error);
      process.exit(1);
    }
    main();
  });
}