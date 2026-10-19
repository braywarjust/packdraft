// Slabs: square, animated collectible cards of active NBA players that come out of packs.
//
// Every active player on an NBA roster is in the pool. Better and more popular players come up a little more often.
// A slab's value is its tier's base price times the player's price index (slab-market.ts: ESPN stats + popularity),
// and it moves with his stats as the season goes. Old graded slabs (the photo vault) no longer drop, but cards people
// already own stay in their collections.
import { all, one, run } from "./db";
import { Rarity, rollRarity, type PackType } from "./packs";
import { currentIndexes, popularity, slabPrice } from "./slab-market";

let ready = false;
export function ensureSlabCards() {
  if (ready) return;
  const cols = all<{ name: string }>("PRAGMA table_info(cards)").map((c) => c.name);
  if (!cols.includes("kind")) run("ALTER TABLE cards ADD COLUMN kind TEXT");
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
  return { rarity, playerId: pick.id, value: slabPrice(rarity, pick.idx) };
}

/** Print number: how many slabs of this player at this tier have been pulled, plus one. */
export function nextSerial(playerId: number, rarity: Rarity) {
  return (one<{ n: number }>("SELECT COUNT(*) n FROM cards WHERE kind = 'slab' AND player_id = ? AND rarity = ?", playerId, rarity)?.n ?? 0) + 1;
}
