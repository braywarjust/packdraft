import { LMBadge, TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand, userPresets } from "@/lib/branding";
import Link from "next/link";
import { one, Team } from "@/lib/db";
import { defaultDay, getLeague, standings, teamDays, teamWeek } from "@/lib/league";
import { ROSTER_MAX } from "@/lib/scoring";
import { currentUser } from "@/lib/auth";
import { RosterBoard } from "@/components/RosterBoard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { applyPresetAction, renameTeam, setAutoManage, setSlot } from "../../../actions";
import { AutoManageToggle } from "@/components/AutoManageToggle";
import { Fpts, PointsKey } from "@/components/Fpts";
import { AcqIcon, ACQ_COLOR, MoveCount, TradeIcon, TRADE_COLOR } from "@/components/Currencies";
import { movesLeft } from "@/lib/activity";

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
  // [label, short label for phones, value]
  const stats: [string, string, React.ReactNode][] = [
    ["Record", "W-L", `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`],
    ["Standing", "Rank", rank ? `${ord(rank)} of ${table.length}` : "-"],
    ["This week", "Week", <Fpts key="wk" n={tw.score} iconClass="text-[0.8em]" live />],
    ["Roster", "Roster", `${players.length}/${ROSTER_MAX}`],
  ];
  // Acquisitions and Trades left this matchup: what the league gives every matchup, plus any bought in the League Shop.
  const moves = editable ? movesLeft(l, t.id) : null;
  const moveCells = moves && ([
    ["Acquisitions left", <AcqIcon key="a" className={ACQ_COLOR} />, moves.adds, "Acquisition"],
    ["Trades left", <TradeIcon key="t" className={TRADE_COLOR} />, moves.trades, "Trade"],
  ] as const);

  return (
    <div className="relative space-y-6">
      <AutoRefresh ms={live ? 10000 : 60000} />
      {/* Giant logo watermark behind the whole page */}
      <div className="pointer-events-none absolute -right-24 top-40 -z-0 opacity-[0.06]"><TeamBadge brand={b} size={620} ghost /></div>

      {/* Team banner, condensed into the top of the roster card (Update 4.2): name, manager and every stat as chips. */}
      {(() => {
        const banner = (
          <div className="relative overflow-hidden" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 50%, ${b.alt} 135%)` }}>
            <div className="pointer-events-none absolute -right-8 -top-10 opacity-20"><TeamBadge brand={b} size={170} ghost /></div>
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 2px, transparent 2px 14px)" }} />
            <div className="relative flex items-center gap-3 px-3 pb-2 pt-3 sm:px-4">
              <TeamBadge brand={b} size={48} className="drop-shadow-xl max-sm:!h-10 max-sm:!w-10" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-black leading-tight tracking-tight text-white sm:text-2xl">{t.name}</h2>
                <p className="truncate text-[11px] text-white/80 sm:text-xs">{owner ? <>{owner}{t.user_id === l.commissioner_id && <LMBadge className="ml-1.5" />}</> : "CPU team"} · {b.abbr}{l.draft_status === "done" ? ` · Week ${l.current_week}` : ""}</p>
              </div>
              {!editable && <Link href={`/league/${leagueId}/trades?to=${t.id}`} className="btn shrink-0 bg-[#fff] px-3 py-1.5 text-xs text-black hover:bg-[#e5e7eb]">Propose trade</Link>}
            </div>
            <div className="relative flex flex-wrap gap-1.5 px-3 pb-3 sm:px-4">
              {stats.map(([k, short, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-2 py-1 backdrop-blur max-sm:gap-1 max-sm:px-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 max-sm:tracking-wider"><span className="sm:hidden">{short}</span><span className="max-sm:hidden">{k}</span></span>
                  <span className="font-mono text-xs font-black text-white sm:text-sm">{v}</span>
                </span>
              ))}
              {moveCells?.map(([k, icon, m, item]) => (
                <Link key={k} href={`/league/${leagueId}/shop`} title={`${k} this matchup · buy more ${item}s in the League Shop`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-2 py-1 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/40 active:scale-95 max-sm:gap-1 max-sm:px-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/60 max-sm:hidden">{k.replace(" left", "")}</span>
                  <span className="flex items-center gap-1 text-xs text-white sm:text-sm">{icon}<MoveCount m={m} /></span>
                </Link>
              ))}
            </div>
          </div>
        );
        return (
          <div className="relative">
            {l.draft_status !== "done" || !td ? (
              <section className="card overflow-hidden">{banner}<p className="p-6 text-zinc-500">Rosters fill up during the draft.</p></section>
            ) : (
              <RosterBoard days={td.days} rows={td.rows} totals={td.totals} initialDay={defaultDay(td.days)} editable={editable} brand={b} scoring={l.scoring}
                setSlot={editable ? setSlot.bind(null, leagueId) : undefined} banner={banner}
                header={editable ? <AutoManageToggle key="auto-manager" on={!!t.auto_manage} set={setAutoManage.bind(null, leagueId)} /> : undefined} />
            )}
          </div>
        );
      })()}

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
