// League activity feed (Update 3.1): every add, drop, waiver claim and trade, ESPN "Recent Activity" style.
import { all, one, run, League, Player } from "./db";

export type ActivityKind = "add" | "drop" | "claim" | "trade" | "veto";
type Data = { add?: number; drop?: number | null; bid?: number; other?: number; give?: number[]; get?: number[] };

export function logActivity(l: Pick<League, "id" | "season" | "current_week">, teamId: number, kind: ActivityKind, data: Data) {
  run("INSERT INTO league_activity (league_id, season, week, team_id, kind, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    l.id, l.season ?? null, l.current_week, teamId, kind, JSON.stringify(data), Date.now());
}

/** Players a team has added (free agents and waiver claims) this season and in this matchup week. Trades don't count, as on ESPN. */
export function acquisitions(l: Pick<League, "id" | "season" | "current_week">, teamId: number) {
  const r = one<{ season: number; week: number }>(
    `SELECT COUNT(*) season, COALESCE(SUM(week = ?), 0) week FROM league_activity
     WHERE league_id = ? AND season IS ? AND team_id = ? AND kind IN ('add', 'claim')`, l.current_week, l.id, l.season ?? null, teamId);
  return { season: r?.season ?? 0, week: r?.week ?? 0 };
}

/**
 * Acquisitions and Trades (Update 4.0-R): the league's limits are each team's free moves. Past them, every add uses one
 * Acquisition and every trade one Trade, bought with Fantasy Coins in the League Shop. CPU teams never need them.
 */
export function teamItems(teamId: number) {
  const r = one<{ acq_tokens: number; trade_tokens: number; is_cpu: number }>("SELECT acq_tokens, trade_tokens, is_cpu FROM teams WHERE id = ?", teamId);
  return { acquisitions: r?.acq_tokens ?? 0, trades: r?.trade_tokens ?? 0, cpu: !!r?.is_cpu };
}

/** Why this team's next add isn't free (it has used up the league's free adds), or null if it is. */
export function acquisitionOver(l: Pick<League, "id" | "season" | "current_week" | "acq_per_week" | "acq_per_season">, teamId: number): string | null {
  const n = acquisitions(l, teamId);
  const used = (max: number, when: string) => (max === 0 ? `This league has no free adds ${when}` : `You've used your ${max} free add${max === 1 ? "" : "s"} ${when}`);
  if (l.acq_per_week != null && n.week >= l.acq_per_week) return used(l.acq_per_week, "this matchup");
  if (l.acq_per_season != null && n.season >= l.acq_per_season) return used(l.acq_per_season, "this season");
  return null;
}

/** Why this team can't add another player right now (no free adds left and no Acquisitions), or null if it can. */
export function acquisitionBlock(l: Pick<League, "id" | "season" | "current_week" | "acq_per_week" | "acq_per_season">, teamId: number): string | null {
  const over = acquisitionOver(l, teamId);
  if (!over) return null;
  const items = teamItems(teamId);
  return items.cpu || items.acquisitions > 0 ? null : `${over}. Buy an Acquisition in the League Shop to add more`;
}

/** Pay for an add: free while the team has free adds left, else it uses one of its Acquisitions. Call before logging the add. */
export function spendAcquisition(l: Pick<League, "id" | "season" | "current_week" | "acq_per_week" | "acq_per_season">, teamId: number) {
  const blocked = acquisitionBlock(l, teamId);
  if (blocked) throw new Error(blocked);
  if (acquisitionOver(l, teamId) && !teamItems(teamId).cpu) run("UPDATE teams SET acq_tokens = acq_tokens - 1 WHERE id = ? AND acq_tokens > 0", teamId);
}

/** Why this team's next trade isn't free (it has used up the league's free trades), or null if it is. */
export function tradeOver(l: Pick<League, "id" | "season" | "trade_limit">, teamId: number, who?: string): string | null {
  if (l.trade_limit == null || tradeCount(l, teamId) < l.trade_limit) return null;
  if (l.trade_limit === 0) return "This league has no free trades";
  return `${who ? `${who} has` : "You've"} used ${who ? "their" : "your"} ${l.trade_limit} free trade${l.trade_limit === 1 ? "" : "s"} this season`;
}

/** Why this team (named `who`, or "You") can't make another trade (no free trades left and no Trades), or null if it can. */
export function tradeBlock(l: Pick<League, "id" | "season" | "trade_limit">, teamId: number, who?: string): string | null {
  const over = tradeOver(l, teamId, who);
  if (!over) return null;
  const items = teamItems(teamId);
  if (items.cpu || items.trades > 0) return null;
  return `${over}${who ? ` and ${who} has no Trades left` : ". Buy a Trade in the League Shop to make another"}`;
}

/** Pay for a trade on one side: free while the team has free trades left, else it uses one of its Trades. Call before logging it. */
export function spendTrade(l: Pick<League, "id" | "season" | "trade_limit">, teamId: number, who?: string) {
  const blocked = tradeBlock(l, teamId, who);
  if (blocked) throw new Error(blocked);
  if (tradeOver(l, teamId) && !teamItems(teamId).cpu) run("UPDATE teams SET trade_tokens = trade_tokens - 1 WHERE id = ? AND trade_tokens > 0", teamId);
}

/** Trades a team has made this season (either side). */
export const tradeCount = (l: Pick<League, "id" | "season">, teamId: number) =>
  one<{ n: number }>(
    `SELECT COUNT(*) n FROM league_activity WHERE league_id = ? AND season IS ? AND kind = 'trade'
     AND (team_id = ? OR json_extract(data, '$.other') = ?)`, l.id, l.season ?? null, teamId, teamId)?.n ?? 0;

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
