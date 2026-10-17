import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, Matchup } from "@/lib/db";
import { getLeague, leagueTeams, teamWeek, userTeam, weekProgress, weekRange } from "@/lib/league";
import { ensureBranding, teamBrand } from "@/lib/branding";
import { dayLabel } from "@/lib/nba/espn";
import { winProb } from "@/lib/sim";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MatchupCard, type MatchSide } from "@/components/MatchupCard";
import { finishWeekNow, startWeekAction } from "../../../actions";

export default async function MatchupsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string }> }) {
  const { id } = await params;
  const { week: wq } = await searchParams;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  ensureBranding();
  if (l.draft_status !== "done") return <p className="card p-6 text-zinc-500">Matchups start once the draft is done.</p>;
  const week = Math.min(l.current_week, Math.max(1, Number(wq) || l.current_week));
  const current = week === l.current_week && !l.champion_team_id;
  const teams = new Map(leagueTeams(l.id).map((t) => [t.id, t]));
  const me = userTeam(l.id, u.id);
  const isCommish = l.commissioner_id === u.id;
  const progress = weekProgress(l);
  const ms = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ?", l.id, week)
    .sort((a, b) => Number(me && (b.home_team_id === me.id || b.away_team_id === me.id)) - Number(me && (a.home_team_id === me.id || a.away_team_id === me.id)));
  const cards = ms.map((m) => {
    const h = teamWeek(l, m.home_team_id, week), a = teamWeek(l, m.away_team_id, week);
    const side = (tid: number, w: typeof h, stored: number | null): MatchSide => {
      const t = teams.get(tid)!;
      return { id: tid, brand: teamBrand(t), record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`, score: m.final && stored != null ? stored : w.score, proj: w.score + w.remain };
    };
    const live = !m.final && (l.mode === "sim" ? !!l.week_started_at && current : h.players.concat(a.players).some((p) => p.now?.state !== "pre" && p.now != null) && h.score + a.score > 0);
    const status: "pre" | "live" | "final" = m.final ? "final" : live ? "live" : "pre";
    return { m, home: side(m.home_team_id, h, m.home_score), away: side(m.away_team_id, a, m.away_score), status, wp: m.final ? 0.5 : winProb(h, a), mine: !!me && (m.home_team_id === me.id || m.away_team_id === me.id) };
  });
  const anyLive = cards.some((c) => c.status === "live");

  return (
    <div className="space-y-5">
      {current && <AutoRefresh ms={anyLive ? 5000 : 30000} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Week {week} matchups</h2>
          <p className="text-sm text-zinc-500">
            {l.mode === "sim" ? (current ? (l.week_started_at ? "Simulated week in progress." : "Simulated week: the commish tips it off.") : "Final scores.")
              : (() => { const [s, e] = weekRange(l, week); return `${dayLabel(s)} – ${dayLabel(e)}${current ? " · scores update live during games" : " · final"}`; })()}
          </p>
        </div>
        {isCommish && current && l.mode === "sim" && (
          !l.week_started_at
            ? <ActionButton action={startWeekAction.bind(null, l.id)} className="btn-lime">▶ Kick off Week {l.current_week}</ActionButton>
            : <ActionButton action={finishWeekNow.bind(null, l.id)} confirm="Skip to final scores and hand out packs?">⏩ Fast-forward to final</ActionButton>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {Array.from({ length: l.current_week }, (_, i) => i + 1).map((w) => (
          <Link key={w} href={`/league/${l.id}/matchups?week=${w}`} className={`tab shrink-0 ${w === week ? "tab-active" : ""}`}>Wk {w}</Link>
        ))}
      </div>

      {current && l.week_started_at && (
        <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full bg-gradient-to-r from-brand to-red-800 transition-all" style={{ width: `${progress * 100}%` }} /></div>
      )}

      <div className="grid gap-4">
        {cards.map((c, i) => (
          <MatchupCard key={c.m.id} href={`/league/${l.id}/matchup/${c.m.id}`} home={c.home} away={c.away} status={c.status} winProb={c.wp} mine={c.mine} big={i === 0 && c.mine} />
        ))}
      </div>
    </div>
  );
}
