import Link from "next/link";
import { one, Team } from "@/lib/db";
import { getLeague, isLocked, teamWeek, weekProgress, roster } from "@/lib/league";
import { LineupEditor } from "@/components/LineupEditor";
import { AutoRefresh } from "@/components/AutoRefresh";
import { autoSet, dropPlayer, renameTeam, setSlot } from "../../../actions";

export async function TeamView({ leagueId, teamId, editable }: { leagueId: number; teamId: number; editable: boolean }) {
  const l = getLeague(leagueId)!;
  const t = one<Team>("SELECT * FROM teams WHERE id = ? AND league_id = ?", teamId, leagueId);
  if (!t) return <p>Team not found.</p>;
  const live = !!l.week_started_at;
  const tw = teamWeek(l, t.id, l.current_week, weekProgress(l));
  const lockMap = new Map(roster(t.id).map((p) => [p.id, isLocked(l, p)]));
  const players = tw.players.map((p) => ({ ...p, locked: !!lockMap.get(p.id) }));

  return (
    <div className="space-y-4">
      {live && <AutoRefresh ms={5000} />}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{t.name}</h2>
          <p className="text-sm text-slate-400">
            {t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ""} · {t.points_for.toFixed(1)} PF · ${t.faab} FAAB left · {players.length}/14 roster
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
        <p className="text-slate-400">Rosters fill up during the draft.</p>
      ) : (
        <LineupEditor
          players={players}
          editable={editable}
          live={live}
          setSlot={editable ? setSlot.bind(null, leagueId) : undefined}
          autoSet={editable ? autoSet.bind(null, leagueId) : undefined}
          drop={editable ? dropPlayer.bind(null, leagueId) : undefined}
        />
      )}
      <p className="text-xs text-slate-500">Lineups are weekly. Each player locks individually when his game kicks off, so you can still swap late-game guys mid-week.</p>
    </div>
  );
}
