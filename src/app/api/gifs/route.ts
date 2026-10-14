import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

// GIF search uses GIPHY when GIPHY_API_KEY is set in .env.local (free key from developers.giphy.com).
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ gifs: [] }, { status: 401 });
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ gifs: [], disabled: true });
  const q = new URL(req.url).searchParams.get("q") || "football";
  const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=18&rating=pg-13`);
  if (!r.ok) return NextResponse.json({ gifs: [] });
  const j = (await r.json()) as { data: { id: string; images: { fixed_height: { url: string }; fixed_height_small: { url: string } } }[] };
  return NextResponse.json({ gifs: j.data.map((g) => ({ id: g.id, url: g.images.fixed_height.url, preview: g.images.fixed_height_small.url })) });
}
