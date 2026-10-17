import { TeamBadge } from "@/components/TeamBadge";
import { ensureBranding, teamBrand, userPresets } from "@/lib/branding";
import { Coins } from "@/components/Coins";
import Link from "next/link";
import { one, Team } from "@/lib/db";
import { boostableGame, getLeague, roster, teamWeek } from "@/lib/league";
import { OWN_PLAYER_BONUS, boostSlabs, teamBoosts } from "@/lib/boost";
import { currentUser } from "@/lib/auth";
import { LineupEditor } from "@/components/LineupEditor";
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

  return (
    <div className="space-y-4">
      <AutoRefresh ms={live ? 10000 : 60000} />
      {(() => {
        const b = teamBrand(t);
        return (
          <div className="overflow-hidden rounded-xl border border-line" style={{ background: `linear-gradient(120deg, ${b.color}, ${b.color} 55%, ${b.alt})` }}>
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-4">
                <TeamBadge brand={b} size={64} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/70">{b.abbr}</p>
                  <h2 className="truncate text-2xl font-black text-white drop-shadow">{t.name}</h2>
                  <p className="text-sm text-white/80">
                    {t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} · {t.points_for.toFixed(1)} PF · ${t.faab} FAAB left · {players.length}/13 roster · week {tw.score.toFixed(1)} pts
                  </p>
                </div>
              </div>
              {!editable && <Link href={`/league/${leagueId}/trades?to=${t.id}`} className="btn-primary">Propose trade</Link>}
            </div>
          </div>
        );
      })()}
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
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
      )}
      {l.draft_status !== "done" ? (
        <p className="text-zinc-500">Rosters fill up during the draft.</p>
      ) : (
        <LineupEditor
          players={players}
          editable={editable}
          setSlot={editable ? setSlot.bind(null, leagueId) : undefined}
          autoSet={editable ? autoSet.bind(null, leagueId) : undefined}
          drop={editable ? dropPlayer.bind(null, leagueId) : undefined}
          boost={editable && me ? {
            slabs: boostSlabs(me.id), boostable, ownBonus: OWN_PLAYER_BONUS,
            set: boostPlayer.bind(null, leagueId), clear: unboostPlayer.bind(null, leagueId),
          } : undefined}
        />
      )}
      <p className="text-xs text-zinc-400">⚡ Slab boost: once a day, back one of your players with one of your slabs and his points for that game are multiplied (×1.00 for a <Coins n={25} /> slab up to ×3.00, set by the slab&apos;s market value; +{OWN_PLAYER_BONUS.toFixed(1)}× if it&apos;s his own slab). It locks at his tip-off and only counts if he&apos;s in your starting lineup.</p>
      <p className="text-xs text-zinc-400">Lineups are daily. Each player locks at his own tip-off, so you can still swap guys who play later tonight. Points count for whatever slot a player was in when his game started.</p>
    </div>
  );
}
