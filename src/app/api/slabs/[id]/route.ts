import fs from "node:fs";
import { one } from "@/lib/db";
import { slabFilePath } from "@/lib/slabs";

// Serves slab photos straight from the slab folder (they stay outside the project).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
