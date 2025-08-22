#!/usr/bin/env node

/**
 * Generate LAMA app icon
 * Creates a colorful LAMA text logo as PNG
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create 1024x1024 canvas for high quality
const canvas = createCanvas(1024, 1024);
const ctx = canvas.getContext('2d');

// Background - dark with slight gradient
const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
gradient.addColorStop(0, '#1a1a1a');
gradient.addColorStop(1, '#0a0a0a');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 1024, 1024);

// Add subtle circle background
ctx.beginPath();
ctx.arc(512, 512, 450, 0, Math.PI * 2);
ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
ctx.fill();

// Configure text
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = 'bold 280px -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

// LAMA letters with colors
const letters = [
  { char: 'L', color: '#ef4444' }, // Red
  { char: 'A', color: '#eab308' }, // Yellow
  { char: 'M', color: '#22c55e' }, // Green
  { char: 'A', color: '#a855f7' }  // Purple
];

// Calculate total width for centering
const letterSpacing = 200;
const totalWidth = letterSpacing * (letters.length - 1);
const startX = 512 - totalWidth / 2;

// Draw each letter with slight shadow
letters.forEach((letter, index) => {
  const x = startX + index * letterSpacing;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillText(letter.char, x + 4, 516);
  
  // Letter
  ctx.fillStyle = letter.color;
  ctx.fillText(letter.char, x, 512);
});

// Add subtle border
ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
ctx.lineWidth = 8;
ctx.beginPath();
ctx.arc(512, 512, 500, 0, Math.PI * 2);
ctx.stroke();

// Save as PNG
const outputDir = path.join(__dirname, 'icons');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Save main icon
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(outputDir, 'icon.png'), buffer);

// Create different sizes
const sizes = [16, 32, 64, 128, 256, 512];
sizes.forEach(size => {
  const sizedCanvas = createCanvas(size, size);
  const sizedCtx = sizedCanvas.getContext('2d');
  
  // Draw scaled version
  sizedCtx.drawImage(canvas, 0, 0, size, size);
  
  const sizedBuffer = sizedCanvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, `icon-${size}.png`), sizedBuffer);
});

console.log('Icons generated successfully in', outputDir);