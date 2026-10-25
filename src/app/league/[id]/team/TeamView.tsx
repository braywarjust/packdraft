import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand, userPresets } from "@/lib/branding";
import Link from "next/link";
import { one, Team } from "@/lib/db";
import { defaultDay, getLeague, standings, teamDays, teamWeek } from "@/lib/league";
import { currentUser } from "@/lib/auth";
import { RosterBoard } from "@/components/RosterBoard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { applyPresetAction, dropPlayer, renameTeam, setAutoManage, setSlot } from "../../../actions";
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
  const me = editable ? await currentUser() : null;
  const presets = me ? userPresets(me.id) : [];
  const b = teamBrand(t);
  const td = l.draft_status === "done" ? teamDays(l, t.id, l.current_week) : null;
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
      <section className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 45%, ${b.alt} 130%)` }}>
        <div className="pointer-events-none absolute -right-10 -top-12 opacity-25"><TeamBadge brand={b} size={240} ghost /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <TeamBadge brand={b} size={72} className="drop-shadow-2xl max-sm:!h-14 max-sm:!w-14" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.25em] text-white/70 sm:text-xs sm:tracking-[0.35em]">{b.abbr} · {l.name}</p>
            <h2 className="mt-0.5 text-xl font-black leading-none tracking-tight text-white [overflow-wrap:anywhere] sm:text-3xl">{t.name}</h2>
            <p className="mt-1 text-xs text-white/80 sm:text-sm">{owner ? `Managed by ${owner}` : "CPU team"}{l.draft_status === "done" ? ` · Week ${l.current_week}` : ""}</p>
          </div>
          {!editable && <Link href={`/league/${leagueId}/trades?to=${t.id}`} className="btn bg-[#fff] text-black hover:bg-[#e5e7eb]">Propose trade</Link>}
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20 sm:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k} className="min-w-0 bg-black/45 px-3 py-1.5 backdrop-blur sm:px-4 sm:py-2">
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="truncate font-mono text-sm font-black text-white sm:text-base">{v}</p>
            </div>
          ))}
        </div>
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${b.alt}, ${b.color}, ${b.alt})` }} />
      </section>

      <div className="relative">
        {l.draft_status !== "done" || !td ? (
          <p className="card p-6 text-zinc-500">Rosters fill up during the draft.</p>
        ) : (
          <RosterBoard days={td.days} rows={td.rows} totals={td.totals} initialDay={defaultDay(td.days)} editable={editable} brand={b}
            setSlot={editable ? setSlot.bind(null, leagueId) : undefined} drop={editable ? dropPlayer.bind(null, leagueId) : undefined}
            header={editable ? <AutoManageToggle key="auto-manager" on={!!t.auto_manage} set={setAutoManage.bind(null, leagueId)} /> : undefined} />
        )}
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
      <p className="relative text-xs text-zinc-400">Daily lineups. Each player locks at his own tip-off.</p>
    </div>
  );
}
