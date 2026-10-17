import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { currentUser } from "@/lib/auth";
import { DATA_DIR } from "@/lib/db";

/** Profile photo upload: any common image, cropped to a centred 512px square. */
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "Log in first" }, { status: 401 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) return NextResponse.json({ error: "PNG, JPG, WEBP or GIF only" }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Max 12 MB" }, { status: 400 });
  try {
    const out = await sharp(Buffer.from(await file.arrayBuffer())).rotate().resize(512, 512, { fit: "cover", position: "attention" }).webp({ quality: 88 }).toBuffer();
    const dir = path.join(DATA_DIR, "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${crypto.randomBytes(12).toString("hex")}.webp`;
    fs.writeFileSync(path.join(dir, name), out);
    return NextResponse.json({ url: `/api/uploads/${name}` });
  } catch {
    return NextResponse.json({ error: "Couldn't read that image" }, { status: 400 });
  }
}
