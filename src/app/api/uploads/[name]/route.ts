import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/db";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-f0-9]{24}\.(png|jpg|gif|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  const file = path.join(DATA_DIR, "uploads", name);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": MIME[name.split(".")[1]], "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
