import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { Contest, Entry, contestProgress, ensureSolo, entryLive, tickContest, slateGames } from "@/lib/dfs";
import { refreshLive } from "@/lib/nba/sync";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  ensureSolo();
  const c0 = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", Number(id));
  if (!u || !c0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c0.mode !== "sim") await refreshLive();
  tickContest(c0);
  const c = one<Contest>("SELECT * FROM dfs_contests WHERE id = ?", c0.id)!;
  const entries = all<Entry>("SELECT e.*, u.name user_name FROM dfs_entries e LEFT JOIN users u ON u.id = e.user_id WHERE e.contest_id = ?", c.id)
    .map((e) => {
      const live = entryLive(c, e);
      return { id: e.id, name: e.user_name ?? `🤖 ${e.bot_name}`, mine: e.user_id === u.id, pts: c.status === "final" ? e.points! : live.pts, remain: live.remain, players: live.players };
    })
    .sort((a, b) => b.pts - a.pts);
  const games = slateGames(c).map((g) => ({ id: g.id, away: g.away, home: g.home, as: g.away_score, hs: g.home_score, state: g.state, detail: g.detail }));
  return NextResponse.json({ status: c.status, mode: c.mode, progress: c.mode === "sim" ? contestProgress(c) : null, entries, games, reward: c.reward_pack ?? null });
}
