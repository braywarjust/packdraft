// High-res stills of the face-down slab backs (same design as src/components/SlabBack.tsx), one per rarity.
// Canvas matches the slab scans: square, transparent, slab 710/1200 wide, full height, 18/1200 corners.
// Usage: node scripts/slab-back/build-backs.mjs [outDir] [size=2400]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, "exports/slab-backs"));
const S = Number(process.argv[3] ?? 2400);
const k = S / 1200;
const RARITY = { base: "#64748b", chase: "#0284c7", "short-print": "#c026d3", "case-hit": "#f59e0b", grail: "#10b981" };

const sw = 710 * k, x0 = (S - sw) / 2, r = 18 * k, border = 1200 * 0.03 * k, inset = 1200 * 0.035 * k;
const b64 = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;

// Full-colour logo, and a white silhouette of the simple mark for the faded layer.
const full = fs.readFileSync(path.join(ROOT, "public/packdraft-logo-full.svg"));
const simpleSvg = fs.readFileSync(path.join(ROOT, "public/packdraft-logo-simple.svg"));
const markW = Math.round(sw * 1.35), markH = Math.round((markW * 167) / 311);
const markAlpha = await sharp(simpleSvg, { density: 600 }).resize(markW, markH).ensureAlpha().extractChannel("alpha").toBuffer();
const mark = await sharp({ create: { width: markW, height: markH, channels: 3, background: "#ffffff" } }).joinChannel(markAlpha).png().toBuffer();
const logoW = sw * 0.72, logoH = (logoW * 179) / 323;

function svg(color) {
  const cx = S / 2, cy = S / 2;
  const cell = 12 * (1200 / 260) * k; // same pattern density as the 260px on-screen version
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${S}" height="${S}">
  <defs>
    <clipPath id="slab"><rect x="${x0}" y="0" width="${sw}" height="${S}" rx="${r}"/></clipPath>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#182238"/><stop offset=".7" stop-color="#0d1322"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset=".7" stop-color="${color}" stop-opacity="0"/></radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2=".45">
      <stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".28" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <pattern id="dia" width="${cell}" height="${cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="${cell}" height="${1.2 * k * 2.4}" fill="#fff"/><rect width="${1.2 * k * 2.4}" height="${cell}" fill="#fff"/>
    </pattern>
  </defs>
  <g clip-path="url(#slab)">
    <rect x="${x0}" y="0" width="${sw}" height="${S}" fill="url(#bg)"/>
    <rect x="${x0}" y="0" width="${sw}" height="${S}" fill="url(#dia)" opacity=".09"/>
    <rect x="${x0}" y="0" width="${sw}" height="${S}" fill="url(#glow)"/>
    <image xlink:href="${b64(mark, "image/png")}" x="${cx - markW / 2}" y="${cy - markH / 2}" width="${markW}" height="${markH}" opacity=".08" transform="rotate(-8 ${cx} ${cy})"/>
    <rect x="${x0 + inset}" y="${inset}" width="${sw - 2 * inset}" height="${S - 2 * inset}" rx="${3 * k * 4.6}" fill="none" stroke="${color}" stroke-opacity=".4" stroke-width="${1 * k * 4.6}"/>
    <image xlink:href="${b64(full, "image/svg+xml")}" x="${cx - logoW / 2}" y="${cy - logoH / 2}" width="${logoW}" height="${logoH}"/>
    <rect x="${x0}" y="0" width="${sw}" height="${S}" fill="url(#sheen)"/>
    <!-- Rarity border, inside the rounded clip so its outer corners match the slab scans -->
    <rect x="${x0 + border / 2}" y="${border / 2}" width="${sw - border}" height="${S - border}" fill="none" stroke="${color}" stroke-width="${border}"/>
  </g>
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });
const tiles = [];
for (const [name, color] of Object.entries(RARITY)) {
  const file = path.join(OUT, `slab-back-${name}.png`);
  await sharp(Buffer.from(svg(color)), { density: 72 }).png().toFile(file);
  tiles.push(file);
  console.log("wrote", file);
}
// One overview image with all five side by side (cropped to the slabs).
const crop = { left: Math.round(x0 - 20 * k), top: 0, width: Math.round(sw + 40 * k), height: S };
const parts = await Promise.all(tiles.map((f) => sharp(f).extract(crop).resize({ height: 1200 }).toBuffer()));
const pw = (await sharp(parts[0]).metadata()).width;
await sharp({ create: { width: pw * 5 + 60 * 6, height: 1320, channels: 4, background: "#1d2433" } })
  .composite(parts.map((input, i) => ({ input, left: 60 + i * (pw + 60), top: 60 }))).png().toFile(path.join(OUT, "slab-backs-all.png"));
console.log("wrote overview");
