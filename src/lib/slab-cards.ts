// Slabs: square, animated collectible cards of active NBA players that come out of packs.
//
// Every active player on an NBA roster is in the pool. Better and more popular players come up a little more often.
// A slab's value is its tier's base price times the player's price index (slab-market.ts: ESPN stats + popularity),
// and it moves with his stats as the season goes. Old graded slabs (the photo vault) no longer drop, but cards people
// already own stay in their collections.
import { all, one, run } from "./db";
import { Rarity, rollRarity, type PackType } from "./packs";
import { currentIndexes, popularity, slabPrice } from "./slab-market";

/**
 * A slab's roll (its "loot"): a fantasy points multiplier stamp, a stat boost, or (rarely) both. The tier says what it
 * can roll. Common slabs only ever get a small stat boost; from Rare up a slab rolls either a multiplier or a bigger
 * boost; from Epic up there's a small chance of both. The best roll there is: an Immortal with +5 PTS, +5 REB, +5 AST
 * and a 2.00x stamp.
 *
 * Multipliers come from 1.10x up to 2.00x: each tier has its own range (they overlap a little), rolls lean toward the
 * low end, and they lean lower still on better players. (Slabs from before Update 2.1 all carry a multiplier, Commons
 * included, and keep it.)
 */
export const MULT_RANGE: Record<Rarity, [number, number]> = {
  common: [1.1, 1.3], rare: [1.2, 1.45], epic: [1.35, 1.65], legendary: [1.55, 1.85], grail: [1.75, 2],
};
export function rollMult(rarity: Rarity, proj: number, rand: () => number) {
  const [lo, hi] = MULT_RANGE[rarity];
  // Stars push the roll lower: exponent 2 for a 20-a-game player, up to 4 for the very best.
  const lean = 2 + Math.min(2, Math.max(0, proj / 20 - 1));
  return Math.round((lo + (hi - lo) * rand() ** lean) * 100) / 100;
}

/**
 * Stat boosts: points, rebounds and assists added to the player's box score when his game ends (before any multiplier).
 * Per tier: the chance the slab rolls a multiplier instead of a boost, the chance it rolls both, how many of the three
 * stats the boost covers, and how big each one can be. Counts and sizes lean low.
 */
export const LOOT: Record<Rarity, { mult: number; both: number; stats: [number, number]; size: [number, number] }> = {
  common: { mult: 0, both: 0, stats: [1, 3], size: [1, 1] },
  rare: { mult: 0.35, both: 0, stats: [1, 3], size: [1, 2] },
  epic: { mult: 0.4, both: 0.03, stats: [1, 3], size: [1, 3] },
  legendary: { mult: 0.45, both: 0.06, stats: [2, 3], size: [2, 4] },
  grail: { mult: 0.45, both: 0.12, stats: [2, 3], size: [3, 5] },
};
export type StatBoost = { pts: number; reb: number; ast: number };
export type Loot = { mult: number | null; boost: StatBoost | null };
const STATS = ["pts", "reb", "ast"] as const;

export function rollBoost(rarity: Rarity, rand: () => number): StatBoost {
  const { stats: [cLo, cHi], size: [vLo, vHi] } = LOOT[rarity];
  const count = Math.min(cHi, cLo + Math.floor((cHi - cLo + 1) * rand() ** 2));
  const order: (typeof STATS)[number][] = [...STATS];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const b: StatBoost = { pts: 0, reb: 0, ast: 0 };
  for (const k of order.slice(0, count)) b[k] = Math.min(vHi, vLo + Math.floor((vHi - vLo + 1) * rand() ** 1.6));
  return b;
}

/** Roll what a new slab of this tier carries. */
export function rollLoot(rarity: Rarity, proj: number, rand: () => number): Loot {
  const t = LOOT[rarity];
  const x = rand();
  if (x < t.both) return { mult: rollMult(rarity, proj, rand), boost: rollBoost(rarity, rand) };
  if (x < t.both + t.mult) return { mult: rollMult(rarity, proj, rand), boost: null };
  return { mult: null, boost: rollBoost(rarity, rand) };
}

/** What a tier can roll, for the shop: chances of a stat boost, a multiplier and both, and their ranges. */
export function lootRules(rarity: Rarity) {
  const t = LOOT[rarity];
  const [cLo, cHi] = t.stats, [vLo, vHi] = t.size;
  return {
    boostPct: Math.round((1 - t.mult) * 1000) / 10,
    multPct: Math.round((t.mult + t.both) * 1000) / 10,
    bothPct: Math.round(t.both * 1000) / 10,
    boost: `${vLo === vHi ? `+${vLo}` : `+${vLo} to +${vHi}`} on ${cLo === cHi ? cLo : `${cLo}–${cHi}`} of PTS, REB, AST`,
    mult: `${MULT_RANGE[rarity][0].toFixed(2)}x–${MULT_RANGE[rarity][1].toFixed(2)}x`,
    best: { mult: t.both > 0 ? MULT_RANGE[rarity][1] : null, boost: { pts: vHi, reb: vHi, ast: vHi } } as Loot,
  };
}

/** A slab's stat boost from its card row (null when it has none). */
export const boostOf = (c: { boost_pts?: number | null; boost_reb?: number | null; boost_ast?: number | null }): StatBoost | null =>
  c.boost_pts == null ? null : { pts: c.boost_pts ?? 0, reb: c.boost_reb ?? 0, ast: c.boost_ast ?? 0 };

/**
 * How a roll scales a slab's value within its tier: the worst roll is 0.85x, the best 1.6x, and rolling both a
 * multiplier and a boost adds a third on top.
 */
