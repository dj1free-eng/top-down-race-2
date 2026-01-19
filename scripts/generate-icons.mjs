import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const outDir = path.resolve(process.cwd(), 'public/icons');
fs.mkdirSync(outDir, { recursive: true });

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="1" stop-color="#141b33"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="${Math.round(size * 0.18)}" fill="url(#g)"/>
  <circle cx="${Math.round(size * 0.72)}" cy="${Math.round(size * 0.28)}" r="${Math.round(size * 0.10)}" fill="#2bff88" opacity="0.85"/>
  <text x="50%" y="54%" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="${Math.round(size * 0.26)}"
        fill="#ffffff" font-weight="800">TDR2</text>
  <text x="50%" y="70%" text-anchor="middle"
        font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial"
        font-size="${Math.round(size * 0.08)}"
        fill="#b7c0ff" opacity="0.95" font-weight="600">Top-Down Racing</text>
</svg>`.trim();

const sizes = [192, 256, 384, 512];

for (const s of sizes) {
  const pngPath = path.join(outDir, `icon-${s}.png`);
  const input = Buffer.from(svg(s));
  await sharp(input).png().toFile(pngPath);
  console.log(`OK ${pngPath}`);
}
