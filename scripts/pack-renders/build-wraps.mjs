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
  const crimp = (y, h) => Array.from({ length: Math.ceil(FW / 22) }, (_, i) =>
    `<rect x="${X0 + i * 22}" y="${y}" width="11" height="${h}" fill="#fff" opacity=".22"/>`).join("");
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
    ${crimp(Y0, 95)}${crimp(Y1 - 95, 95)}
    <rect x="${X0}" y="${TEAR - 3}" width="${FW}" height="6" fill="#fff" opacity=".35"/>
    <rect x="${X0}" y="${TEAR + 3}" width="${FW}" height="3" fill="#000" opacity=".25"/>
  </svg>`;
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
  const lg = await logo("packdraft-logo-full.svg", Math.round(FW * 0.6));
  const lgMeta = await sharp(lg).metadata();
  // white backing glow behind the logo for contrast
  const files = chase(p.price);
  const slabH = 640, angles = files.length === 3 ? [-14, 14, 0] : [0];
  const offs = files.length === 3 ? [-290, 290, 0] : [0];
  const order = files.length === 3 ? [files[0], files[2], files[1]] : files;
  for (let i = 0; i < order.length; i++) {
    const s = await slabLayer(order[i], i === order.length - 1 ? slabH + 70 : slabH, angles[i]);
    const left = Math.round(CX + offs[i] - s.w / 2), top = Math.round(1010 - s.h / 2 + (i === order.length - 1 ? -20 : 40));
    layers.push({ input: s.shadow, left: left + 14, top: top + 26 }, { input: s.rot, left, top });
  }
  const name = p.name.replace(" Pack", "").toUpperCase();
  const fs1 = name.length > 10 ? 120 : 150;
  const band = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${X0}" y="1395" width="${FW}" height="300" fill="#0b0f18" opacity=".62"/>
    <rect x="${X0}" y="1395" width="${FW}" height="6" fill="#fff" opacity=".5"/>
    <rect x="${X0}" y="1689" width="${FW}" height="6" fill="#fff" opacity=".5"/>
    <text x="${CX}" y="${1395 + 150 + fs1 * 0.3}" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial" font-weight="900" font-size="${fs1}" fill="#fff" letter-spacing="-2">${esc(name)}</text>
    <text x="${CX}" y="1660" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="700" font-size="44" fill="#fff" fill-opacity=".8" letter-spacing="14">${p.cards} GRADED SLABS</text>
    <text x="${CX}" y="1790" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="700" font-size="36" fill="#fff" fill-opacity=".7" letter-spacing="10">NBA · MYSTERY PACK</text>
  </svg>`;
  return sharp(Buffer.from(base(p.id)))
    .composite([
      { input: lg, left: Math.round(CX - lgMeta.width / 2), top: 150 },
      ...layers,
      { input: Buffer.from(band), left: 0, top: 0 },
    ]).png().toBuffer();
}

async function back(p) {
  const lg = await logo("packdraft-logo-simple.svg", Math.round(FW * 0.55)).catch(() => logo("packdraft-logo-full.svg", Math.round(FW * 0.55)));
  const m = await sharp(lg).metadata();
  const rows = Object.entries(p.odds).reverse();
  const label = { grail: "Grail 1/1", legendary: "Legendary", epic: "Epic", rare: "Rare", common: "Common" };
  const txt = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${X0 + 110}" y="820" width="${FW - 220}" height="${120 + rows.length * 86}" rx="28" fill="#0b0f18" opacity=".55"/>
    <text x="${CX}" y="900" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="800" font-size="46" fill="#fff" letter-spacing="10">PULL ODDS</text>
    ${rows.map(([k, v], i) => `
      <text x="${X0 + 170}" y="${990 + i * 86}" font-family="Helvetica Neue, Arial" font-weight="700" font-size="48" fill="#fff">${label[k]}</text>
      <text x="${X1 - 170}" y="${990 + i * 86}" text-anchor="end" font-family="Menlo, Courier New" font-weight="700" font-size="48" fill="#fff">${v}%</text>`).join("")}
    <text x="${CX}" y="1560" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial" font-weight="900" font-size="78" fill="#fff">${esc(p.name.toUpperCase())}</text>
    <text x="${CX}" y="1640" text-anchor="middle" font-family="Helvetica Neue, Arial" font-size="40" fill="#fff" fill-opacity=".8">${esc(p.blurb)}</text>
    <text x="${CX}" y="1780" text-anchor="middle" font-family="Helvetica Neue, Arial" font-weight="700" font-size="34" fill="#fff" fill-opacity=".6" letter-spacing="8">PACKDRAFT · RIP RESPONSIBLY</text>
  </svg>`;
  // Back faces are mirrored in u (u = 0.5 − 11.046·x), which reads correctly when seen from behind.
  return sharp(Buffer.from(base(p.id, 0.18))).composite([
    { input: lg, left: Math.round(CX - m.width / 2), top: 330 },
    { input: Buffer.from(txt), left: 0, top: 0 },
  ]).png().toBuffer();
}

fs.mkdirSync(OUT, { recursive: true });
for (const p of PACKS) {
  fs.writeFileSync(path.join(OUT, `${p.id}_front.png`), await front(p));
  fs.writeFileSync(path.join(OUT, `${p.id}_back.png`), await back(p));
  console.log("wrap", p.id);
}
