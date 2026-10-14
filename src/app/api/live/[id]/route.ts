import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { one, Matchup, Team } from "@/lib/db";
import { canView, getLeague, maybeFinalize, teamWeek, weekProgress } from "@/lib/league";
import { winProb } from "@/lib/sim";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await currentUser();
  const m0 = one<Matchup>("SELECT * FROM matchups WHERE id = ?", Number(id));
  const l0 = m0 && getLeague(m0.league_id);
  if (!u || !m0 || !l0 || !canView(l0, u.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  maybeFinalize(l0.id);
  const l = getLeague(l0.id)!;
  const m = one<Matchup>("SELECT * FROM matchups WHERE id = ?", m0.id)!;
  const isCurrent = m.week === l.current_week && !m.final;
  const progress = m.final || m.week < l.current_week ? 1 : isCurrent ? weekProgress(l) : 0;
  const started = m.final || (isCurrent && !!l.week_started_at);
  const side = (teamId: number, stored: number | null) => {
    const t = one<Team>("SELECT * FROM teams WHERE id = ?", teamId)!;
    const w = teamWeek(l, teamId, m.week, progress);
    return {
      id: t.id, name: t.name, record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
      score: m.final && stored != null ? stored : started ? w.score : 0,
      projected: w.projected, remain: started ? w.remain : w.projected, variance: w.variance, players: w.players,
    };
  };
  const home = side(m.home_team_id, m.home_score);
  const away = side(m.away_team_id, m.away_score);
  return NextResponse.json({
    week: m.week, final: !!m.final, started, progress, league: l.name,
    home, away, winProb: m.final ? (home.score > away.score ? 1 : home.score < away.score ? 0 : 0.5) : winProb(home, away),
  });
}
