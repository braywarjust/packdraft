// Slabs: PSA-style slabs of NBA players that come out of packs and boost your fantasy players.
//
// Player slabs are of an NBA starter (the top 5 per team by projection). Each rolls its own fantasy points multiplier
// to the hundredth inside its tier's range (1.10X up to 10X), so the same player comes in many versions. They only
// boost that player. The bigger the tier, the more the draw leans toward role players, so a high 10X roll on a
// superstar is the rarest pull there is. Generic slabs boost anyone, but only 1.01X to 1.50X. Any slab can drop with
// the Immortal certification: it glows, gets vibrant colours and is worth five times as much, same multiplier.
import { all, one, run } from "./db";
import { GENERIC_ODDS, GENERIC_RANGE, PLAYER_RANGE, Rarity, rollRarity, type PackType } from "./packs";

export type SlabKind = "player" | "generic";

/** Average starter projection, the "1.0" for slab values and draw weights. */
const AVG_PROJ = 34.5;
/** Pack Points value of a player slab of an average starter, per tier. */
const PLAYER_BASE: Record<Rarity, number> = { common: 15, rare: 70, epic: 330, legendary: 1500, grail: 9000 };
const GENERIC_BASE: Partial<Record<Rarity, number>> = { common: 10, rare: 30, epic: 90 };
/** How hard each tier leans away from stars when picking the player (weight = (proj / avg) ^ -alpha). */
const STAR_DODGE: Record<Rarity, number> = { common: 0, rare: 0.5, epic: 1, legendary: 2, grail: 3 };
export const IMMORTAL_VALUE = 5;

const starFactor = (proj: number) => Math.min(4, Math.max(0.4, (proj / AVG_PROJ) ** 2));

const rangeOf = (kind: SlabKind, rarity: Rarity): [number, number] => (kind === "generic" ? GENERIC_RANGE[rarity] ?? [1.01, 1.14] : PLAYER_RANGE[rarity]);
/** The typical (average) roll in a range: rolls lean low, lo + (hi - lo) × u². */
export const typicalMult = (kind: SlabKind, rarity: Rarity) => { const [lo, hi] = rangeOf(kind, rarity); return lo + (hi - lo) / 3; };

/** A tier's exact multiplier, to the hundredth, leaning toward the bottom of the range. */
export function rollMult(kind: SlabKind, rarity: Rarity, rand: () => number) {
  const [lo, hi] = rangeOf(kind, rarity);
  return Math.round((lo + (hi - lo) * rand() ** 2) * 100) / 100;
}

/** Value: the tier's base for this player, scaled by how good the roll is within the tier (squared), ×5 if Immortal. */
export function slabValue(kind: SlabKind, rarity: Rarity, proj: number, immortal: boolean, mult = typicalMult(kind, rarity)) {
  const base = kind === "generic" ? GENERIC_BASE[rarity] ?? 10 : PLAYER_BASE[rarity] * starFactor(proj);
  const roll = (mult / typicalMult(kind, rarity)) ** 2;
  return Math.max(1, Math.round(base * roll * (immortal ? IMMORTAL_VALUE : 1)));
}

let ready = false;
export function ensureSlabCards() {
  if (ready) return;
  const cols = (all<{ name: string }>("PRAGMA table_info(cards)")).map((c) => c.name);
  if (!cols.includes("kind")) run("ALTER TABLE cards ADD COLUMN kind TEXT");
  if (!cols.includes("mult")) run("ALTER TABLE cards ADD COLUMN mult REAL");
  if (!cols.includes("immortal")) run("ALTER TABLE cards ADD COLUMN immortal INTEGER NOT NULL DEFAULT 0");
  ready = true;
}

export type PoolPlayer = { id: number; name: string; team: string; pos: string; proj: number };

/** The slab pool: each NBA team's five highest-projected active players. */
export function starterPool() {
  return all<PoolPlayer>(
    `SELECT id, name, team, pos, proj FROM (
       SELECT p.*, ROW_NUMBER() OVER (PARTITION BY p.team ORDER BY p.proj DESC) rn FROM players p JOIN nba_teams t ON t.abbr = p.team WHERE p.active = 1
     ) WHERE rn <= 5 ORDER BY team, proj DESC`);
}

export type Rolled = { kind: SlabKind; rarity: Rarity; mult: number; playerId: number; immortal: boolean; value: number };

/** One slab from a pack. */
export function rollSlab(pack: PackType, pool: PoolPlayer[], rand: () => number): Rolled {
  const immortal = rand() < pack.immortal / 100;
  if (rand() < pack.generic / 100) {
    const rarity = rollRarity(GENERIC_ODDS, rand());
    const mult = rollMult("generic", rarity, rand);
    return { kind: "generic", rarity, mult, playerId: 0, immortal, value: slabValue("generic", rarity, 0, immortal, mult) };
  }
  const rarity = rollRarity(pack.odds, rand());
  const w = pool.map((p) => Math.max(0.2, p.proj / AVG_PROJ) ** -STAR_DODGE[rarity]);
  let x = rand() * w.reduce((s, v) => s + v, 0);
  let pick = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) if ((x -= w[i]) <= 0) { pick = pool[i]; break; }
  const mult = rollMult("player", rarity, rand);
  return { kind: "player", rarity, mult, playerId: pick.id, immortal, value: slabValue("player", rarity, pick.proj, immortal, mult) };
}

/** Print number for a new slab: how many of this player (or generic) at this tier have been pulled, plus one. */
export function nextSerial(playerId: number, rarity: Rarity) {
  return (one<{ n: number }>("SELECT COUNT(*) n FROM cards WHERE kind IS NOT NULL AND player_id = ? AND rarity = ?", playerId, rarity)?.n ?? 0) + 1;
}
