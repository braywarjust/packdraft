import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { currentUser } from "@/lib/auth";
import { DATA_DIR } from "@/lib/db";

const SIZE = 512;

/**
 * Team/league logo upload: any common image, saved as a PNG up to 512px.
 * Transparent PNGs keep their shape (empty margins trimmed). Opaque images (phone photos, logos on white) get a plain
 * edge-to-edge background knocked out; if there isn't one, the photo becomes a rounded square tile.
 */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return NextResponse.json({ error: "HEIC photos aren't supported here. Pick it from Photos on your phone, or save it as a JPG or PNG first." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Max 20 MB" }, { status: 400 });
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(input).metadata();
    const alphaMin = meta.hasAlpha ? (await sharp(input).stats()).channels[3]?.min ?? 255 : 255;
    const out = alphaMin < 255
      ? await sharp(input).rotate().trim({ threshold: 1 }).resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: true }).png().toBuffer()
      : await opaqueLogo(input);
    const dir = path.join(DATA_DIR, "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.randomBytes(12).toString("hex")}.png`;
    fs.writeFileSync(path.join(dir, name), out);
    return NextResponse.json({ url: `/api/uploads/${name}` });
  } catch {
    return NextResponse.json({ error: "Couldn't read that image. Try a JPG or PNG." }, { status: 400 });
  }
}

/** Knocks out a solid background that touches the edges (flood fill from the border); falls back to a rounded tile. */
async function opaqueLogo(input: Buffer) {
  const { data, info } = await sharp(input).rotate().flatten({ background: "#ffffff" })
    .resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  // Background colour = the border's average; it only counts as a plain background if nearly all the border matches it.
  const bg = [0, 1, 2].map((c) => border.reduce((s, i) => s + px(i)[c], 0) / border.length);
  const near = (i: number, tol: number) => { const p = px(i); return Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) <= tol; };
  const plain = border.filter((i) => near(i, 60)).length / border.length > 0.9;
  if (plain) {
    const seen = new Uint8Array(w * h);
    const stack = border.filter((i) => near(i, 60));
    let cleared = 0;
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i]) continue;
      seen[i] = 1;
      if (!near(i, 60)) continue;
      data[i * 4 + 3] = 0;
      cleared++;
      const x = i % w, y = (i - x) / w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - w);
      if (y < h - 1) stack.push(i + w);
    }
    // Something must be left once the background is gone, otherwise it was a plain colour, not a logo.
    if (cleared < w * h * 0.97) {
      return sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
    }
  }
  const r = Math.round(SIZE * 0.18);
  const mask = Buffer.from(`<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${r}" ry="${r}"/></svg>`);
  return sharp(input).rotate().resize(SIZE, SIZE, { fit: "cover", position: "attention" })
    .composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}
