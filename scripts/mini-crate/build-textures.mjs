// Builds the UV wraps for the skinny 1-slab crate (MINI-CRATE.blend), one per pack, laid out on the fold-out net in
// scripts/mini-crate/layout.json (see blender/mini-crate/mini-crate-uv-guide.png). Same look as the Mega crate wrap,
// but in each pack's tier colours with one chase slab on the front.
// Usage: node scripts/mini-crate/build-textures.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { PACKS } from "../../src/lib/packs.ts";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, "blender/mini-crate"));
const L = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "layout.json"), "utf8"));
const SLABS_DIR = path.join(os.homedir(), "NBA_Slabs_webp");
const F = "Helvetica Neue, Arial", FB = "Arial Black, Helvetica Neue, Arial";
// Tier colours: [light, dark] for the backdrop, plus the frame/accent colour.
const TIER = {
  rookie: ["#64748b", "#1e293b", "#cbd5e1"], starter: ["#0ea5e9", "#0c2a5b", "#7dd3fc"], pro: ["#10b981", "#063a33", "#6ee7b7"],
  allpro: ["#c026d3", "#2e0a45", "#f0abfc"], hof: ["#f59e0b", "#4a1d06", "#fde68a"], goat: ["#f43f5e", "#3b0a1c", "#fda4af"],
};

const svgLogo = (f) => fs.readFileSync(path.join(ROOT, "public", f), "utf8").replace('width="100%" height="100%"', 'width="323" height="179"');
const logo = (f, width) => sharp(Buffer.from(svgLogo(f)), { density: 600 }).resize({ width }).png().toBuffer();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const meta = (b) => sharp(b).metadata();

const db = new DatabaseSync(path.join(ROOT, "data/packdraft-nba.db"), { readOnly: true });
const chaseFor = (price) => db.prepare(`SELECT file FROM slabs WHERE missing = 0 AND rarity IN ('epic','legendary','grail') AND player_tier IN ('goat','legend','star')
  ORDER BY ABS(est_value - ?) LIMIT 1`).get(price * 8)?.file;

