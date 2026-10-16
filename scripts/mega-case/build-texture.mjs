// Builds the UV wrap for the box inside CASE.blend, laid out on the fold-out net in layout.json
// (true proportions; see blender/mega-case/uv-guide.png).
// Usage: node scripts/mega-case/build-texture.mjs [out.png]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { PACK_BY_ID } from "../../src/lib/packs.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, "blender/mega-case/atlas.png"));
const SLABS_DIR = path.join(os.homedir(), "NBA_Slabs_webp");
const CASE = PACK_BY_ID.megacase;
const F = "Helvetica Neue, Arial", FB = "Arial Black, Helvetica Neue, Arial";
const GOLD = `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#f5c15c"/><stop offset=".55" stop-color="#c98a1e"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>`;
const BG = `<radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#1f3a6b"/><stop offset=".6" stop-color="#0e1626"/><stop offset="1" stop-color="#07090f"/></radialGradient>
  <pattern id="pin" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="30" fill="#f5c15c" opacity=".07"/></pattern>`;

const svgLogo = (f) => fs.readFileSync(path.join(ROOT, "public", f), "utf8").replace('width="100%" height="100%"', 'width="323" height="179"');
const logo = (f, width) => sharp(Buffer.from(svgLogo(f)), { density: 600 }).resize({ width }).png().toBuffer();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const meta = (b) => sharp(b).metadata();

const db = new DatabaseSync(path.join(ROOT, "data/packdraft-nba.db"), { readOnly: true });
const rows = db.prepare(`SELECT file, player FROM slabs WHERE missing = 0 AND rarity IN ('legendary','grail') AND player_tier IN ('goat','legend')
  ORDER BY est_value DESC LIMIT 80`).all();
const seen = new Set();
const chase = rows.filter((r) => !seen.has(r.player) && seen.add(r.player)).slice(0, 5).map((r) => r.file);

function frame(w, h, inner = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${GOLD}${BG}</defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#pin)"/>
    <rect x="22" y="22" width="${w - 44}" height="${h - 44}" rx="18" fill="none" stroke="url(#gold)" stroke-width="10"/>
    <rect x="44" y="44" width="${w - 88}" height="${h - 88}" rx="10" fill="none" stroke="#f5c15c" stroke-opacity=".35" stroke-width="3"/>
    ${inner}</svg>`;
}

async function slab(file, h, angle) {
  const rot = await sharp(path.join(SLABS_DIR, file)).resize({ height: h }).ensureAlpha().rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await meta(rot);
  const a = await sharp(rot).extractChannel("alpha").blur(14).linear(0.6, 0).toBuffer();
  const shadow = await sharp({ create: { width: m.width, height: m.height, channels: 3, background: "#000" } }).joinChannel(a).png().toBuffer();
  return { rot, shadow, w: m.width, h: m.height };
}

async function front() {
  const W = 1420, H = 1200;
  const lg = await logo("packdraft-logo-full.svg", 560), lm = await meta(lg);
  const comps = [{ input: lg, left: Math.round(W / 2 - lm.width / 2), top: 70 }];
  const angles = [-18, 18, -9, 9, 0], offs = [-430, 430, -215, 215, 0], drop = [70, 70, 30, 30, 0];
  const order = [chase[3], chase[4], chase[1], chase[2], chase[0]];
  for (let i = 0; i < 5; i++) {
    const s = await slab(order[i], i === 4 ? 520 : 470, angles[i]);
    const left = Math.round(W / 2 + offs[i] - s.w / 2), top = Math.round(650 - s.h / 2 + drop[i]);
    comps.push({ input: s.shadow, left: left + 12, top: top + 22 }, { input: s.rot, left, top });
  }
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${GOLD}</defs>
    <rect x="44" y="928" width="${W - 88}" height="210" fill="#05070c" opacity=".72"/>
    <text x="${W / 2}" y="1068" text-anchor="middle" font-family="${FB}" font-weight="900" font-size="150" fill="url(#gold)" stroke="#6b4a0f" stroke-width="3" letter-spacing="4">MEGA CASE</text>
    <text x="${W / 2}" y="1122" text-anchor="middle" font-family="${F}" font-weight="800" font-size="36" fill="#fff" fill-opacity=".85" letter-spacing="14">${CASE.cards} GRADED SLABS · NBA</text>
  </svg>`;
  return sharp(Buffer.from(frame(W, H))).composite([...comps, { input: Buffer.from(text), left: 0, top: 0 }]).png().toBuffer();
}

