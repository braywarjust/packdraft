// Fantasy points pay out as Pack Points at a fixed rate.
//
// 1 Pack Point is worth $1 of slab market value. Every fantasy point a started player scores pays the manager
// PP_PER_POINT Pack Points when that game goes final. Brayden set this to 0.5 and wants it fixed: never float it
// with the market or change it without him asking.
import { all, one, run } from "./db";

// The table is also in db.ts's schema; creating it here too means a running dev server picks it up without a restart.
let ready = false;
function ensure() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS pp_earnings (
    league_id INTEGER NOT NULL, week INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL, game_key TEXT NOT NULL, fpts REAL NOT NULL, rate REAL NOT NULL, pp INTEGER NOT NULL,
    created_at INTEGER NOT NULL, PRIMARY KEY (team_id, player_id, game_key))`);
  run("CREATE INDEX IF NOT EXISTS idx_pp_user ON pp_earnings(user_id, league_id, week)");
  ready = true;
}

/** Pack Points paid per fantasy point. Fixed by Brayden: do not change. */
export const PP_PER_POINT = 0.5;

/** Pack Points per fantasy point for a league week. Always PP_PER_POINT (kept as a function for callers). */
export function weekRate(_leagueId?: number, _week?: number): number {
  return PP_PER_POINT;
}

/** Pay a finished player-game once. Bad nights (negative points) pay nothing rather than costing you. */
export function creditGame(o: { leagueId: number; week: number; teamId: number; userId: number; playerId: number; gameKey: string; fpts: number; rate: number }) {
  ensure();
  const pp = Math.max(0, Math.round(o.fpts * o.rate));
  const r = run(
    `INSERT OR IGNORE INTO pp_earnings (league_id, week, team_id, user_id, player_id, game_key, fpts, rate, pp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    o.leagueId, o.week, o.teamId, o.userId, o.playerId, o.gameKey, o.fpts, o.rate, pp, Date.now());
  if (Number(r.changes) > 0 && pp > 0) run("UPDATE users SET coins = coins + ? WHERE id = ?", pp, o.userId);
}

export function earnings(leagueId: number, userId: number, week: number) {
  ensure();
  const rows = all<{ week: number; pp: number }>(
    "SELECT week, SUM(pp) pp FROM pp_earnings WHERE league_id = ? AND user_id = ? GROUP BY week", leagueId, userId);
  return { week: rows.find((r) => r.week === week)?.pp ?? 0, season: rows.reduce((s, r) => s + r.pp, 0) };
}
