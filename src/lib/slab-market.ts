// Slab prices: every player has a price index, and a slab is worth its tier's base price times that index.
//
// The index comes from ESPN stats, plus how popular the player is:
//   score = last season's ESPN fantasy points per game, blended toward this season as he plays
//           (this season = 60% season average + 40% his last 5 games; this season's weight grows to 85% by game 25)
//   index = (score / 20) ^ 1.6, kept between 0.2 and 8, × popularity (icons 1.8×, stars and big rookies 1.35×)
//
// Only games he actually played move the score, so an injured or benched player's price holds still.
// A snapshot is taken every few minutes while the app runs (one row per player per day) and owned slabs are repriced,
// which is what the price chart on the player profile draws.
import { all, one, run } from "./db";
import { fpts, type Line } from "./scoring";
import { etDate } from "./nba/espn";
import type { Rarity } from "./packs";
import { multValue } from "./slab-cards";

/** Pack Points value of a slab of a 1.0-index player (a ~20 fantasy points a game starter), per tier. */
export const TIER_BASE: Record<Rarity, number> = { common: 8, rare: 49, epic: 172, legendary: 800, grail: 5600 };

const ICONS = ["LeBron James", "Stephen Curry", "Victor Wembanyama", "Luka Doncic", "Giannis Antetokounmpo", "Nikola Jokic", "Kevin Durant",
  "Shai Gilgeous-Alexander", "Anthony Edwards", "Cooper Flagg", "Jayson Tatum", "Ja Morant"];
const STARS = ["Joel Embiid", "Devin Booker", "Donovan Mitchell", "Jalen Brunson", "Tyrese Haliburton", "Kyrie Irving", "Anthony Davis", "Damian Lillard",
  "Paolo Banchero", "Zion Williamson", "Trae Young", "LaMelo Ball", "Jimmy Butler", "Kawhi Leonard", "De'Aaron Fox", "Tyrese Maxey", "Cade Cunningham",
  "Jaylen Brown", "Chet Holmgren", "Jalen Williams", "Paul George", "James Harden", "Russell Westbrook", "Klay Thompson", "Draymond Green",
  "Bam Adebayo", "Karl-Anthony Towns", "Alperen Sengun", "Evan Mobley", "Dylan Harper", "VJ Edgecombe", "Ace Bailey", "Bronny James",
  "Amen Thompson", "Scottie Barnes", "Franz Wagner", "Jamal Murray", "Domantas Sabonis", "Pascal Siakam", "Kristaps Porzingis"];
const POP = new Map<string, number>([...STARS.map((n) => [n, 1.35] as const), ...ICONS.map((n) => [n, 1.8] as const)]);
export const popularity = (name: string) => POP.get(name) ?? 1;
export const popularityLabel = (name: string) => (POP.get(name) === 1.8 ? "Icon" : POP.get(name) ? "Star" : null);

let ready = false;
function ensure() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS slab_prices (
    player_id INTEGER NOT NULL, date_et TEXT NOT NULL, idx REAL NOT NULL, score REAL NOT NULL, gp INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, date_et))`);
  ready = true;
}

type Inputs = { id: number; name: string; proj: number; avg: string | null };
/** Price index for every active player from his stats, keyed by player id. */
export function computeIndexes() {
  const players = all<Inputs>("SELECT p.id, p.name, p.proj, p.avg FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1");
  // This regular season's games he played in, oldest first.
  const games = new Map<number, number[]>();
  for (const g of all<{ player_id: number; stats: string }>(
    `SELECT pg.player_id, pg.stats FROM player_games pg JOIN games g ON g.id = pg.game_id WHERE g.season_type = 2 ORDER BY g.start_ts`)) {
    const s = JSON.parse(g.stats) as Line;
    if (!s.min) continue;
    (games.get(g.player_id) ?? games.set(g.player_id, []).get(g.player_id)!).push(fpts(s, "espn"));
  }
  const out = new Map<number, { idx: number; score: number; gp: number }>();
  for (const p of players) {
    const avg = p.avg ? (JSON.parse(p.avg) as Partial<Line> & { gp?: number }) : null;
    const last = avg?.gp ? fpts({ min: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, ...avg } as Line, "espn") : p.proj;
    const g = games.get(p.id) ?? [];
    let score = last;
    if (g.length) {
      const season = g.reduce((s, v) => s + v, 0) / g.length;
      const recent = g.slice(-5);
      const form = recent.reduce((s, v) => s + v, 0) / recent.length;
      const w = Math.min(0.85, g.length / 25);
      score = last * (1 - w) + (0.6 * season + 0.4 * form) * w;
    }
    const idx = Math.min(8, Math.max(0.2, (Math.max(0, score) / 20) ** 1.6)) * popularity(p.name);
    out.set(p.id, { idx: Math.round(idx * 1000) / 1000, score: Math.round(score * 10) / 10, gp: g.length });
  }
  return out;
}

/** Today's price index per player (from the latest snapshot, or computed now if there isn't one). */
export function currentIndexes() {
  ensure();
  const rows = all<{ player_id: number; idx: number }>(
    "SELECT player_id, idx FROM slab_prices WHERE date_et = (SELECT MAX(date_et) FROM slab_prices)");
  if (rows.length) return new Map(rows.map((r) => [r.player_id, r.idx]));
  return new Map([...computeIndexes()].map(([id, v]) => [id, v.idx]));
}
export const slabPrice = (rarity: Rarity, idx: number) => Math.max(1, Math.round(TIER_BASE[rarity] * idx));

/** Snapshot today's indexes and reprice every owned Slab. Cheap; throttled to every 10 minutes. */
export function snapshotPrices(force = false) {
  ensure();
  const last = Number(one<{ value: string }>("SELECT value FROM meta WHERE key = 'slab_prices_at'")?.value ?? 0);
  if (!force && Date.now() - last < 10 * 60_000) return;
  const today = etDate();
  const now = Date.now();
  const idx = computeIndexes();
  for (const [pid, v] of idx)
    run(`INSERT INTO slab_prices (player_id, date_et, idx, score, gp, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (player_id, date_et) DO UPDATE SET idx = excluded.idx, score = excluded.score, gp = excluded.gp, updated_at = excluded.updated_at`,
      pid, today, v.idx, v.score, v.gp, now);
  for (const c of all<{ id: number; player_id: number; rarity: Rarity; mult: number | null }>("SELECT id, player_id, rarity, mult FROM cards WHERE kind = 'slab' AND sold = 0")) {
    const v = idx.get(c.player_id);
    if (v) run("UPDATE cards SET value = ? WHERE id = ?", Math.max(1, Math.round(slabPrice(c.rarity, v.idx) * multValue(c.rarity, c.mult))), c.id);
  }
  run("INSERT INTO meta (key, value) VALUES ('slab_prices_at', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", String(now));
}

/** A player's price history (index per day, oldest first) for the profile chart. */
export function priceHistory(playerId: number) {
  ensure();
  return all<{ date_et: string; idx: number; score: number; gp: number }>(
    "SELECT date_et, idx, score, gp FROM slab_prices WHERE player_id = ? ORDER BY date_et", playerId);
}
