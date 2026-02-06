#!/usr/bin/env node
/**
 * WebSuddhi Icon Converter
 * Converts SVG source files to PNG at various sizes
 *
 * Usage:
 *   npm install sharp
 *   node convert-icons.js
 *
 * Or using npx:
 *   npx sharp-cli --input icon-source.svg --output icon128.png resize 128 128
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('Sharp module not found. Installing...');
    console.log('Run: npm install sharp');
    console.log('Then run this script again.');
    console.log('');
    console.log('Alternative: Use the browser-based method below:');
    console.log('');
    printBrowserMethod();
    process.exit(1);
}

const ICONS_DIR = __dirname;
const SIZES = [16, 32, 48, 128, 256];

async function convertIcon(svgFile, outputPrefix, alertSuffix = '') {
    const svgPath = path.join(ICONS_DIR, svgFile);

    if (!fs.existsSync(svgPath)) {
        console.error(`SVG file not found: ${svgPath}`);
        return;
    }

    const svgBuffer = fs.readFileSync(svgPath);

    for (const size of SIZES) {
        const outputPath = path.join(ICONS_DIR, `icon${size}${alertSuffix}.png`);

        try {
            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(outputPath);

            console.log(`Created: icon${size}${alertSuffix}.png`);
        } catch (err) {
            console.error(`Error creating ${outputPath}:`, err.message);
        }
    }
}

async function main() {
    console.log('WebSuddhi Icon Converter');
    console.log('========================');
    console.log('');

    // Convert main icon
    console.log('Converting main icon...');
    await convertIcon('icon-source.svg', 'icon', '');

    // Convert alert icon
    console.log('');
    console.log('Converting alert icon...');
    await convertIcon('icon-source-alert.svg', 'icon', '-alert');

    console.log('');
    console.log('Done! Icons created successfully.');
}

function printBrowserMethod() {
    console.log(`
=== Browser-based SVG to PNG Conversion ===

You can use an online tool or this browser-based method:

1. Open the SVG file in a browser
2. Use this HTML file to convert:

<!DOCTYPE html>
<html>
<head><title>SVG to PNG Converter</title></head>
<body>
  <h1>SVG to PNG Converter</h1>
  <input type="file" id="svgInput" accept=".svg">
  <select id="sizeSelect">
    <option value="16">16x16</option>
    <option value="32">32x32</option>
    <option value="48">48x48</option>
    <option value="128" selected>128x128</option>
    <option value="256">256x256</option>
  </select>
  <button onclick="convert()">Convert</button>
  <br><br>
  <canvas id="canvas" style="border:1px solid #ccc"></canvas>
  <br>
  <a id="download" style="display:none">Download PNG</a>

  <script>
    function convert() {
      const file = document.getElementById('svgInput').files[0];
      const size = parseInt(document.getElementById('sizeSelect').value);
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const download = document.getElementById('download');

      canvas.width = size;
      canvas.height = size;

      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);

          const dataUrl = canvas.toDataURL('image/png');
          download.href = dataUrl;
          download.download = 'icon' + size + '.png';
          download.style.display = 'block';
          download.textContent = 'Download icon' + size + '.png';
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  </script>
</body>
</html>

Or use online tools like:
- https://cloudconvert.com/svg-to-png
- https://svgtopng.com/
- https://convertio.co/svg-png/
`);
}

main().catch(console.error);
