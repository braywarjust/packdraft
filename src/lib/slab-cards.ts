// Slabs: square, animated collectible cards of active NBA players that come out of packs.
//
// Every active player on an NBA roster is in the pool. Better players come up a little more often, and a slab's value
// is set by its tier (Common to Immortal) times how good the player is. Old graded slabs (the photo vault) no longer
// drop, but cards people already own stay in their collections.
import { all, one, run } from "./db";
import { Rarity, rollRarity, type PackType } from "./packs";

/** Average active player's projection: the "1.0" for slab values. */
const AVG_PROJ = 20;
/** Pack Points value of a slab of an average player, per tier. */
const TIER_BASE: Record<Rarity, number> = { common: 10, rare: 56, epic: 215, legendary: 1000, grail: 7000 };

const starFactor = (proj: number) => Math.min(6, Math.max(0.25, (proj / AVG_PROJ) ** 1.6));
export const slabValue = (rarity: Rarity, proj: number) => Math.max(1, Math.round(TIER_BASE[rarity] * starFactor(proj)));

let ready = false;
export function ensureSlabCards() {
  if (ready) return;
  const cols = all<{ name: string }>("PRAGMA table_info(cards)").map((c) => c.name);
  if (!cols.includes("kind")) run("ALTER TABLE cards ADD COLUMN kind TEXT");
  ready = true;
}

export type PoolPlayer = { id: number; name: string; team: string; pos: string; proj: number };

/** The slab pool: every active player on an NBA team. */
export function slabPool() {
  return all<PoolPlayer>("SELECT p.id, p.name, p.team, p.pos, p.proj FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1 ORDER BY p.team, p.proj DESC");
}

/** One slab from a pack: a tier from the pack's odds, then a player (leaning a little toward better ones). */
export function rollSlab(pack: PackType, pool: PoolPlayer[], rand: () => number) {
  const rarity = rollRarity(pack.odds, rand());
  const w = pool.map((p) => Math.max(3, p.proj) ** 0.7);
  let x = rand() * w.reduce((s, v) => s + v, 0);
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) <= 0) { pick = pool[i]; break; }
  return { rarity, playerId: pick.id, value: slabValue(rarity, pick.proj) };
}

/** Print number: how many slabs of this player at this tier have been pulled, plus one. */
export function nextSerial(playerId: number, rarity: Rarity) {
  return (one<{ n: number }>("SELECT COUNT(*) n FROM cards WHERE kind = 'slab' AND player_id = ? AND rarity = ?", playerId, rarity)?.n ?? 0) + 1;
}
