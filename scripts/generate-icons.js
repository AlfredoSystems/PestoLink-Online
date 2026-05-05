// Generates all platform icons from assets/icon.png.
// Outputs:
//   public/favicon.ico  – web favicon (also used by Electron BrowserWindow via dist/)
//   build/icon.ico      – electron-builder Windows installer icon
//   build/icon.png      – electron-builder macOS (converted to .icns by iconutil on macOS CI)
//
// Run automatically via the prebuild / predev npm hooks.
// For Android / iOS icons run: npm run cap:icons

const sharp = require('sharp');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { resolve } = require('path');

const src = resolve(__dirname, '../assets/icon.png');

if (!existsSync(src)) {
    console.error('Error: assets/icon.png not found. Place a 1024x1024 PNG there first.');
    process.exit(1);
}

// Packs an array of PNG buffers into a single multi-size .ico file.
// Modern Windows fully supports PNG-compressed ICO entries.
function packIco(pngBuffers, sizes) {
    const count = pngBuffers.length;
    const dataStart = 6 + count * 16;
    const total = dataStart + pngBuffers.reduce((s, b) => s + b.length, 0);
    const buf = Buffer.alloc(total);

    buf.writeUInt16LE(0, 0); // reserved
    buf.writeUInt16LE(1, 2); // type: ICO
    buf.writeUInt16LE(count, 4);

    let dataOff = dataStart;
    pngBuffers.forEach((png, i) => {
        const s = sizes[i];
        const e = 6 + i * 16;
        buf.writeUInt8(s >= 256 ? 0 : s, e);     // width  (0 encodes 256)
        buf.writeUInt8(s >= 256 ? 0 : s, e + 1); // height
        buf.writeUInt8(0, e + 2);                 // colour count
        buf.writeUInt8(0, e + 3);                 // reserved
        buf.writeUInt16LE(1, e + 4);              // planes
        buf.writeUInt16LE(32, e + 6);             // bits per pixel
        buf.writeUInt32LE(png.length, e + 8);     // data size
        buf.writeUInt32LE(dataOff, e + 12);       // data offset
        png.copy(buf, dataOff);
        dataOff += png.length;
    });

    return buf;
}

async function main() {
    const icoSizes = [16, 32, 48, 256];
    const pngs = await Promise.all(
        icoSizes.map(s => sharp(src).resize(s, s).png().toBuffer())
    );
    const ico = packIco(pngs, icoSizes);

    // Web favicon — Vite copies public/ → dist/ so dist/favicon.ico is always in sync.
    mkdirSync(resolve(__dirname, '../public'), { recursive: true });
    writeFileSync(resolve(__dirname, '../public/favicon.ico'), ico);

    // Electron-builder build resources
    mkdirSync(resolve(__dirname, '../build'), { recursive: true });
    writeFileSync(resolve(__dirname, '../build/icon.ico'), ico);
    await sharp(src).resize(1024, 1024).png().toFile(resolve(__dirname, '../build/icon.png'));

    console.log('Icons generated from assets/icon.png');
}

main().catch(err => { console.error(err); process.exit(1); });
