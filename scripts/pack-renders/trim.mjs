// Crops the transparent margin around each Blender render so the pack fills its box in the shop.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve(import.meta.dirname, "../../public/packs");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".png"))) {
  const file = path.join(dir, f);
  const buf = await sharp(file).trim({ threshold: 1 }).extend({ top: 12, bottom: 12, left: 12, right: 12, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(file, buf);
  const m = await sharp(buf).metadata();
  console.log(f, m.width, m.height);
}
