import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { canView, getLeague } from "@/lib/league";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  const l = getLeague(Number(id));
  if (!u || !l || !canView(l, u.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const after = Number(new URL(req.url).searchParams.get("after") ?? 0);
  const rows = all<{ id: number; user_id: number | null; kind: string; body: string | null; image_url: string | null; created_at: number; name: string | null; color: string | null }>(
    `SELECT * FROM (SELECT m.*, u.name, u.color FROM messages m LEFT JOIN users u ON u.id = m.user_id
     WHERE m.league_id = ? AND m.id > ? ORDER BY m.id DESC LIMIT 150) ORDER BY id`, l.id, after);
  return NextResponse.json({ me: u.id, messages: rows });
}
