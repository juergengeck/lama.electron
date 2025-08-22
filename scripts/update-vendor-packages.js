#!/usr/bin/env node

/**
 * Update vendor packages for ONE.CORE and ONE.Models
 * This script builds and packs the packages from source and copies them to vendor
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const VENDOR_DIR = path.join(PROJECT_ROOT, 'electron-ui', 'vendor');
const TEMP_DIR = path.join(os.tmpdir(), 'one-packages-build-' + Date.now());

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = '') {
  console.log(color + message + colors.reset);
}

function exec(command, cwd = process.cwd()) {
  try {
    return execSync(command, { cwd, stdio: 'pipe' }).toString();
  } catch (error) {
    throw new Error(`Command failed: ${command}\n${error.message}`);
  }
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirectory(src, dest) {
  ensureDirectory(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules and .git directories
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function buildPackage(packageName, sourcePath, outputName) {
  log(`\n📦 Building ${packageName} package...`, colors.blue);
  
  if (!fs.existsSync(sourcePath)) {
    log(`⚠️  ${packageName} source not found at ${sourcePath}`, colors.yellow);
    log(`   Set ${packageName.toUpperCase().replace('.', '_')}_SOURCE environment variable to point to the source directory`, colors.yellow);
    return false;
  }
  
  log(`Found ${packageName} source at: ${sourcePath}`, colors.green);
  
  // Copy source to temp directory
  const tempPackageDir = path.join(TEMP_DIR, packageName);
  log('Copying source files...');
  copyDirectory(sourcePath, tempPackageDir);
  
  // Install dependencies and build
  log('Installing dependencies...');
  exec('npm install --production', tempPackageDir);
  
  // Pack the module
  log(`Packing ${packageName}...`);
  const packOutput = exec('npm pack', tempPackageDir);
  
  // Find the generated .tgz file
  const tgzFiles = fs.readdirSync(tempPackageDir).filter(f => f.endsWith('.tgz'));
  if (tgzFiles.length === 0) {
    throw new Error(`No .tgz file generated for ${packageName}`);
  }
  
  // Move to vendor with consistent naming
  const sourceTgz = path.join(tempPackageDir, tgzFiles[0]);
  const destTgz = path.join(VENDOR_DIR, outputName);
  fs.renameSync(sourceTgz, destTgz);
  
  log(`✅ ${packageName} packed to vendor/${outputName}`, colors.green);
  return true;
}

async function main() {
  log('🚀 Starting vendor package update process...', colors.bright);
  
  // Create vendor directory if it doesn't exist
  ensureDirectory(VENDOR_DIR);
  
  // Clean and create temp directory
  cleanDirectory(TEMP_DIR);
  
  try {
    // Build ONE.CORE
    const oneCoreSource = process.env.ONE_CORE_SOURCE || path.join(PROJECT_ROOT, '..', 'one-core');
    await buildPackage('one.core', oneCoreSource, 'one-core-nodejs.tgz');
    
    // Build ONE.Models
    const oneModelsSource = process.env.ONE_MODELS_SOURCE || path.join(PROJECT_ROOT, '..', 'one-models');
    await buildPackage('one.models', oneModelsSource, 'one-models-nodejs-fixed.tgz');
    
    // Clean up temp directory
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    
    log('\n📋 Vendor packages update process completed!', colors.bright + colors.green);
    log(`   Location: ${VENDOR_DIR}`);
    log('\nTo use different source locations, set these environment variables:');
    log('  ONE_CORE_SOURCE=/path/to/one-core');
    log('  ONE_MODELS_SOURCE=/path/to/one-models');
    log('\nNext steps:');
    log('  1. Run \'npm install\' in electron-ui to install from vendor packages');
    log('  2. Commit the updated .tgz files in vendor/');
    log('  3. The node_modules/@refinio folders will be gitignored');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, colors.red);
    
    // Clean up temp directory on error
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  log(`\n❌ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});