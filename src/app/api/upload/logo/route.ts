import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { currentUser } from "@/lib/auth";
import { DATA_DIR } from "@/lib/db";

/** Team logo upload: transparent PNG only. Trims empty margins and caps it at 512px. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.type !== "image/png") return NextResponse.json({ error: "Logos must be a PNG with a transparent background" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Max 8 MB" }, { status: 400 });
  const input = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(input).metadata();
    const alphaMin = meta.hasAlpha ? (await sharp(input).stats()).channels[3]?.min ?? 255 : 255;
    if (alphaMin === 255) return NextResponse.json({ error: "That PNG has no transparent background. Export it with transparency and try again." }, { status: 400 });
    const out = await sharp(input).trim({ threshold: 1 }).resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const dir = path.join(DATA_DIR, "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.randomBytes(12).toString("hex")}.png`;
    fs.writeFileSync(path.join(dir, name), out);
    return NextResponse.json({ url: `/api/uploads/${name}` });
  } catch {
    return NextResponse.json({ error: "Couldn't read that image" }, { status: 400 });
  }
}
