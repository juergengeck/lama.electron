#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const svgPath = path.join(__dirname, 'icon.svg');
const iconsDir = path.join(__dirname, 'icons');

// Create icons directory
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function generateIcons() {
  console.log('Generating icons from SVG...');
  
  // Generate PNG icons of various sizes
  const sizes = [16, 32, 64, 128, 256, 512, 1024];
  
  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsDir, `icon-${size}.png`));
    console.log(`✓ Generated icon-${size}.png`);
  }
  
  // Copy the main 1024 icon as icon.png
  await sharp(svgPath)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(iconsDir, 'icon.png'));
  console.log('✓ Generated icon.png');
  
  // Generate ico file for Windows (contains multiple sizes)
  // Using the 16, 32, 64, 128, 256 sizes
  console.log('Generating Windows .ico file...');
  
  // First create a multi-size ico using ImageMagick if available
  try {
    await execPromise(`which convert`);
    // ImageMagick is available
    const icoSizes = [16, 32, 64, 128, 256];
    const inputFiles = icoSizes.map(size => path.join(iconsDir, `icon-${size}.png`)).join(' ');
    await execPromise(`convert ${inputFiles} ${path.join(iconsDir, 'icon.ico')}`);
    console.log('✓ Generated icon.ico using ImageMagick');
  } catch (e) {
    // ImageMagick not available, create a simple ico from 256px version
    console.log('ImageMagick not found, creating simple .ico from 256px PNG');
    fs.copyFileSync(
      path.join(iconsDir, 'icon-256.png'),
      path.join(iconsDir, 'icon.ico')
    );
    console.log('✓ Created icon.ico (single size)');
  }
  
  // Generate icns file for macOS
  console.log('Generating macOS .icns file...');
  
  // First, create the iconset directory structure
  const iconsetPath = path.join(iconsDir, 'icon.iconset');
  if (!fs.existsSync(iconsetPath)) {
    fs.mkdirSync(iconsetPath, { recursive: true });
  }
  
  // macOS iconset requires specific sizes and naming
  const macSizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' }
  ];
  
  for (const { size, name } of macSizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(iconsetPath, name));
  }
  
  // Use iconutil to create .icns file
  try {
    await execPromise(`iconutil -c icns ${iconsetPath} -o ${path.join(iconsDir, 'icon.icns')}`);
    console.log('✓ Generated icon.icns');
    
    // Clean up iconset directory
    await execPromise(`rm -rf ${iconsetPath}`);
  } catch (e) {
    console.log('⚠ Could not generate .icns file (iconutil not available)');
    console.log('  On macOS, iconutil should be available by default');
  }
  
  console.log('\nIcon generation complete!');
  console.log(`Icons saved to: ${iconsDir}`);
}

generateIcons().catch(console.error);