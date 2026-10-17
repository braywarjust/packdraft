// Builds the front/back UV wrap textures for each pack in PackDraft.blend.
// The pack mesh is planar-mapped: u = 0.5 ± 11.046·x, v = 0.5 + 7.679·z, so a 1390×2000 image
// keeps the art undistorted. Pack face spans u 0.058–0.942, v 0.032–0.968; the tear-off top starts at v 0.834.
// Usage: node scripts/pack-renders/build-wraps.mjs <outDir>
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { PACKS } from "../../src/lib/packs.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, "blender/pack-wraps"));
const SLABS_DIR = path.join(os.homedir(), "NBA_Slabs_webp");
const W = 1390, H = 2000;
const px = (u) => Math.round(u * W), py = (v) => Math.round((1 - v) * H);
const X0 = px(0.058), X1 = px(0.942), Y0 = py(0.968), Y1 = py(0.032), TEAR = py(0.834);
const CX = (X0 + X1) / 2, FW = X1 - X0;
// Art lives only in the square middle; above TEAR and below ART_B is the chrome wrapper (render.py turns it metallic).
const ART_B = py(0.14);

const GRADS = {
  rookie: ["#64748b", "#334155"], starter: ["#0ea5e9", "#1d4ed8"], pro: ["#10b981", "#0f766e"],
  allpro: ["#d946ef", "#7e22ce"], hof: ["#fbbf24", "#ea580c"], goat: ["#f43f5e", "#fbbf24", "#34d399"],
};

const db = new DatabaseSync(path.join(ROOT, "data/packdraft-nba.db"), { readOnly: true });
function chase(price) {
  const rows = db.prepare(`SELECT file, player FROM slabs WHERE missing = 0 AND rarity IN ('epic','legendary','grail') AND player_tier IN ('goat','legend','star')
    ORDER BY ABS(est_value - ?) LIMIT 60`).all(price * 8);
  const seen = new Set();
  return rows.filter((r) => !seen.has(r.player) && seen.add(r.player)).slice(0, 3).map((r) => r.file);
}

const logoSvg = (f) => fs.readFileSync(path.join(ROOT, "public", f), "utf8").replace('width="100%" height="100%"', 'width="323" height="179"');
const logo = async (f, width) => sharp(Buffer.from(logoSvg(f)), { density: 600 }).resize({ width }).png().toBuffer();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function base(id, dark = 0) {
  const g = GRADS[id];
  const stops = g.map((c, i) => `<stop offset="${g.length === 1 ? 0 : i / (g.length - 1)}" stop-color="${c}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>
      <radialGradient id="sheen" cx=".5" cy="0" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="vig" cx=".5" cy="1.05" r=".75"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <pattern id="pin" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="26" fill="#fff" opacity=".12"/></pattern>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#pin)"/>
    <rect width="${W}" height="${H}" fill="url(#sheen)"/>
    <rect width="${W}" height="${H}" fill="url(#vig)"/>
    ${dark ? `<rect width="${W}" height="${H}" fill="#000" opacity="${dark}"/>` : ""}
  </svg>`;
}

/** Silver foil for the tear strip and bottom seal: brushed bands, crimp ridges, embossed text, tier-coloured seam. */
function chrome(id, bottomText) {
  const seam = GRADS[id][0];
  const crimp = (y, h) => Array.from({ length: Math.ceil(W / 20) }, (_, i) =>
    `<rect x="${i * 20}" y="${y}" width="10" height="${h}" fill="#fff" opacity=".55"/><rect x="${i * 20 + 10}" y="${y}" width="10" height="${h}" fill="#6b7280" opacity=".35"/>`).join("");
  const brushed = (y0, y1) => Array.from({ length: Math.ceil((y1 - y0) / 6) }, (_, i) =>
    `<rect x="0" y="${y0 + i * 6}" width="${W}" height="2" fill="${i % 3 ? "#fff" : "#9ca3af"}" opacity=".18"/>`).join("");
  const emboss = (y, t, size) => `<text x="${CX}" y="${y + 2}" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial" font-weight="900" font-size="${size}" fill="#fff" opacity=".7" letter-spacing="12">${t}</text>
    <text x="${CX}" y="${y}" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial" font-weight="900" font-size="${size}" fill="#4b5563" opacity=".75" letter-spacing="12">${t}</text>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="cr" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#b8bec8"/><stop offset=".35" stop-color="#eef1f5"/><stop offset=".6" stop-color="#c3c9d2"/><stop offset="1" stop-color="#e3e7ec"/></linearGradient></defs>
    <rect x="0" y="0" width="${W}" height="${TEAR}" fill="url(#cr)"/>
    <rect x="0" y="${ART_B}" width="${W}" height="${H - ART_B}" fill="url(#cr)"/>
    ${brushed(0, TEAR)}${brushed(ART_B, H)}
    ${crimp(0, Y0 + 90)}${crimp(Y1 - 90, H - Y1 + 90)}
    ${emboss(TEAR - 70, "PACKDRAFT", 64)}
    ${emboss(ART_B + 92, bottomText, 40)}
    <rect x="0" y="${TEAR - 14}" width="${W}" height="14" fill="${seam}"/>
    <rect x="0" y="${ART_B}" width="${W}" height="14" fill="${seam}"/>
    <rect x="0" y="${TEAR}" width="${W}" height="4" fill="#000" opacity=".3"/>
    <rect x="0" y="${ART_B - 4}" width="${W}" height="4" fill="#000" opacity=".3"/>
  </svg>`);
}