async function side(flip) {
  const W = 634, H = 1200;
  const lg = await logo("packdraft-logo-simple.svg", 340), lm = await meta(lg);
  const inner = `<g transform="translate(${W / 2 + 40} 690) rotate(-90)">
      <text text-anchor="middle" font-family="${FB}" font-weight="900" font-size="112" fill="url(#gold)" stroke="#6b4a0f" stroke-width="2">MEGA CASE</text></g>
    <text x="${W / 2}" y="${H - 66}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="30" fill="#fff" fill-opacity=".8" letter-spacing="10">${CASE.cards} SLABS</text>`;
  void flip;
  return sharp(Buffer.from(frame(W, H, inner))).composite([{ input: lg, left: Math.round(W / 2 - lm.width / 2), top: 90 }]).png().toBuffer();
}

async function topFace() {
  const W = 1420, H = 632;
  const lg = await logo("packdraft-logo-full.svg", 520), lm = await meta(lg);
  const inner = `<text x="${W / 2}" y="${H - 80}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="38" fill="#f5c15c" letter-spacing="16">PACKDRAFT · MEGA CASE</text>`;
  return sharp(Buffer.from(frame(W, H, inner))).composite([{ input: lg, left: Math.round(W / 2 - lm.width / 2), top: 70 }]).png().toBuffer();
}

async function back() {
  const W = 1420, H = 1200;
  const lg = await logo("packdraft-logo-full.svg", 480), lm = await meta(lg);
  const label = { grail: "Grail 1/1", legendary: "Legendary", epic: "Epic", rare: "Rare", common: "Common" };
  const odds = Object.entries(CASE.odds).reverse().filter(([, v]) => v > 0);
  const inner = `<rect x="330" y="400" width="${W - 660}" height="${110 + odds.length * 80}" rx="24" fill="#05070c" opacity=".6"/>
    <text x="${W / 2}" y="470" text-anchor="middle" font-family="${F}" font-weight="800" font-size="42" fill="url(#gold)" letter-spacing="12">PULL ODDS PER SLAB</text>
    ${odds.map(([k, v], i) => `<text x="390" y="${555 + i * 80}" font-family="${F}" font-weight="700" font-size="46" fill="#fff">${label[k]}</text>
      <text x="${W - 390}" y="${555 + i * 80}" text-anchor="end" font-family="Menlo, Courier New" font-weight="700" font-size="46" fill="#fff">${v}%</text>`).join("")}
    <text x="${W / 2}" y="1040" text-anchor="middle" font-family="${F}" font-size="38" fill="#fff" fill-opacity=".75">${esc(CASE.blurb)}</text>`;
  return sharp(Buffer.from(frame(W, H, inner))).composite([{ input: lg, left: Math.round(W / 2 - lm.width / 2), top: 80 }]).png().toBuffer();
}

// Lay the faces out on the fold-out net (layout.json); each face art is fitted to its rect.
const L = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "layout.json"), "utf8"));
const art = { front: await front(), back: await back(), top: await topFace(), bottom: await topFace(), left: await side(false), right: await side(true) };
const comps = [];
for (const [k, [x, y, w, h]] of Object.entries(L.faces))
  comps.push({ input: await sharp(art[k]).resize(w, h, { fit: "fill" }).png().toBuffer(), left: x, top: y });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp({ create: { width: L.width, height: L.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toFile(OUT);
fs.writeFileSync(OUT.replace(/\.png$/, "_front.png"), await front());
console.log("atlas", OUT, chase);
