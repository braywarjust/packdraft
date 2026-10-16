import Link from "next/link";
import { one, Team } from "@/lib/db";
import { boostableGame, getLeague, roster, teamWeek } from "@/lib/league";
import { OWN_PLAYER_BONUS, boostSlabs, teamBoosts } from "@/lib/boost";
import { currentUser } from "@/lib/auth";
import { LineupEditor } from "@/components/LineupEditor";
import { AutoRefresh } from "@/components/AutoRefresh";
import { autoSet, boostPlayer, dropPlayer, renameTeam, setSlot, unboostPlayer } from "../../../actions";

export async function TeamView({ leagueId, teamId, editable }: { leagueId: number; teamId: number; editable: boolean }) {
  const l = getLeague(leagueId)!;
  const t = one<Team>("SELECT * FROM teams WHERE id = ? AND league_id = ?", teamId, leagueId);
  if (!t) return <p>Team not found.</p>;
  const tw = teamWeek(l, t.id, l.current_week);
  const players = tw.players;
  const live = players.some((p) => p.now?.state === "in");
  // Slab boosts: who can still be boosted for his next game, and what each of those days is already boosted with.
  const me = editable ? await currentUser() : null;
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{t.name}</h2>
          <p className="text-sm text-zinc-500">
            {t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} · {t.points_for.toFixed(1)} PF · ${t.faab} FAAB left · {players.length}/13 roster · week {tw.score.toFixed(1)} pts
          </p>
        </div>
        {editable ? (
          <form action={async (f) => { "use server"; await renameTeam(leagueId, f); }} className="flex gap-2">
            <input name="name" defaultValue={t.name} className="input w-48" />
            <button className="btn-ghost">Rename</button>
          </form>
        ) : (
          <Link href={`/league/${leagueId}/trades?to=${t.id}`} className="btn-primary">Propose trade</Link>
        )}
      </div>
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
      <p className="text-xs text-zinc-400">⚡ Slab boost: once a day, back one of your players with one of your slabs and his points for that game are multiplied (×1.00 for a $25 slab up to ×3.00, set by the slab&apos;s market value; +{OWN_PLAYER_BONUS.toFixed(1)}× if it&apos;s his own slab). It locks at his tip-off and only counts if he&apos;s in your starting lineup.</p>
      <p className="text-xs text-zinc-400">Lineups are daily. Each player locks at his own tip-off, so you can still swap guys who play later tonight. Points count for whatever slot a player was in when his game started.</p>
    </div>
  );
}
