// Draws the Mega Case UV wrap guide from layout.json:
//   uv-guide.png          labelled template to design on (same size as the final wrap)
//   uv-guide-overlay.png  just the lines and labels, transparent, to lay over your artwork
// Usage: node scripts/mega-case/build-guide.mjs [outDir]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// Usage: node build-guide.mjs [outDir] [layout.json] [title] [prefix]
const OUT = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "../../blender/mega-case"));
const L = JSON.parse(fs.readFileSync(process.argv[3] ?? path.join(import.meta.dirname, "layout.json"), "utf8"));
const TITLE = process.argv[4] ?? "PACKDRAFT MEGA CASE · UV WRAP GUIDE";
const PREFIX = process.argv[5] ?? "uv-guide";
const SAFE = 80;
const F = "Helvetica Neue, Arial";
const INFO = {
  front: ["#1f63b5", "Faces the camera in the shop image"],
  left: ["#0f9d8a", "Also visible in the shop image"],
  right: ["#7c5cd6", "Hidden in the shop image"],
  back: ["#b4581f", "Hidden in the shop image"],
  top: ["#b8902a", "Not visible in the shop image"],
  bottom: ["#6b7280", "Hidden in the shop image"],
};
// Which face each edge folds onto (top, right, bottom, left edges as seen on the net).
const EDGES = {
  front: ["TOP", "RIGHT", "BOTTOM", "LEFT"], left: ["TOP", "FRONT", "BOTTOM", "BACK"], right: ["TOP", "BACK", "BOTTOM", "FRONT"],
  back: ["TOP", "LEFT", "BOTTOM", "RIGHT"], top: ["BACK", "RIGHT", "FRONT", "LEFT"], bottom: ["FRONT", "RIGHT", "BACK", "LEFT"],
};

function faceSvg(name, [x, y, w, h], fill) {
  const [col, note] = INFO[name];
  const cx = x + w / 2, cy = y + h / 2;
  const big = Math.min(w, h) * 0.2;
  const [et, er, eb, el] = EDGES[name];
  const edge = (tx, ty, rot, t) => `<text x="${tx}" y="${ty}" transform="rotate(${rot} ${tx} ${ty})" text-anchor="middle" font-family="${F}" font-size="30" font-weight="700" fill="${col}" opacity=".9"> joins ${t}</text>`;
  return `
    ${fill ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${col}" opacity=".14"/>` : ""}
    <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" fill="none" stroke="${col}" stroke-width="6"/>
    <rect x="${x + SAFE}" y="${y + SAFE}" width="${w - 2 * SAFE}" height="${h - 2 * SAFE}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="18 12" opacity=".8"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" font-family="${F}" font-weight="900" font-size="${big}" fill="${col}" opacity=".85">${name.toUpperCase()}</text>
    <text x="${cx}" y="${cy + big * 0.5}" text-anchor="middle" font-family="${F}" font-weight="700" font-size="${Math.max(28, big * 0.22)}" fill="${col}" opacity=".85">${w} × ${h} px</text>
    <text x="${cx}" y="${cy + big * 0.85}" text-anchor="middle" font-family="${F}" font-size="${Math.max(24, big * 0.17)}" fill="${col}" opacity=".85">${note}</text>
    <text x="${cx}" y="${y + SAFE + 70}" text-anchor="middle" font-family="${F}" font-weight="900" font-size="54" fill="${col}">▲ UP</text>
    ${edge(cx, y + 42, 0, et)}${edge(cx, y + h - 18, 0, eb)}${edge(x + 40, cy, -90, el)}${edge(x + w - 40, cy, 90, er)}`;
}

function guide(fill) {
  const faces = Object.entries(L.faces).map(([k, r]) => faceSvg(k, r, fill)).join("");
  const notes = [
    TITLE,
    `Canvas: ${L.width} × ${L.height} px (keep this exact size)`,
    "Design every face upright, as seen from outside the box.",
    "The net folds like a box: shared edges meet each other.",
    "Keep text and logos inside the dashed safe lines.",
    "Paint background colour right up to each face's edge.",
    "Grey corner areas are unused.",
    "Export as PNG and send it back: I'll render it.",
  ];
  // Notes go in the empty top-right corner; shrink the type if that corner is short.
  const lh = Math.min(78, (L.faces.front[1] - 40) / notes.length);
  const [nx, ny] = [L.faces.right[0] + 60, 40 + lh];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${L.width}" height="${L.height}">
    ${fill ? `<rect width="${L.width}" height="${L.height}" fill="#d9dce1"/>
    <pattern id="h" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="40" fill="#c3c7ce"/></pattern>
    <rect width="${L.width}" height="${L.height}" fill="url(#h)"/>
    ${Object.values(L.faces).map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`).join("")}` : ""}
    ${faces}
    ${notes.map((t, i) => `<text x="${nx}" y="${ny + i * lh}" font-family="${F}" font-size="${(i ? 46 : 56) * (lh / 78)}" font-weight="${i ? 500 : 900}" fill="#1f2937">${t}</text>`).join("")}
  </svg>`);
}

fs.mkdirSync(OUT, { recursive: true });
await sharp(guide(true)).png().toFile(path.join(OUT, `${PREFIX}.png`));
await sharp(guide(false)).png().toFile(path.join(OUT, `${PREFIX}-overlay.png`));
console.log("guide", OUT);
