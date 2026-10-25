// Slab boosts from before Update 4.0-R. Slabs are gone, but games that were played with a slab equipped (and the old
// one-a-day league boosts) keep the points they scored, so past matchups and box scores still add up to their finals.
// Nothing new can be equipped.
//
// A game's key is its date for real leagues and its game number (sim:W1:G2) for simulated weeks.
import { all, run } from "./db";
import { fpts, type Line } from "./scoring";

let ready = false;
export function ensureBoosts() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS league_boosts (
    league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL, day_key TEXT NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL, mult REAL NOT NULL, own INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, PRIMARY KEY (team_id, day_key))`);
  run(`CREATE TABLE IF NOT EXISTS slab_equips (
    league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL, day_key TEXT NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL UNIQUE, mult REAL NOT NULL, created_at INTEGER NOT NULL,
    consumed_at INTEGER, PRIMARY KEY (team_id, day_key, player_id))`);
  const cols = all<{ name: string }>("PRAGMA table_info(slab_equips)").map((c) => c.name);
  for (const k of ["boost_pts", "boost_reb", "boost_ast"]) if (!cols.includes(k)) run(`ALTER TABLE slab_equips ADD COLUMN ${k} INTEGER NOT NULL DEFAULT 0`);
  ready = true;
}

export type Boost = {
  league_id: number; team_id: number; user_id: number; day_key: string; player_id: number; card_id: number; mult: number; own: number;
  boost_pts: number; boost_reb: number; boost_ast: number;
};

/**
 * A player's fantasy points for one game, with the slab he had equipped (if any): once the game is final (and he played),
 * the stat boost goes onto his box score, then the multiplier applies to the whole game.
 */
export function slabbedFpts(line: Line, scoring: string, b: Pick<Boost, "mult" | "boost_pts" | "boost_reb" | "boost_ast"> | undefined, final: boolean) {
  if (!b) return fpts(line, scoring);
  const add = final && line.min > 0 && (b.boost_pts || b.boost_reb || b.boost_ast);
  const l = add ? { ...line, pts: line.pts + b.boost_pts, reb: line.reb + b.boost_reb, ast: line.ast + b.boost_ast } : line;
  return Math.round(fpts(l, scoring) * (b.mult || 1) * 100) / 100;
}

/** A team's old boosts (one-a-day boosts and slab equips), keyed by `${playerId}|${dayKey}`. */
export function teamBoosts(teamId: number) {
  ensureBoosts();
  const old = all<Boost>("SELECT b.*, 0 boost_pts, 0 boost_reb, 0 boost_ast FROM league_boosts b WHERE b.team_id = ?", teamId);
  const equips = all<Boost>(`SELECT e.league_id, e.team_id, e.user_id, e.day_key, e.player_id, e.card_id, e.mult, 1 own, e.boost_pts, e.boost_reb, e.boost_ast
    FROM slab_equips e WHERE e.team_id = ?`, teamId);
  return new Map([...old, ...equips].map((b) => [`${b.player_id}|${b.day_key}`, b]));
}
