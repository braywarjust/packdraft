import { BoltIcon } from "@/components/Icons";
import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand, userPresets } from "@/lib/branding";
import Link from "next/link";
import { one, Matchup, Team } from "@/lib/db";
import { defaultDay, getLeague, standings, teamDays, teamWeek } from "@/lib/league";
import { currentUser } from "@/lib/auth";
import { TeamCourt } from "@/components/TeamCourt";
import { RosterBoard } from "@/components/RosterBoard";
import { LineupViews } from "@/components/LineupViews";
import { AutoRefresh } from "@/components/AutoRefresh";
import { applyPresetAction, autoSet, dropPlayer, renameTeam, setAutoManage, setSlot } from "../../../actions";
import { AutoManageToggle } from "@/components/AutoManageToggle";
import { Fpts, PointsKey } from "@/components/Fpts";

export async function TeamView({ leagueId, teamId, editable }: { leagueId: number; teamId: number; editable: boolean }) {
  const l = getLeague(leagueId)!;
  ensureBranding();
  const t = one<Team>("SELECT * FROM teams WHERE id = ? AND league_id = ?", teamId, leagueId);
  if (!t) return <p>Team not found.</p>;
  const tw = teamWeek(l, t.id, l.current_week);
  const players = tw.players;
  const live = players.some((p) => p.now?.state === "in");
  // Slab boosts: who can still be boosted for his next game, and what each of those days is already boosted with.
  const me = editable ? await currentUser() : null;
  const presets = me ? userPresets(me.id) : [];
  const b = teamBrand(t);
  const td = l.draft_status === "done" ? teamDays(l, t.id, l.current_week) : null;
  // Current and next matchup boxes (ESPN's team header).
  const box = (week: number) => {
    const m = one<Matchup>("SELECT * FROM matchups WHERE league_id = ? AND week = ? AND (home_team_id = ? OR away_team_id = ?)", l.id, week, t.id, t.id);
    if (!m) return null;
    const side = (tid: number, stored: number | null) => {
      const x = one<Team>("SELECT * FROM teams WHERE id = ?", tid)!;
      const score = m.final && stored != null ? stored : week === l.current_week ? (tid === t.id ? tw.score : teamWeek(l, tid, week).score) : 0;
      return { id: tid, brand: teamBrand(x), score };
    };
    return { m, sides: [side(m.home_team_id, m.home_score), side(m.away_team_id, m.away_score)] };
  };
  const boxes = l.draft_status === "done" ? ([["Current matchup", box(l.current_week)], ["Next matchup", box(l.current_week + 1)]] as const).filter(([, x]) => x) : [];
  const table = standings(l.id);
  const rank = table.findIndex((x) => x.id === t.id) + 1;
  const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th"}`;
  const owner = t.user_id ? one<{ name: string }>("SELECT name FROM users WHERE id = ?", t.user_id)?.name : null;
  const stats: [string, React.ReactNode][] = [
    ["Record", `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`],
    ["Standing", rank ? `${ord(rank)} of ${table.length}` : "-"],
    ["Points for", <Fpts key="pf" n={t.points_for} iconClass="text-[0.8em]" live />],
    ["This week", <Fpts key="wk" n={tw.score} iconClass="text-[0.8em]" live />],
    ["FAAB", `$${t.faab}`],
    ["Roster", `${players.length}/13`],
  ];

  return (
    <div className="relative space-y-6">
      <AutoRefresh ms={live ? 10000 : 60000} />
      {/* Giant logo watermark behind the whole page */}
      <div className="pointer-events-none absolute -right-24 top-40 -z-0 opacity-[0.06]"><TeamBadge brand={b} size={620} ghost /></div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 45%, ${b.alt} 130%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-20 opacity-25"><TeamBadge brand={b} size={420} ghost /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-4 p-5 sm:gap-6 sm:p-8">
          <TeamBadge brand={b} size={148} className="drop-shadow-2xl max-sm:!h-24 max-sm:!w-24" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.25em] text-white/70 sm:text-xs sm:tracking-[0.35em]">{b.abbr} · {l.name}</p>
            <h2 className="mt-1 text-[1.7rem] font-black leading-none tracking-tight text-white [overflow-wrap:anywhere] sm:text-5xl">{t.name}</h2>
            <p className="mt-2 text-sm text-white/80">{owner ? `Managed by ${owner}` : "CPU team"}{l.draft_status === "done" ? ` · Week ${l.current_week}` : ""}</p>
          </div>
          {!editable && <Link href={`/league/${leagueId}/trades?to=${t.id}`} className="btn bg-[#fff] text-black hover:bg-[#e5e7eb]">Propose trade</Link>}
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20 sm:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-0 bg-black/45 px-3 py-2.5 backdrop-blur sm:px-4 sm:py-3">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="truncate font-mono text-base font-black text-white sm:text-xl">{v}</p>
            </div>
          ))}
        </div>
        <div className="h-2" style={{ background: `linear-gradient(90deg, ${b.alt}, ${b.color}, ${b.alt})` }} />
      </section>

      {boxes.length > 0 && (
        <div className="relative grid gap-3 sm:grid-cols-2">
          {boxes.map(([label, x]) => (
            <Link key={label} href={`/league/${leagueId}/matchup/${x!.m.id}`} className="card block p-3 transition hover:border-brand/50">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}{x!.m.final ? " · Final" : ""}</p>
              {x!.sides.map((sd) => (
                <div key={sd.id} className="flex items-center gap-2.5 py-1">
                  <TeamBadge brand={sd.brand} size={28} />
                  <span className={`min-w-0 flex-1 truncate text-sm ${sd.id === t.id ? "font-black text-white" : "font-semibold text-white/70"}`}>{sd.brand.name}</span>
                  <span className="font-mono text-lg font-black text-white">{Math.round(sd.score * 10) / 10}</span>
                </div>
              ))}
            </Link>
          ))}
        </div>
      )}

      {editable && td && <div className="relative"><AutoManageToggle on={!!t.auto_manage} set={setAutoManage.bind(null, leagueId)} /></div>}

      <div className="relative">
        {l.draft_status !== "done" || !td ? (
          <p className="card p-6 text-zinc-500">Rosters fill up during the draft.</p>
        ) : (() => {
          const actions = {
            setSlot: editable ? setSlot.bind(null, leagueId) : undefined,
            autoSet: editable ? autoSet.bind(null, leagueId) : undefined,
            drop: editable ? dropPlayer.bind(null, leagueId) : undefined,
          };
          return (
            <LineupViews
              board={<RosterBoard key="box" days={td.days} rows={td.rows} totals={td.totals} initialDay={defaultDay(td.days)} players={players} editable={editable} brand={b} {...actions} />}
              court={<TeamCourt key="court" players={players} editable={editable} brand={b} courtOnly {...actions} />}
            />
          );
        })()}
      </div>

      {editable && (
        <details className="card relative p-4">
          <summary className="cursor-pointer text-sm font-semibold">Team branding &amp; name</summary>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {presets.length > 0 && (
              <form action={async (f) => { "use server"; await applyPresetAction(leagueId, Number(f.get("preset_id"))); }} className="flex gap-2">
                <select name="preset_id" defaultValue={t.preset_id ?? presets[0].id} className="input w-52">{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <button className="btn-ghost">Use this team&apos;s branding</button>
              </form>
            )}
            <form action={async (f) => { "use server"; await renameTeam(leagueId, f); }} className="flex gap-2">
              <input name="name" defaultValue={t.name} className="input w-48" />
              <button className="btn-ghost">Rename</button>
            </form>
            <Link href="/teams" className="text-xs text-brand underline">Edit teams in Team Studio</Link>
          </div>
        </details>
      )}
      <PointsKey className="relative" />
      <p className="relative text-xs text-zinc-400"><BoltIcon className="text-fpts" /> Tap a player to equip one of his slabs on his next game. Boost first, then multiplier. Locks at tip-off.</p>
      <p className="relative text-xs text-zinc-400">Daily lineups. Each player locks at his own tip-off.</p>
    </div>
  );
}
