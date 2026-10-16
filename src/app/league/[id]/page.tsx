import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, Matchup } from "@/lib/db";
import { getLeague, leagueTeams, standings, teamWeek, userTeam, weekProgress, weekRange } from "@/lib/league";
import { dayLabel } from "@/lib/nba/espn";
import { winProb } from "@/lib/sim";
import { PACK_BY_ID } from "@/lib/packs";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { fillCpu, finishWeekNow, startDraftAction, startWeekAction } from "../../actions";

export default async function LeagueHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  const teams = leagueTeams(l.id);
  const me = userTeam(l.id, u.id);
  const isCommish = l.commissioner_id === u.id;
  const owners = new Map(all<{ id: number; name: string; color: string }>("SELECT id, name, color FROM users").map((x) => [x.id, x]));
  const progress = weekProgress(l);
  const matchups = all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ?", l.id, l.current_week);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const lastWeek = l.current_week > 1 ? all<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ? AND final = 1", l.id, l.current_week - 1) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {l.draft_status === "done" && <AutoRefresh ms={l.week_started_at ? 4000 : 30000} />}
      <div className="space-y-6 lg:col-span-2">
        {l.draft_status === "pre" && (
          <section className="card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Waiting room · {teams.length}/{l.max_teams} teams</h2>
                <p className="text-sm text-zinc-500">Invite code <span className="rounded bg-ink px-2 py-0.5 font-mono text-lg font-bold tracking-widest text-brand">{l.invite_code}</span></p>
              </div>
              {isCommish && (
                <div className="flex flex-wrap gap-2">
                  {teams.length < l.max_teams && <ActionButton action={fillCpu.bind(null, l.id)}>🤖 Fill with CPU teams</ActionButton>}
                  <ActionButton action={startDraftAction.bind(null, l.id)} className="btn-lime" confirm="Start the live draft now?">Start draft</ActionButton>
                </div>
              )}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {teams.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl bg-ink/60 px-3 py-2 text-sm">
                  <span className="h-3 w-3 rounded-full" style={{ background: t.user_id ? owners.get(t.user_id)?.color : "#475569" }} />
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-zinc-400">{t.is_cpu ? "CPU (a friend can take this seat)" : owners.get(t.user_id!)?.name}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-400">CPU teams draft and set lineups automatically. When a friend joins with the code they take over a CPU seat.</p>
          </section>
        )}

        {l.draft_status === "live" && (
          <Link href={`/league/${l.id}/draft`} className="card flex items-center justify-between bg-gradient-to-r from-rose-600/30 to-transparent p-5 hover:border-rose-400/60">
            <div><p className="text-xs font-bold uppercase tracking-widest text-red-600">● Live</p><p className="text-xl font-black">The draft is happening right now</p></div>
            <span className="btn-lime">Enter draft room →</span>
          </Link>
        )}

        {l.draft_status === "done" && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Week {l.current_week} matchups</h2>
              {isCommish && !l.champion_team_id && l.mode === "sim" && (
                <div className="flex gap-2">
                  {!l.week_started_at ? (
                    <ActionButton action={startWeekAction.bind(null, l.id)} className="btn-lime">▶ Kick off Week {l.current_week}</ActionButton>
                  ) : (
                    <ActionButton action={finishWeekNow.bind(null, l.id)} confirm="Skip to final scores and hand out packs?">⏩ Fast-forward to final</ActionButton>
                  )}
                </div>
              )}
            </div>
            {l.mode !== "sim" && !l.champion_team_id && (
              <p className="text-sm text-zinc-500">
                Real NBA games · {(() => { const [s, e] = weekRange(l, l.current_week); return `${dayLabel(s)} – ${dayLabel(e)}`; })()}. Set your lineup daily; each player locks at his tip-off. Scores update live during games.
              </p>
            )}
            {l.week_started_at && (
              <div className="h-2 overflow-hidden rounded-full bg-panel2">
                <div className="h-full bg-gradient-to-r from-brand to-red-800 transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {l.mode === "sim" && !l.week_started_at && !l.champion_team_id && (
              <p className="text-sm text-zinc-500">Simulated league: set your lineup, then the commish tips off the week. Every team plays 3–4 sim games over {l.sim_minutes} min.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {matchups.map((m) => {
                const h = teamWeek(l, m.home_team_id, l.current_week);
                const a = teamWeek(l, m.away_team_id, l.current_week);
                const live = l.mode === "sim" ? !!l.week_started_at : h.score + a.score > 0;
                const wp = winProb(h, a);
                const mine = me && (m.home_team_id === me.id || m.away_team_id === me.id);
                return (
                  <Link key={m.id} href={`/league/${l.id}/matchup/${m.id}`} className={`card block p-4 hover:border-brand/60 ${mine ? "border-brand/40" : ""}`}>
                    {[{ t: m.home_team_id, s: h }, { t: m.away_team_id, s: a }].map(({ t, s }) => (
                      <div key={t} className="flex items-center justify-between py-1">
                        <span className="truncate font-semibold">{teamName.get(t)}</span>
                        <span className="font-mono text-lg font-bold">{live ? s.score.toFixed(1) : <span className="text-sm text-zinc-500">proj {(s.score + s.remain).toFixed(1)}</span>}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-panel2">
                      <div className="bg-brand" style={{ width: `${wp * 100}%` }} />
                      <div className="flex-1 bg-zinc-800" />
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">Win prob {Math.round(wp * 100)}% – {Math.round((1 - wp) * 100)}%</p>
                  </Link>
                );
              })}
            </div>
            {lastWeek.length > 0 && (
              <details className="card p-4">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-700">Week {l.current_week - 1} results</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {lastWeek.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>{teamName.get(m.home_team_id)} vs {teamName.get(m.away_team_id)}</span>
                      <span className="font-mono">{m.home_score?.toFixed(1)} – {m.away_score?.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {l.champion_team_id && (
          <div className="card bg-gradient-to-r from-amber-500/30 to-transparent p-6 text-center">
            <p className="text-4xl">🏆</p>
            <p className="text-2xl font-black">{teamName.get(l.champion_team_id)} are champions!</p>
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="card p-4">
          <h3 className="mb-3 font-bold">Standings</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-zinc-400"><tr><th className="text-left">Team</th><th>W-L</th><th className="text-right">PF</th></tr></thead>
            <tbody>
              {standings(l.id).map((t, i) => (
                <tr key={t.id} className={`border-t border-line/60 ${me?.id === t.id ? "text-brand" : ""}`}>
                  <td className="py-1.5"><span className="mr-2 text-zinc-400">{i + 1}</span>
                    <Link href={`/league/${l.id}/team/${t.id}`} className="hover:underline">{t.name}</Link></td>
                  <td className="text-center">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</td>
                  <td className="text-right font-mono">{t.points_for.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 font-bold">🎰 Weekly pack rewards</h3>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between"><span>Matchup win</span><span className="font-semibold">{PACK_BY_ID[l.reward_win]?.name}</span></li>
            <li className="flex justify-between"><span>Matchup loss</span><span className="font-semibold">{PACK_BY_ID[l.reward_loss]?.name}</span></li>
            <li className="flex justify-between"><span>Top score of the week</span><span className="font-semibold">+ {PACK_BY_ID[l.reward_top]?.name}</span></li>
            <li className="flex justify-between"><span>League champion</span><span className="font-semibold">+ GOAT Pack</span></li>
          </ul>
        </div>
        {!isCommish && !me && l.draft_status === "pre" && (
          <Link href="/leagues" className="btn-primary w-full">Join this league</Link>
        )}
      </aside>
    </div>
  );
}
