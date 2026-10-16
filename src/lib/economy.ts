// Fantasy points pay out as Pack Points, backed by the slab market.
//
// 1 Pack Point is worth $1 of slab market value: pulled cards are valued at their slab's market price
// (eBay/Courtyard when known, else the rarity estimate). Every fantasy point a started player scores pays
// the manager `rate` Pack Points when that game goes final.
//
// Calibration (simulated 20-week, 8-team seasons, both scoring formats): an average team scores ~1,150 pts
// a week (p10 ~1,000, p90 ~1,300). At rate 1.00 that's roughly one Hall of Fame Pack a week, or a Mega Case
// every ~9 weeks of saving. So fantasy points and Pack Points start 1:1.
//
// The rate floats with the market: if slab prices across the vault rise, the same Pack Points buy weaker
// slabs out of a pack, so the rate rises with them (and falls when prices fall). It is snapshotted per league
// week, so points never change value mid-week.
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

/** Pack Points per fantasy point at the baseline market. */
export const BASE_RATE = 1;
const CLAMP: [number, number] = [0.5, 2];

/** Median slab market value across the whole vault (market price when known, else the estimate). */
function vaultMedian(): number {
  const n = one<{ n: number }>("SELECT COUNT(*) n FROM slabs WHERE missing = 0")?.n ?? 0;
  if (!n) return 0;
  return one<{ v: number }>(
    "SELECT COALESCE(mkt_value, est_value) v FROM slabs WHERE missing = 0 ORDER BY v LIMIT 1 OFFSET ?", Math.floor(n / 2))?.v ?? 0;
}

/** Current market vs the baseline locked in the first time this ran (1.00 = unchanged). Cached per day. */
export function marketIndex(): number {
  const day = new Date().toISOString().slice(0, 10);
  const cached = one<{ value: string }>("SELECT value FROM meta WHERE key = ?", `market_index:${day}`);
  if (cached) return Number(cached.value);
  const median = vaultMedian();
  if (!median) return 1;
  let base = Number(one<{ value: string }>("SELECT value FROM meta WHERE key = 'market_baseline_median'")?.value);
  if (!base) {
    base = median;
    run("INSERT OR REPLACE INTO meta (key, value) VALUES ('market_baseline_median', ?)", String(base));
  }
  const idx = Math.round(Math.min(CLAMP[1], Math.max(CLAMP[0], median / base)) * 100) / 100;
  run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", `market_index:${day}`, String(idx));
  return idx;
}

/** Pack Points per fantasy point for a league week, fixed the first time the week is scored. */
export function weekRate(leagueId: number, week: number): number {
  const key = `pp_rate:${leagueId}:${week}`;
  const saved = one<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  if (saved) return Number(saved.value);
  const rate = Math.round(BASE_RATE * marketIndex() * 100) / 100;
  run("INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)", key, String(rate));
  return rate;
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
