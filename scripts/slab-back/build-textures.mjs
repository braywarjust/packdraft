// Builds the label and card-back textures for the shared slab back (PackDraft-3D-Slab.blend).
// LABEL is 0.214×0.064 m (1340×400), the card plane is 0.201×0.283 m (1000×1407).
// Usage: node scripts/slab-back/build-textures.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, "blender/slab-back"));
const svgFile = (f) => fs.readFileSync(path.join(ROOT, "public", f), "utf8").replace('width="100%" height="100%"', 'width="323" height="179"');
const logo = (f, width) => sharp(Buffer.from(svgFile(f)), { density: 600 }).resize({ width }).png().toBuffer();
const tint = async (buf, hex, opacity) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = Math.round(data[i + 3] * opacity); }
  return sharp(data, { raw: info }).png().toBuffer();
};
const F = "Helvetica Neue, Arial";

async function label() {
  const W = 1340, H = 400, B = 26;
  const bars = Array.from({ length: 46 }, (_, i) => { const w = [3, 5, 2, 7, 3, 4][i % 6]; return `<rect x="${70 + i * 9}" y="262" width="${w}" height="70" fill="#111"/>`; }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="holo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#b9c3cf"/><stop offset=".25" stop-color="#e9edf2"/><stop offset=".5" stop-color="#c7cdd6"/><stop offset=".75" stop-color="#f2f4f7"/><stop offset="1" stop-color="#aeb7c3"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="#d6363c"/>
    <rect x="${B}" y="${B}" width="${W - 2 * B}" height="${H - 2 * B}" fill="#fbfbfa"/>
    <text x="70" y="118" font-family="${F}" font-size="52" fill="#1a1a1a" letter-spacing="1">PACKDRAFT VAULT</text>
    <text x="70" y="182" font-family="${F}" font-size="52" fill="#1a1a1a" letter-spacing="1">MYSTERY SLAB</text>
    ${bars}
    <rect x="${W - 330}" y="250" width="250" height="96" rx="6" fill="url(#holo)"/>
    <text x="${W - 70}" y="118" text-anchor="end" font-family="${F}" font-size="52" fill="#1a1a1a">#PD</text>
    <text x="${W - 70}" y="182" text-anchor="end" font-family="${F}" font-size="52" fill="#1a1a1a">SEALED</text>
    <text x="${W - 70}" y="240" text-anchor="end" font-family="${F}" font-size="52" fill="#1a1a1a">?</text>
  </svg>`;
  const full = await logo("packdraft-logo-full.svg", 330);
  const small = await logo("packdraft-logo-simple.svg", 200);
  const fm = await sharp(full).metadata(), sm = await sharp(small).metadata();
  return sharp(Buffer.from(svg)).composite([
    { input: full, left: Math.round(W / 2 - fm.width / 2 + 10), top: Math.round(H / 2 - fm.height / 2 - 10) },
    { input: await tint(small, "#3d4654", 0.85), left: W - 330 + Math.round((250 - sm.width) / 2), top: 250 + Math.round((96 - sm.height) / 2) },
  ]).png().toBuffer();
}

async function card() {
  const W = 1000, H = 1407;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16233d"/><stop offset=".55" stop-color="#0d1526"/><stop offset="1" stop-color="#1a1220"/></linearGradient>
      <radialGradient id="glow" cx=".5" cy=".46" r=".55"><stop offset="0" stop-color="#1f63b5" stop-opacity=".55"/><stop offset="1" stop-color="#1f63b5" stop-opacity="0"/></radialGradient>
      <pattern id="pin" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="34" fill="#fff" opacity=".05"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#pin)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <rect x="34" y="34" width="${W - 68}" height="${H - 68}" rx="26" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="6"/>
    <rect x="52" y="52" width="${W - 104}" height="${H - 104}" rx="18" fill="none" stroke="#d6363c" stroke-width="4"/>
    <text x="${W / 2}" y="150" text-anchor="middle" font-family="${F}" font-weight="800" font-size="40" fill="#fff" fill-opacity=".8" letter-spacing="16">OFFICIAL MYSTERY SLAB</text>
    <rect x="${W / 2 - 60}" y="1090" width="120" height="6" fill="#d6363c"/>
    <text x="${W / 2}" y="1180" text-anchor="middle" font-family="Arial Black, ${F}" font-weight="900" font-size="54" fill="#fff" letter-spacing="2">RIP · REVEAL · COLLECT</text>
    <text x="${W / 2}" y="1262" text-anchor="middle" font-family="${F}" font-weight="700" font-size="34" fill="#fff" fill-opacity=".6" letter-spacing="12">PACKDRAFT · NBA</text>
  </svg>`;
  // Faint repeating simple-logo pattern behind the hero logo.
  const tile = await tint(await logo("packdraft-logo-simple.svg", 150), "#ffffff", 0.06);
  const tm = await sharp(tile).metadata();
  const pattern = [];
  for (let r = 0; r < 12; r++) for (let c = -1; c < 6; c++)
    pattern.push({ input: tile, left: Math.round(c * 210 + (r % 2) * 105 + 40), top: Math.round(r * 120 + 10) });
  const hero = await logo("packdraft-logo-full.svg", 780);
  const hm = await sharp(hero).metadata();
  const base = await sharp(Buffer.from(svg)).composite(pattern.filter((p) => p.left > -tm.width && p.left < W && p.top < H)).png().toBuffer();
  return sharp(base).composite([{ input: hero, left: Math.round(W / 2 - hm.width / 2), top: Math.round(620 - hm.height / 2) }]).png().toBuffer();
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "label.png"), await label());
fs.writeFileSync(path.join(OUT, "card.png"), await card());
console.log("built", OUT);
