import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { Contest, Entry, contestProgress, entryLive, maybeSettle } from "@/lib/dfs";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  const c0 = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", Number(id));
  if (!u || !c0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  maybeSettle(c0);
  const c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", c0.id)!;
  const progress = c.status === "final" ? 1 : contestProgress(c);
  const entries = all<Entry>("SELECT e.*, u.name user_name FROM dfs_entries e LEFT JOIN users u ON u.id = e.user_id WHERE e.contest_id = ?", c.id)
    .map((e) => {
      const live = entryLive(c, e, progress);
      return { id: e.id, name: e.user_name ?? `🤖 ${e.bot_name}`, mine: e.user_id === u.id, pts: c.status === "final" ? e.points! : live.pts, remain: live.remain, players: live.players, rank: e.rank };
    })
    .sort((a, b) => b.pts - a.pts);
  return NextResponse.json({ status: c.status, progress, entries });
}
