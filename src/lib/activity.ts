// League activity feed (Update 3.1): every add, drop, waiver claim and trade, ESPN "Recent Activity" style.
import { all, one, run, League, Player } from "./db";

export type ActivityKind = "add" | "drop" | "claim" | "trade" | "veto";
type Data = { add?: number; drop?: number | null; bid?: number; other?: number; give?: number[]; get?: number[] };

export function logActivity(l: Pick<League, "id" | "season">, teamId: number, kind: ActivityKind, data: Data) {
  run("INSERT INTO league_activity (league_id, season, team_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    l.id, l.season ?? null, teamId, kind, JSON.stringify(data), Date.now());
}

type PlayerRef = { id: number; name: string; pos: string; team: string };
export type ActivityItem = {
  id: number; kind: ActivityKind; teamId: number; otherId: number | null; at: number;
  add: PlayerRef | null; drop: PlayerRef | null; bid: number | null; give: PlayerRef[]; get: PlayerRef[];
};

/** This season's activity, newest first, optionally for one team (as either side of a trade). */
export function leagueActivity(l: Pick<League, "id" | "season">, opts: { teamId?: number | null; limit?: number } = {}): ActivityItem[] {
  const rows = all<{ id: number; team_id: number; kind: ActivityKind; data: string; created_at: number }>(
    "SELECT * FROM league_activity WHERE league_id = ? AND season IS ? ORDER BY id DESC LIMIT ?", l.id, l.season ?? null, opts.teamId ? 500 : opts.limit ?? 50);
  const cache = new Map<number, PlayerRef | null>();
  const p = (id: number | null | undefined) => {
    if (!id) return null;
    if (!cache.has(id)) {
      const x = one<Player>("SELECT id, name, pos, elig, team FROM players WHERE id = ?", id);
      cache.set(id, x ? { id: x.id, name: x.name, pos: x.elig || x.pos, team: x.team } : null);
    }
    return cache.get(id)!;
  };
  const items = rows.map((r) => {
    const d = JSON.parse(r.data) as Data;
    return {
      id: r.id, kind: r.kind, teamId: r.team_id, otherId: d.other ?? null, at: r.created_at,
      add: p(d.add), drop: p(d.drop), bid: d.bid ?? null,
      give: (d.give ?? []).map(p).filter((x): x is PlayerRef => !!x), get: (d.get ?? []).map(p).filter((x): x is PlayerRef => !!x),
    };
  });
  const mine = opts.teamId ? items.filter((i) => i.teamId === opts.teamId || i.otherId === opts.teamId) : items;
  return mine.slice(0, opts.limit ?? 50);
}

/** Players acquired this season per team (free agent adds, waiver claims and trades), ESPN's "Moves" column. */
export function movesByTeam(l: Pick<League, "id" | "season">) {
  const out = new Map<number, number>();
  for (const r of all<{ team_id: number; kind: string; data: string }>(
    "SELECT team_id, kind, data FROM league_activity WHERE league_id = ? AND season IS ? AND kind IN ('add', 'claim', 'trade')", l.id, l.season ?? null)) {
    const d = JSON.parse(r.data) as Data;
    if (r.kind === "trade") {
      out.set(r.team_id, (out.get(r.team_id) ?? 0) + (d.get?.length ?? 0));
      if (d.other) out.set(d.other, (out.get(d.other) ?? 0) + (d.give?.length ?? 0));
    } else out.set(r.team_id, (out.get(r.team_id) ?? 0) + 1);
  }
  return out;
}
