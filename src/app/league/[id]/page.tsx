import { PackThumb } from "@/components/PackThumb";
import { TeamBadge, TeamName } from "@/components/TeamBadge";
import { ensureBranding, teamBrand } from "@/lib/branding";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { all, Matchup } from "@/lib/db";
import { getLeague, leagueTeams, standings, teamWeek, userTeam, weekProgress, weekRange } from "@/lib/league";
import { dayLabel } from "@/lib/nba/espn";
import { winProb } from "@/lib/sim";
import { PACK_BY_ID } from "@/lib/packs";
import { earnings, weekRate } from "@/lib/economy";
import { CoinIcon, Coins } from "@/components/Coins";
import { ActionButton } from "@/components/ActionButton";
import { AutoRefresh } from "@/components/AutoRefresh";
import { fillCpu, finishWeekNow, startDraftAction, startWeekAction } from "../../actions";

export default async function LeagueHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser();
  const l = getLeague(Number(id))!;
  ensureBranding();
  const teams = leagueTeams(l.id);
  const brand = new Map(teams.map((t) => [t.id, teamBrand(t)]));
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
                  <TeamName brand={brand.get(t.id)!} size={26} nameClass="font-semibold" />
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
                        <TeamName brand={brand.get(t)!} size={24} nameClass="font-semibold" />
                        <span className="font-mono text-lg font-bold">{live ? s.score.toFixed(1) : <span className="text-sm text-zinc-500">proj {(s.score + s.remain).toFixed(1)}</span>}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-panel2">
                      <div className="bg-brand" style={{ width: `${wp * 100}%` }} />
                      <div className="flex-1 bg-accent" />
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
                      <span className="flex min-w-0 items-center gap-2"><TeamName brand={brand.get(m.home_team_id)!} size={18} /> <span className="text-zinc-400">vs</span> <TeamName brand={brand.get(m.away_team_id)!} size={18} /></span>
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
            <div className="mb-2 flex justify-center"><TeamBadge brand={brand.get(l.champion_team_id)!} size={72} /></div>
            <p className="text-2xl font-black">{teamName.get(l.champion_team_id)} are champions!</p>
          </div>
        )}
      </div>

      <aside className="space-y-6">
        <div className="card p-4">
          <h3 className="mb-3 flex items-center justify-between font-bold">Standings <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">W-L · PF</span></h3>
          <ol className="space-y-1.5">
            {standings(l.id).map((t, i) => {
              const b = brand.get(t.id) ?? teamBrand(t);
              const mine = me?.id === t.id;
              return (
                <li key={t.id}>
                  <Link href={`/league/${l.id}/team/${t.id}`}
                    className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl py-2 pl-3 pr-3 transition hover:brightness-125 ${mine ? "ring-2 ring-white/60" : "ring-1 ring-white/5"}`}
                    style={{ background: `linear-gradient(100deg, ${b.color}cc 0%, ${b.color}55 45%, ${b.alt}22 100%)` }}>
                    <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: `linear-gradient(${b.color}, ${b.alt})` }} />
                    <span className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 opacity-15"><TeamBadge brand={b} size={64} /></span>
                    <span className="relative w-5 text-center font-mono text-lg font-black text-white/80">{i + 1}</span>
                    <span className="relative"><TeamBadge brand={b} size={30} /></span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{t.name}</span>
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-white/60">{b.abbr}{mine ? " · You" : ""}</span>
                    </span>
                    <span className="relative text-right">
                      <span className="block font-mono text-sm font-black text-white">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</span>
                      <span className="block font-mono text-[10px] text-white/70">{t.points_for.toFixed(1)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
        {l.draft_status === "done" && (() => {
          const rate = weekRate(l.id, l.current_week);
          const mine = me ? earnings(l.id, u.id, l.current_week) : null;
          return (
            <div className="card p-4">
              <h3 className="mb-1 font-bold">Points pay Pack Points</h3>
              <p className="mb-3 text-xs text-zinc-500">
                Every fantasy point your starters score pays you Pack Points when their game goes final.
                This week 1 point = <span className="inline-flex items-center gap-1 font-semibold text-emerald-600"><CoinIcon />{rate.toFixed(2)}</span> Pack Points, set by the slab market.
              </p>
              {mine && (
                <ul className="space-y-1.5 text-sm">
                  <li className="flex justify-between"><span>Earned this week</span><span className="font-semibold text-emerald-600"><Coins n={mine.week} /></span></li>
                  <li className="flex justify-between"><span>Earned this season</span><span className="font-semibold"><Coins n={mine.season} /></span></li>
                </ul>
              )}
            </div>
          );
        })()}
        <div className="card p-4">
          <h3 className="mb-2 font-bold">Weekly pack rewards</h3>
          <ul className="space-y-2 text-sm">
            {([["Matchup win", l.reward_win, ""], ["Matchup loss", l.reward_loss, ""], ["Top score", l.reward_top, "+ "], ["Champion", "goat", "+ "]] as const).map(([label, id, plus]) => (
              <li key={label} className="grid grid-cols-[minmax(0,1fr)_1.75rem_6.75rem] items-center gap-2.5">
                <span className="leading-tight text-zinc-500">{label}{plus && <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400">Bonus</span>}</span>
                <span className="flex justify-center"><PackThumb id={id} height={40} showName={false} /></span>
                <span className="font-semibold leading-tight">{PACK_BY_ID[id]?.name}</span>
              </li>
            ))}
          </ul>
        </div>
        {!isCommish && !me && l.draft_status === "pre" && (
          <Link href="/leagues" className="btn-primary w-full">Join this league</Link>
        )}
      </aside>
    </div>
  );
}
