import { ForwardIcon, PlayIcon } from "@/components/Icons";
import { MatchupCard } from "@/components/MatchupCard";
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
import { Fpts, FptIcon, PointsKey } from "@/components/Fpts";

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
                  {teams.length < l.max_teams && <ActionButton action={fillCpu.bind(null, l.id)}>Fill with CPU teams</ActionButton>}
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

        {l.draft_status === "done" && (() => {
          const m = matchups.find((x) => me && (x.home_team_id === me.id || x.away_team_id === me.id));
          const sideOf = (tid: number, stored: number | null, final: number) => {
            const t = teams.find((x) => x.id === tid)!;
            const w = teamWeek(l, tid, l.current_week);
            return { w, side: { id: tid, brand: brand.get(tid)!, record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`, score: final && stored != null ? stored : w.score, proj: w.score + w.remain } };
          };
          const h = m && sideOf(m.home_team_id, m.home_score, m.final);
          const a = m && sideOf(m.away_team_id, m.away_score, m.final);
          const live = !!(h && a) && (l.mode === "sim" ? !!l.week_started_at : h.w.score + a.w.score > 0);
          return (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold">{m ? `Your Week ${l.current_week} matchup` : `Week ${l.current_week}`}</h2>
                <div className="flex flex-wrap gap-2">
                  {isCommish && !l.champion_team_id && l.mode === "sim" && (!l.week_started_at
                    ? <ActionButton action={startWeekAction.bind(null, l.id)} className="btn-lime"><PlayIcon /> Kick off Week {l.current_week}</ActionButton>
                    : <ActionButton action={finishWeekNow.bind(null, l.id)} confirm="Skip to final scores and hand out packs?"><ForwardIcon /> Fast-forward to final</ActionButton>)}
                  <Link href={`/league/${l.id}/matchups`} className="btn-ghost">All matchups →</Link>
                </div>
              </div>
              {l.week_started_at && (
                <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full bg-gradient-to-r from-brand to-red-800 transition-all" style={{ width: `${progress * 100}%` }} /></div>
              )}
              {m && h && a && (
                <MatchupCard href={`/league/${l.id}/matchup/${m.id}`} home={h.side} away={a.side} status={m.final ? "final" : live ? "live" : "pre"} winProb={winProb(h.w, a.w)} mine big />
              )}
            </section>
          );
        })()}

        {/* What you're playing for: weekly packs + every point pays Pack Points */}
        {(() => {
          const rate = weekRate();
          const mine = me && l.draft_status === "done" ? earnings(l.id, u.id, l.current_week) : null;
          const rewards = [["Matchup win", l.reward_win, false], ["Matchup loss", l.reward_loss, false], ["Top score", l.reward_top, true], ["Champion", "goat", true]] as const;
          return (
            <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 shadow-xl"
              style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(245,193,92,.22), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(16,185,129,.18), transparent 55%), #1d2433" }}>
              <div className="grid gap-0 xl:grid-cols-[1.5fr_1fr]">
                <div className="p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-600">Every week</p>
                  <h2 className="text-2xl font-black tracking-tight text-white">Win packs, rip slabs</h2>
                  <p className="mt-1 text-sm text-zinc-500">Every manager earns a pack each week. Top scorer and the champ get extra.</p>
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {rewards.map(([label, id, bonus]) => (
                      <Link key={label} href="/packs" className="group flex flex-col items-center rounded-xl bg-black/20 px-1 pb-2 pt-3 text-center ring-1 ring-white/5 transition hover:-translate-y-1 hover:ring-amber-400/40">
                        <PackThumb id={id} height={84} showName={false} />
                        <span className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
                        <span className="text-xs font-bold leading-tight text-white">{PACK_BY_ID[id]?.name}</span>
                        {bonus && <span className="mt-1 rounded-full bg-amber-400 px-1.5 text-[9px] font-black uppercase text-black">Bonus</span>}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-4 border-t border-white/10 bg-black/20 p-5 xl:border-l xl:border-t-0">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600">Points pay</p>
                    <h2 className="text-2xl font-black tracking-tight text-white">Every point pays Pack Points</h2>
                    <p className="mt-1 text-sm text-zinc-500">Every fantasy point your starters score pays you half a Pack Point when their games go final.</p>
                  </div>
                  <PointsKey compact />
                  <div className="rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/30">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pack Points rate</p>
                    <p className="flex items-center gap-2 whitespace-nowrap font-mono text-2xl font-black text-emerald-600"><FptIcon />1 = <CoinIcon />{rate.toFixed(2)}</p>
                    <p className="text-[10px] text-zinc-500">Fixed every week</p>
                  </div>
                  {mine && (
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-black/20 p-2"><p className="text-[10px] uppercase tracking-wider text-zinc-500">This week</p><p className="font-black text-emerald-600"><Coins n={mine.week} /></p></div>
                      <div className="rounded-lg bg-black/20 p-2"><p className="text-[10px] uppercase tracking-wider text-zinc-500">Season</p><p className="font-black text-white"><Coins n={mine.season} /></p></div>
                    </div>
                  )}
                  <Link href="/packs" className="btn-primary w-full">Spend them in the Pack Shop</Link>
                </div>
              </div>
            </section>
          );
        })()}

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
                    <span className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 opacity-15"><TeamBadge brand={b} size={64} ghost /></span>
                    <span className="relative w-5 text-center font-mono text-lg font-black text-white/80">{i + 1}</span>
                    <span className="relative"><TeamBadge brand={b} size={30} /></span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-white">{t.name}</span>
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-white/60">{b.abbr}{mine ? " · You" : ""}</span>
                    </span>
                    <span className="relative text-right">
                      <span className="block font-mono text-sm font-black text-white">{t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""}</span>
                      <span className="block font-mono text-[10px] text-white/70"><Fpts n={t.points_for} /></span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
        {!isCommish && !me && l.draft_status === "pre" && (
          <Link href="/leagues" className="btn-primary w-full">Join this league</Link>
        )}
      </aside>
    </div>
  );
}