export function lootValue(rarity: Rarity, mult: number | null | undefined, boost?: StatBoost | null) {
  const curve = (t: number) => 0.85 + 0.75 * t * t;
  const [lo, hi] = MULT_RANGE[rarity];
  const tm = mult == null ? null : Math.min(1, Math.max(0, (mult - lo) / (hi - lo)));
  let tb: number | null = null;
  if (boost) {
    const { stats: [cLo, cHi], size: [vLo, vHi] } = LOOT[rarity];
    const min = cLo * vLo, max = cHi * vHi;
    tb = max > min ? Math.min(1, Math.max(0, (boost.pts + boost.reb + boost.ast - min) / (max - min))) : 0.5;
  }
  if (tm == null && tb == null) return curve(0.25);
  if (tm != null && tb != null) return curve(Math.max(tm, tb)) * 1.35;
  return curve((tm ?? tb)!);
}

let ready = false;
export function ensureSlabCards() {
  if (ready) return;
  const cols = all<{ name: string }>("PRAGMA table_info(cards)").map((c) => c.name);
  if (!cols.includes("kind")) run("ALTER TABLE cards ADD COLUMN kind TEXT");
  if (!cols.includes("mult")) run("ALTER TABLE cards ADD COLUMN mult REAL");
  for (const k of ["boost_pts", "boost_reb", "boost_ast"]) if (!cols.includes(k)) run(`ALTER TABLE cards ADD COLUMN ${k} INTEGER`);
  // Slabs pulled before multipliers existed get a roll now (boost-only slabs from Update 2.1 have no multiplier on purpose).
  for (const c of all<{ id: number; rarity: Rarity; proj: number | null }>(
    "SELECT c.id, c.rarity, p.proj FROM cards c LEFT JOIN players p ON p.id = c.player_id WHERE c.kind = 'slab' AND c.mult IS NULL AND c.boost_pts IS NULL"))
    run("UPDATE cards SET mult = ? WHERE id = ?", rollMult(c.rarity, c.proj ?? 20, Math.random), c.id);
  ready = true;
}

export type PoolPlayer = { id: number; name: string; team: string; pos: string; proj: number; idx: number };

/** Every active player on an NBA team (re-rolls draw from this). */
export function slabPool() {
  const idx = currentIndexes();
  return all<Omit<PoolPlayer, "idx">>("SELECT p.id, p.name, p.team, p.pos, p.proj FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1 ORDER BY p.team, p.proj DESC")
    .map((p) => ({ ...p, idx: idx.get(p.id) ?? 0.2 }));
}

/**
 * A league's pack pool: every player on a roster in that league right now. League Packs only drop these players, so the
 * pool follows the league on its own: adds, drops, trades, waivers, keepers and each new draft change it.
 */
export function leaguePool(leagueId: number) {
  const idx = currentIndexes();
  return all<Omit<PoolPlayer, "idx"> & { team_id: number }>(
    `SELECT p.id, p.name, p.team, p.pos, p.proj, r.team_id FROM roster r JOIN players p ON p.id = r.player_id JOIN nba_teams t ON t.abbr = p.team
     WHERE r.league_id = ? ORDER BY p.proj DESC`, leagueId)
    .map((p) => ({ ...p, idx: idx.get(p.id) ?? 0.2 }));
}

/** Pick a player from a pool, leaning a little toward better, popular ones. */
export function pickPlayer<T extends PoolPlayer>(pool: T[], rand: () => number): T {
  const w = pool.map((p) => Math.max(3, p.proj) ** 0.7 * Math.sqrt(popularity(p.name)));
  let x = rand() * w.reduce((s, v) => s + v, 0);
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) <= 0) return pool[i];
  return pool[pool.length - 1];
}

/** A slab's value for a player at a tier with this roll. */
export const slabValue = (rarity: Rarity, idx: number, loot: Loot) => Math.max(1, Math.round(slabPrice(rarity, idx) * lootValue(rarity, loot.mult, loot.boost)));

/** One slab from a pack: a tier from the pack's odds, a player from the pool, then its roll. */
export function rollSlab(pack: PackType, pool: PoolPlayer[], rand: () => number) {
  const rarity = rollRarity(pack.odds, rand());
  const pick = pickPlayer(pool, rand);
  const loot = rollLoot(rarity, pick.proj, rand);
  return { rarity, playerId: pick.id, ...loot, value: slabValue(rarity, pick.idx, loot) };
}

/** Insert a new slab card with its roll; returns the card id. */
export function insertSlab(userId: number, packId: number, playerId: number, rarity: Rarity, value: number, loot: Loot) {
  return Number(run(
    `INSERT INTO cards (user_id, pack_id, player_id, slab_id, rarity, grade, serial, print_run, value, kind, mult, boost_pts, boost_reb, boost_ast, created_at)
     VALUES (?, ?, ?, NULL, ?, 0, ?, 0, ?, 'slab', ?, ?, ?, ?, ?)`,
    userId, packId, playerId, rarity, nextSerial(playerId, rarity), value, loot.mult,
    loot.boost?.pts ?? null, loot.boost?.reb ?? null, loot.boost?.ast ?? null, Date.now()).lastInsertRowid);
}

/** Print number: how many slabs of this player at this tier have been pulled, plus one. */
export function nextSerial(playerId: number, rarity: Rarity) {
  return (one<{ n: number }>("SELECT COUNT(*) n FROM cards WHERE kind = 'slab' AND player_id = ? AND rarity = ?", playerId, rarity)?.n ?? 0) + 1;
}