function frame(id, w, h, inner = "") {
  const [light, dark, accent] = TIER[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>
      <radialGradient id="bg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="${light}"/><stop offset=".65" stop-color="${dark}"/><stop offset="1" stop-color="#05070c"/></radialGradient>
      <pattern id="pin" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="30" fill="#fff" opacity=".06"/></pattern>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/><rect width="${w}" height="${h}" fill="url(#pin)"/>
    <rect x="22" y="22" width="${w - 44}" height="${h - 44}" rx="18" fill="none" stroke="${accent}" stroke-width="10"/>
    <rect x="44" y="44" width="${w - 88}" height="${h - 88}" rx="10" fill="none" stroke="${accent}" stroke-opacity=".35" stroke-width="3"/>
    ${inner}</svg>`;
}

async function slab(file, h) {
  const img = await sharp(path.join(SLABS_DIR, file)).resize({ height: h }).ensureAlpha().png().toBuffer();
  const m = await meta(img);
  const a = await sharp(img).extractChannel("alpha").blur(16).linear(0.6, 0).toBuffer();
  const shadow = await sharp({ create: { width: m.width, height: m.height, channels: 3, background: "#000" } }).joinChannel(a).png().toBuffer();
  return { img, shadow, w: m.width, h: m.height };
}

const label = (p) => p.name.replace(" Pack", "").toUpperCase();

async function front(p, w, h) {
  const accent = TIER[p.id][2];
  const lg = await logo("packdraft-logo-full.svg", Math.round(w * 0.62)), lm = await meta(lg);
  const comps = [{ input: lg, left: Math.round(w / 2 - lm.width / 2), top: 70 }];
  const file = chaseFor(p.price);
  if (file) {
    const s = await slab(file, Math.round(h * 0.5));
    const left = Math.round(w / 2 - s.w / 2), top = Math.round(h * 0.52 - s.h / 2);
    comps.push({ input: s.shadow, left: left + 10, top: top + 20 }, { input: s.img, left, top });
  }
  const name = label(p), fs1 = name.length > 10 ? 96 : name.length > 6 ? 120 : 150;
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect x="44" y="${h - 330}" width="${w - 88}" height="230" fill="#05070c" opacity=".72"/>
    <rect x="44" y="${h - 330}" width="${w - 88}" height="5" fill="${accent}"/>
    <text x="${w / 2}" y="${h - 330 + 140}" text-anchor="middle" font-family="${FB}" font-weight="900" font-size="${fs1}" fill="#fff" letter-spacing="2">${esc(name)}</text>
    <text x="${w / 2}" y="${h - 125}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="36" fill="${accent}" letter-spacing="12">1 GRADED SLAB · NBA</text>
  </svg>`;
  return sharp(Buffer.from(frame(p.id, w, h))).composite([...comps, { input: Buffer.from(text), left: 0, top: 0 }]).png().toBuffer();
}

async function side(p, w, h) {
  const lg = await logo("packdraft-logo-simple.svg", Math.round(w * 0.62)), lm = await meta(lg);
  const inner = `<g transform="translate(${w / 2 + 34} ${h * 0.58}) rotate(-90)">
      <text text-anchor="middle" font-family="${FB}" font-weight="900" font-size="${Math.min(110, w * 0.2)}" fill="#fff">${esc(label(p))}</text></g>
    <text x="${w / 2}" y="${h - 66}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="28" fill="${TIER[p.id][2]}" letter-spacing="8">1 SLAB</text>`;
  return sharp(Buffer.from(frame(p.id, w, h, inner))).composite([{ input: lg, left: Math.round(w / 2 - lm.width / 2), top: 90 }]).png().toBuffer();
}

async function lid(p, w, h) {
  const lg = await logo("packdraft-logo-full.svg", Math.round(w * 0.42)), lm = await meta(lg);
  const inner = `<text x="${w / 2}" y="${h - 70}" text-anchor="middle" font-family="${F}" font-weight="800" font-size="34" fill="${TIER[p.id][2]}" letter-spacing="12">PACKDRAFT · ${esc(label(p))}</text>`;
  return sharp(Buffer.from(frame(p.id, w, h, inner))).composite([{ input: lg, left: Math.round(w / 2 - lm.width / 2), top: 60 }]).png().toBuffer();
}

async function back(p, w, h) {
  const lg = await logo("packdraft-logo-full.svg", Math.round(w * 0.5)), lm = await meta(lg);
  const names = { grail: "Immortal", legendary: "Mythic", epic: "Epic", rare: "Rare", common: "Common" };
  const odds = Object.entries(p.odds).reverse().filter(([, v]) => v > 0);
  const x0 = 110, x1 = w - 110;
  const inner = `<rect x="${x0 - 30}" y="420" width="${x1 - x0 + 60}" height="${110 + odds.length * 80}" rx="24" fill="#05070c" opacity=".6"/>
    <text x="${w / 2}" y="490" text-anchor="middle" font-family="${F}" font-weight="800" font-size="40" fill="${TIER[p.id][2]}" letter-spacing="10">PULL ODDS</text>
    ${odds.map(([k, v], i) => `<text x="${x0}" y="${575 + i * 80}" font-family="${F}" font-weight="700" font-size="44" fill="#fff">${names[k]}</text>
      <text x="${x1}" y="${575 + i * 80}" text-anchor="end" font-family="Menlo, Courier New" font-weight="700" font-size="44" fill="#fff">${v}%</text>`).join("")}
    <text x="${w / 2}" y="${h - 150}" text-anchor="middle" font-family="${F}" font-size="34" fill="#fff" fill-opacity=".75">${esc(p.blurb)}</text>`;
  return sharp(Buffer.from(frame(p.id, w, h, inner))).composite([{ input: lg, left: Math.round(w / 2 - lm.width / 2), top: 90 }]).png().toBuffer();
}

fs.mkdirSync(OUT, { recursive: true });
for (const p of PACKS.filter((x) => x.kind !== "case")) {
  const draw = { front, back, left: side, right: side, top: lid, bottom: lid };
  const comps = [];
  for (const [k, [x, y, w, h]] of Object.entries(L.faces)) comps.push({ input: await draw[k](p, w, h), left: x, top: y });
  const file = path.join(OUT, `${p.id}.png`);
  await sharp({ create: { width: L.width, height: L.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comps).png().toFile(file);
  console.log("wrap", p.id);
}
