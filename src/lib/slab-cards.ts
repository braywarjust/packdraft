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
 * Every Slab carries a fantasy points multiplier, stamped on its art, that it gives the player it's equipped on for one
 * game. It's rolled when the slab drops, from 1.10x up to 2.00x: each tier has its own range (they overlap a little),
 * rolls lean toward the low end, and they lean lower still on better players. A 2.00x Immortal is the rarest roll there
 * is, and rarest of all on a star.
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
/** How a roll scales a slab's value within its tier: the bottom of the range is 0.85x, the top 1.6x. */
export function multValue(rarity: Rarity, mult: number | null | undefined) {
  const [lo, hi] = MULT_RANGE[rarity];
  const t = mult == null ? 0.25 : Math.min(1, Math.max(0, (mult - lo) / (hi - lo)));
  return 0.85 + 0.75 * t * t;
}

let ready = false;
export function ensureSlabCards() {
  if (ready) return;
  const cols = all<{ name: string }>("PRAGMA table_info(cards)").map((c) => c.name);
  if (!cols.includes("kind")) run("ALTER TABLE cards ADD COLUMN kind TEXT");
  if (!cols.includes("mult")) run("ALTER TABLE cards ADD COLUMN mult REAL");
  // Slabs pulled before multipliers existed get a roll now.
  for (const c of all<{ id: number; rarity: Rarity; proj: number | null }>(
    "SELECT c.id, c.rarity, p.proj FROM cards c LEFT JOIN players p ON p.id = c.player_id WHERE c.kind = 'slab' AND c.mult IS NULL"))
    run("UPDATE cards SET mult = ? WHERE id = ?", rollMult(c.rarity, c.proj ?? 20, Math.random), c.id);
  ready = true;
}

export type PoolPlayer = { id: number; name: string; team: string; pos: string; proj: number; idx: number };

/** The slab pool: every active player on an NBA team. */
export function slabPool() {
  const idx = currentIndexes();
  return all<Omit<PoolPlayer, "idx">>("SELECT p.id, p.name, p.team, p.pos, p.proj FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1 ORDER BY p.team, p.proj DESC")
    .map((p) => ({ ...p, idx: idx.get(p.id) ?? 0.2 }));
}

/** One slab from a pack: a tier from the pack's odds, then a player (leaning a little toward better, popular ones). */
export function rollSlab(pack: PackType, pool: PoolPlayer[], rand: () => number) {
  const rarity = rollRarity(pack.odds, rand());
  const w = pool.map((p) => Math.max(3, p.proj) ** 0.7 * Math.sqrt(popularity(p.name)));
  let x = rand() * w.reduce((s, v) => s + v, 0);
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) <= 0) { pick = pool[i]; break; }
  const mult = rollMult(rarity, pick.proj, rand);
  return { rarity, playerId: pick.id, mult, value: Math.max(1, Math.round(slabPrice(rarity, pick.idx) * multValue(rarity, mult))) };
}

/** Print number: how many slabs of this player at this tier have been pulled, plus one. */
export function nextSerial(playerId: number, rarity: Rarity) {
  return (one<{ n: number }>("SELECT COUNT(*) n FROM cards WHERE kind = 'slab' AND player_id = ? AND rarity = ?", playerId, rarity)?.n ?? 0) + 1;
}
