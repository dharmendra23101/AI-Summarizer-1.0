// This is a Node.js script to generate missing icons
// Save this as create-icons.js and run with Node.js
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function generateIcons() {
  try {
    // Ensure icons directory exists
    const iconsDir = path.join(__dirname, 'icons');
    if (!fs.existsSync(iconsDir)) {
      fs.mkdirSync(iconsDir, { recursive: true });
    }
    
    // Load the source icon
    const sourceIcon = await loadImage(path.join(iconsDir, 'icon128.png'));
    
    // Sizes to generate
    const sizes = [16, 32, 48];
    
    for (const size of sizes) {
      // Create canvas with target size
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // Draw the source icon resized
      ctx.drawImage(sourceIcon, 0, 0, size, size);
      
      // Save as PNG
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buffer);
      
      console.log(`Generated icon${size}.png`);
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();