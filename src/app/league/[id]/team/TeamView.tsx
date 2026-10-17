import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand, userPresets } from "@/lib/branding";
import { Coins } from "@/components/Coins";
import Link from "next/link";
import { one, Team } from "@/lib/db";
import { boostableGame, getLeague, roster, standings, teamWeek } from "@/lib/league";
import { OWN_PLAYER_BONUS, boostSlabs, teamBoosts } from "@/lib/boost";
import { currentUser } from "@/lib/auth";
import { TeamCourt } from "@/components/TeamCourt";
import { AutoRefresh } from "@/components/AutoRefresh";
import { applyPresetAction, autoSet, boostPlayer, dropPlayer, renameTeam, setSlot, unboostPlayer } from "../../../actions";

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
  const boosts = teamBoosts(t.id);
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const boostable = l.draft_status === "done" && !l.champion_team_id
    ? roster(t.id).flatMap((p) => {
        const g = boostableGame(l, p);
        if (!g) return [];
        const taken = [...boosts.values()].find((b) => b.day_key === g.key);
        return [{ playerId: p.id, dayKey: g.key, day: g.label, taken: taken && taken.player_id !== p.id ? { name: nameOf.get(taken.player_id) ?? "another player", mult: taken.mult } : null }];
      })
    : [];

  const b = teamBrand(t);
  const table = standings(l.id);
  const rank = table.findIndex((x) => x.id === t.id) + 1;
  const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 >> 3) ^ 1 && n % 10] || "th"}`;
  const owner = t.user_id ? one<{ name: string }>("SELECT name FROM users WHERE id = ?", t.user_id)?.name : null;
  const stats: [string, string][] = [
    ["Record", `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`],
    ["Standing", rank ? `${ord(rank)} of ${table.length}` : "-"],
    ["Points for", t.points_for.toFixed(1)],
    ["This week", tw.score.toFixed(1)],
    ["FAAB", `$${t.faab}`],
    ["Roster", `${players.length}/13`],
  ];

  return (
    <div className="relative space-y-6">
      <AutoRefresh ms={live ? 10000 : 60000} />
      {/* Giant logo watermark behind the whole page */}
      <div className="pointer-events-none absolute -right-24 top-40 -z-0 opacity-[0.06]"><TeamBadge brand={b} size={620} /></div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl" style={{ background: `linear-gradient(115deg, ${b.color} 0%, ${b.color} 45%, ${b.alt} 130%)` }}>
        <div className="pointer-events-none absolute -right-16 -top-20 opacity-25"><TeamBadge brand={b} size={420} /></div>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 2px, transparent 2px 14px)" }} />
        <div className="relative flex flex-wrap items-center gap-6 p-6 sm:p-8">
          <div className="rounded-3xl bg-black/20 p-3 shadow-xl ring-1 ring-white/20 backdrop-blur"><TeamBadge brand={b} size={132} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-white/70">{b.abbr} · {l.name}</p>
            <h2 className="mt-1 text-4xl font-black leading-none tracking-tight text-white drop-shadow-lg sm:text-5xl">{t.name}</h2>
            <p className="mt-2 text-sm text-white/80">{owner ? `Managed by ${owner}` : "CPU team"}{l.draft_status === "done" ? ` · Week ${l.current_week}` : ""}</p>
          </div>
          {!editable && <Link href={`/league/${leagueId}/trades?to=${t.id}`} className="btn bg-white text-black hover:bg-white/90">Propose trade</Link>}
        </div>
        <div className="relative grid grid-cols-3 gap-px bg-black/20 sm:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k} className="bg-black/25 px-4 py-3 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{k}</p>
              <p className="font-mono text-xl font-black text-white">{v}</p>
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
              slabs: boostSlabs(me.id), boostable, ownBonus: OWN_PLAYER_BONUS,
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
      <p className="relative text-xs text-zinc-400">⚡ Slab boost: once a day, back one of your players with one of your slabs and his points for that game are multiplied (×1.00 for a <Coins n={25} /> slab up to ×3.00, set by the slab&apos;s market value; +{OWN_PLAYER_BONUS.toFixed(1)}× if it&apos;s his own slab). It locks at his tip-off and only counts if he&apos;s in your starting lineup.</p>
      <p className="relative text-xs text-zinc-400">Lineups are daily. Each player locks at his own tip-off, so you can still swap guys who play later tonight. Points count for whatever slot a player was in when his game started.</p>
    </div>
  );
}
