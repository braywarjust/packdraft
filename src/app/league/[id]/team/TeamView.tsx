import { BoltIcon } from "@/components/Icons";
import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand, userPresets } from "@/lib/branding";
import Link from "next/link";
import { one, Team } from "@/lib/db";
import { boostableGame, getLeague, roster, standings, teamWeek } from "@/lib/league";
import { boostSlabs, equippedSlabCards, teamBoosts } from "@/lib/boost";
import { currentUser } from "@/lib/auth";
import { TeamCourt } from "@/components/TeamCourt";
import { AutoRefresh } from "@/components/AutoRefresh";
import { applyPresetAction, autoSet, boostPlayer, dropPlayer, renameTeam, setSlot, unboostPlayer } from "../../../actions";
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
  // Slab equips: players with a game left this week who have a slab of theirs to equip (or one already on).
  const boosts = teamBoosts(t.id);
  const mySlabs = me ? boostSlabs(me.id) : [];
  const onCards = me ? new Map(equippedSlabCards(me.id).map((s) => [s.cardId, s])) : new Map();
  const boostable = me && l.draft_status === "done" && !l.champion_team_id
    ? roster(t.id).flatMap((p) => {
        const g = boostableGame(l, p);
        if (!g) return [];
        const eq = boosts.get(`${p.id}|${g.key}`);
        const equipped = eq ? onCards.get(eq.card_id) ?? null : null;
        if (!equipped && !mySlabs.some((s) => s.playerId === p.id)) return [];
        return [{ playerId: p.id, dayKey: g.key, day: g.label, equipped }];
      })
    : [];

  const b = teamBrand(t);
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

      <div className="relative">
        {l.draft_status !== "done" ? (
          <p className="card p-6 text-zinc-500">Rosters fill up during the draft.</p>
        ) : (
          <TeamCourt
            players={players}
            editable={editable}
            brand={b}
            setSlot={editable ? setSlot.bind(null, leagueId) : undefined}
            autoSet={editable ? autoSet.bind(null, leagueId) : undefined}
            drop={editable ? dropPlayer.bind(null, leagueId) : undefined}
            boost={editable && me ? {
              slabs: mySlabs, boostable,
              set: boostPlayer.bind(null, leagueId), clear: unboostPlayer.bind(null, leagueId),
            } : undefined}
          />
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
      <p className="relative text-xs text-zinc-400"><BoltIcon className="text-fpts" /> Slab equips: if you have a slab of one of your players, equip it on his next game and his fantasy points for that game are multiplied by the slab&apos;s stamp (1.10x to 2.00x). It locks at tip-off, only counts if he starts, and the slab is used up when the game ends.</p>
      <p className="relative text-xs text-zinc-400">Lineups are daily. Each player locks at his own tip-off, so you can still swap guys who play later tonight. Points count for whatever slot a player was in when his game started.</p>
    </div>
  );
}
