import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DATA_DIR, one } from "@/lib/db";
import { slabFilePath } from "@/lib/slabs";

// Serves slab photos straight from the slab folder (they stay outside the project).
// ?h=N returns a small thumbnail N px tall, cropped to the slab (like SlabImage) and cached in data/thumbs.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = one<{ file: string }>("SELECT file FROM slabs WHERE id = ?", Number(id));
  if (!s) return new Response("Not found", { status: 404 });
  let full: string;
  try {
    full = slabFilePath(s.file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!fs.existsSync(full)) return new Response("Not found", { status: 404 });
  const headers = { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" };
  const h = Number(new URL(req.url).searchParams.get("h"));
  if (h > 0 && h <= 600) {
    const height = Math.round(h);
    const dir = path.join(DATA_DIR, "thumbs");
    const file = path.join(dir, `${Number(id)}-${height}.webp`);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      const meta = await sharp(full).metadata();
      const W = meta.width ?? 1200, H = meta.height ?? 1200;
      const cw = Math.min(W, Math.round(H * 0.6));
      await sharp(full).extract({ left: Math.round((W - cw) / 2), top: 0, width: cw, height: H }).resize({ height }).webp({ quality: 80 }).toFile(file);
    }
    return new Response(fs.readFileSync(file), { headers });
  }
  return new Response(fs.readFileSync(full), { headers });
}
