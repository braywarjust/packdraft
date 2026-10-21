import { ensureBranding, teamBrand } from "@/lib/branding";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one, Matchup, Team } from "@/lib/db";
import { canView, defaultDay, getLeague, tickLeague, teamDays, teamWeek, weekProgress, weekRange } from "@/lib/league";
import { all } from "@/lib/db";
import { refreshLive } from "@/lib/nba/sync";
import { winProb } from "@/lib/sim";
import { dayLabel } from "@/lib/nba/espn";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  const m0 = one<Matchup>("SELECT * FROM matchups WHERE id = ?", Number(id));
  const l0 = m0 && getLeague(m0.league_id);
  if (!u || !m0 || !l0 || !canView(l0, u.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (l0.mode !== "sim") await refreshLive();
  tickLeague(l0.id);
  const l = getLeague(l0.id)!;
  const m = one<Matchup>("SELECT * FROM matchups WHERE id = ?", m0.id)!;
  const side = (teamId: number, stored: number | null) => {
    ensureBranding();
    const t = one<Team>("SELECT * FROM teams WHERE id = ?", teamId)!;
    const w = teamWeek(l, teamId, m.week);
    const d = teamDays(l, teamId, m.week);
    const owner = t.user_id ? one<{ name: string }>("SELECT name FROM users WHERE id = ?", t.user_id)?.name ?? null : null;
    return {
      id: t.id, name: t.name, brand: teamBrand(t), record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`, owner,
      score: m.final && stored != null ? stored : w.score, projected: w.projected, remain: w.remain, variance: w.variance, players: w.players,
      days: d.rows, totals: d.totals, dayList: d.days,
    };
  };
  const home = side(m.home_team_id, m.home_score);
  const away = side(m.away_team_id, m.away_score);
  const [s, e] = l.mode === "sim" ? ["", ""] : weekRange(l, m.week);
  const live = home.players.concat(away.players).some((p) => p.now?.state === "in");
  // The week's other matchups, for the strip of league scores.
  const others = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ? ORDER BY id", l.id, m.week).map((x) => {
    const sd = (tid: number, stored: number | null) => {
      const t = one<Team>("SELECT * FROM teams WHERE id = ?", tid)!;
      return { brand: teamBrand(t), score: x.id === m.id ? (tid === home.id ? home.score : away.score) : x.final && stored != null ? stored : teamWeek(l, tid, m.week).score };
    };
    return { id: x.id, home: sd(x.home_team_id, x.home_score), away: sd(x.away_team_id, x.away_score) };
  });
  return NextResponse.json({
    week: m.week, final: !!m.final, live, mode: l.mode, league: l.name,
    range: l.mode === "sim" ? null : `${dayLabel(s)} – ${dayLabel(e)}`,
    progress: l.mode === "sim" && m.week === l.current_week ? weekProgress(l) : null,
    home, away, others, leagueId: l.id,
    mine: one<{ id: number }>("SELECT id FROM teams WHERE league_id = ? AND user_id = ?", l.id, u.id)?.id ?? null,
    days: home.dayList, day: defaultDay(home.dayList),
    winProb: m.final ? (home.score > away.score ? 1 : home.score < away.score ? 0 : 0.5) : winProb(home, away),
  });
}
