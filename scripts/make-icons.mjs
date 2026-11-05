// Generates the icons, favicon and social share image from one shared drawing
// (design/art.fragment.svg). Run with: npm run icons
// The outputs in public/ are committed, so CI does not need sharp.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
const art = await readFile(path("design/art.fragment.svg"), "utf8");

const BG = "#141413";

// Rounded square icon (favicon, "any" purpose)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="${BG}"/>
${art}</svg>`;

// Full-bleed icon with the drawing inside the maskable safe zone
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${BG}"/>
<g transform="translate(256 256) scale(0.72) translate(-256 -257)">
${art}</g></svg>`;

// 1200x630 social share image
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#1b2a21"/><stop offset="1" stop-color="${BG}"/>
</linearGradient></defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<rect y="606" width="1200" height="24" fill="#5cc98a"/>
<g transform="translate(70 105) scale(0.78)">
${art}</g>
<g font-family="Segoe UI, Arial, Helvetica, sans-serif" fill="#f1f1ed">
<text x="520" y="290" font-size="112" font-weight="800">Saunatime</text>
<text x="524" y="365" font-size="40" fill="#5cc98a" font-weight="700">Cheapest time for your sauna</text>
<text x="524" y="430" font-size="32" fill="#a5a59e">Average cost of a 1 to 6 hour session,</text>
<text x="524" y="474" font-size="32" fill="#a5a59e">from Finnish spot electricity prices.</text>
</g></svg>`;

async function render(svg, dest, width, height = width) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(width, height)
    .png({ compressionLevel: 9 })
    .toFile(path(`public/${dest}`));
  console.log(`public/${dest} (${width}x${height})`);
}

await render(iconSvg, "icons/icon-192.png", 192);
await render(iconSvg, "icons/icon-512.png", 512);
await render(maskableSvg, "icons/icon-maskable-512.png", 512);
await render(maskableSvg, "apple-touch-icon.png", 180);
await render(iconSvg, "favicon-32.png", 32);
await render(ogSvg, "og-image.png", 1200, 630);
await writeFile(path("public/favicon.svg"), iconSvg);
console.log("public/favicon.svg");