async function slabLayer(file, h, angle) {
  const img = sharp(path.join(SLABS_DIR, file)).resize({ height: h }).ensureAlpha();
  const buf = await img.png().toBuffer();
  const rot = await sharp(buf).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(rot).metadata();
  // soft drop shadow from the alpha channel
  const shadow = await sharp(rot).ensureAlpha().extractChannel("alpha").toColourspace("b-w")
    .linear(0.55, 0).blur(18).toBuffer()
    .then((a) => sharp({ create: { width: meta.width, height: meta.height, channels: 3, background: "#000" } }).joinChannel(a).png().toBuffer());
  return { rot, shadow, w: meta.width, h: meta.height };
}

async function front(p) {
  const layers = [];
  const lg = await logo("packdraft-logo-full.svg", Math.round(FW * 0.5));
  const lgMeta = await sharp(lg).metadata();
  // white backing glow behind the logo for contrast
  const files = chase(p.price);
  const slabH = 500, angles = files.length === 3 ? [-14, 14, 0] : [0];
  const offs = files.length === 3 ? [-260, 260, 0] : [0];
  const order = files.length === 3 ? [files[0], files[2], files[1]] : files;
  for (let i = 0; i < order.length; i++) {
    const s = await slabLayer(order[i], i === order.length - 1 ? slabH + 60 : slabH, angles[i]);
    const left = Math.round(CX + offs[i] - s.w / 2), top = Math.round(1010 - s.h / 2 + (i === order.length - 1 ? -15 : 30));
    layers.push({ input: s.shadow, left: left + 14, top: top + 26 }, { input: s.rot, left, top });
  }
  const name = p.name.replace(" Pack", "").toUpperCase();
  const fs1 = name.length > 10 ? 100 : 128;
  const band = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="0" y="1380" width="${W}" height="250" fill="#0b0f18" opacity=".62"/>
    <rect x="0" y="1380" width="${W}" height="5" fill="#fff" opacity=".5"/>
    <rect x="0" y="1625" width="${W}" height="5" fill="#fff" opacity=".5"/>
    <text x="${CX}" y="${1380 + 115 + fs1 * 0.3}" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial" font-weight="900" font-size="${fs1}" fill="#fff" letter-spacing="-2">${esc(name)}</text>
    <text x="${CX}" y="1592" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="700" font-size="40" fill="#fff" fill-opacity=".8" letter-spacing="14">${p.cards} GRADED SLAB${p.cards === 1 ? "" : "S"}</text>
  </svg>`;
  return sharp(Buffer.from(base(p.id)))
    .composite([
      { input: lg, left: Math.round(CX - lgMeta.width / 2), top: TEAR + 40 },
      ...layers,
      { input: Buffer.from(band), left: 0, top: 0 },
      { input: chrome(p.id, "NBA · MYSTERY PACK"), left: 0, top: 0 },
    ]).png().toBuffer();
}

async function back(p) {
  const lg = await logo("packdraft-logo-simple.svg", Math.round(FW * 0.42));
  const m = await sharp(lg).metadata();
  const rows = Object.entries(p.odds).reverse();
  const label = { grail: "Immortal", legendary: "Mythic", epic: "Epic", rare: "Rare", common: "Common" };
  const txt = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${X0 + 110}" y="700" width="${FW - 220}" height="${110 + rows.length * 80}" rx="28" fill="#0b0f18" opacity=".55"/>
    <text x="${CX}" y="772" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="800" font-size="46" fill="#fff" letter-spacing="10">PULL ODDS</text>
    ${rows.map(([k, v], i) => `
      <text x="${X0 + 170}" y="${855 + i * 80}" font-family="Helvetica Neue, Arial" font-weight="700" font-size="48" fill="#fff">${label[k]}</text>
      <text x="${X1 - 170}" y="${855 + i * 80}" text-anchor="end" font-family="Menlo, Courier New" font-weight="700" font-size="48" fill="#fff">${v}%</text>`).join("")}
    <text x="${CX}" y="1360" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial" font-weight="900" font-size="74" fill="#fff">${esc(p.name.toUpperCase())}</text>
    <text x="${CX}" y="1440" text-anchor="middle" font-family="Helvetica Neue, Arial" font-size="38" fill="#fff" fill-opacity=".8">${esc(p.blurb)}</text>
  </svg>`;
  // Back faces are mirrored in u (u = 0.5 − 11.046·x), which reads correctly when seen from behind.
  return sharp(Buffer.from(base(p.id, 0.18))).composite([
    { input: lg, left: Math.round(CX - m.width / 2), top: TEAR + 50 },
    { input: Buffer.from(txt), left: 0, top: 0 },
    { input: chrome(p.id, "RIP RESPONSIBLY"), left: 0, top: 0 },
  ]).png().toBuffer();
}

fs.mkdirSync(OUT, { recursive: true });
for (const p of PACKS.filter((p) => p.kind !== "case")) {
  fs.writeFileSync(path.join(OUT, `${p.id}_front.png`), await front(p));
  fs.writeFileSync(path.join(OUT, `${p.id}_back.png`), await back(p));
  console.log("wrap", p.id);
}
