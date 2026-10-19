// Slab equips: a Slab is a one-time fantasy points buff for the player on it. If you have a slab of a player on your
// fantasy team, you can equip it on him before one of his games this week: his fantasy points for that game (in the
// matchup, and the Pack Points they pay) are multiplied by the slab's stamped multiplier (1.10x to 2.00x). Each player
// can carry one slab per game and each slab can only be equipped once. It locks at tip-off, and when that game is over
// the slab is used up and leaves your collection (cards.sold = 3). Until then the collection shows it as equipped.
//
// A game's key is its date for real leagues and its game number (sim:W1:G2) for simulated weeks.
// The rules live in league.ts (setBoost / clearBoost / consumeEquips / teamWeek).
//
// Before this, boosts were one per team per day with any slab (league_boosts). Those rows still count for the games
// they were set on.
import { all, one, run } from "./db";
import { RARITIES, type Rarity } from "./packs";
import { slabPlayerPhoto } from "./nba/photos";
import { ensureSlabCards } from "./slab-cards";
import type { SlabData } from "@/components/Slab";

let ready = false;
export function ensureBoosts() {
  if (ready) return;
  ensureSlabCards();
  run(`CREATE TABLE IF NOT EXISTS league_boosts (
    league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL, day_key TEXT NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL, mult REAL NOT NULL, own INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, PRIMARY KEY (team_id, day_key))`);
  run(`CREATE TABLE IF NOT EXISTS slab_equips (
    league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL, day_key TEXT NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL UNIQUE, mult REAL NOT NULL, created_at INTEGER NOT NULL,
    consumed_at INTEGER, PRIMARY KEY (team_id, day_key, player_id))`);
  ready = true;
}

export type Boost = { league_id: number; team_id: number; user_id: number; day_key: string; player_id: number; card_id: number; mult: number; own: number; slab_id: number | null };

/** A team's boosts (old one-a-day boosts and slab equips, used or not), keyed by `${playerId}|${dayKey}`. */
export function teamBoosts(teamId: number) {
  ensureBoosts();
  const old = all<Boost>("SELECT b.*, c.slab_id FROM league_boosts b LEFT JOIN cards c ON c.id = b.card_id WHERE b.team_id = ?", teamId);
  const equips = all<Boost>("SELECT e.league_id, e.team_id, e.user_id, e.day_key, e.player_id, e.card_id, e.mult, 1 own, NULL slab_id FROM slab_equips e WHERE e.team_id = ?", teamId);
  return new Map([...old, ...equips].map((b) => [`${b.player_id}|${b.day_key}`, b]));
}

export type BoostSlab = { cardId: number; playerId: number; player: string; rarity: Rarity; mult: number; value: number; label: string; slab: SlabData };

/** The manager's unused Slabs that can still be equipped (not already equipped somewhere), best multiplier first. */
export function boostSlabs(userId: number): BoostSlab[] {
  return slabRows(userId, "AND c.id NOT IN (SELECT card_id FROM slab_equips WHERE consumed_at IS NULL)");
}
/** The manager's Slabs that are equipped and waiting for their game. */
export function equippedSlabCards(userId: number): BoostSlab[] {
  return slabRows(userId, "AND c.id IN (SELECT card_id FROM slab_equips WHERE consumed_at IS NULL)");
}
function slabRows(userId: number, where: string): BoostSlab[] {
  ensureBoosts();
  return all<{ id: number; player_id: number; rarity: Rarity; value: number; serial: number; mult: number; name: string; team: string; pos: string; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string | null }>(
    `SELECT c.id, c.player_id, c.rarity, c.value, c.serial, c.mult, p.name, p.team, p.pos, p.jersey, p.headshot, t.color, t.alt, t.name team_name
     FROM cards c JOIN players p ON p.id = c.player_id LEFT JOIN nba_teams t ON t.abbr = p.team
     WHERE c.user_id = ? AND c.sold = 0 AND c.kind = 'slab' AND c.mult IS NOT NULL ${where}
     ORDER BY c.mult DESC, c.value DESC`, userId)
    .map((c) => ({
      cardId: c.id, playerId: c.player_id, player: c.name, rarity: c.rarity, mult: c.mult, value: c.value, label: `${RARITIES[c.rarity].label} #${c.serial}`,
      slab: { name: c.name, team: c.team, team_name: c.team_name, pos: c.pos, rarity: c.rarity, serial: c.serial, jersey: c.jersey, color: c.color, alt: c.alt, photo: slabPlayerPhoto(c.name) ?? c.headshot, mult: c.mult },
    }));
}

/** The multiplier one of the manager's Slabs gives a player, or an error if it can't be equipped on him. */
export function cardMultiplier(cardId: number, userId: number, playerId: number) {
  ensureBoosts();
  const c = one<{ kind: string | null; player_id: number; mult: number | null; name: string | null }>(
    "SELECT c.kind, c.player_id, c.mult, p.name FROM cards c LEFT JOIN players p ON p.id = c.player_id WHERE c.id = ? AND c.user_id = ? AND c.sold = 0", cardId, userId);
  if (!c) throw new Error("That slab isn't in your collection");
  if (c.kind !== "slab" || !c.mult) throw new Error("Only Slabs with a multiplier stamp can be equipped");
  if (c.player_id !== playerId) throw new Error(`That's a ${c.name ?? "different player"} slab. Slabs only work on their own player`);
  return { mult: c.mult, own: true };
}

/** Use up an equipped slab: its game is over. */
export function consumeEquip(cardId: number) {
  run("UPDATE slab_equips SET consumed_at = ? WHERE card_id = ? AND consumed_at IS NULL", Date.now(), cardId);
  run("UPDATE cards SET sold = 3 WHERE id = ? AND sold = 0", cardId);
}

/** The manager's equipped (not yet used) slabs: card id → where and when. */
export function equippedSlabs(userId: number) {
  ensureBoosts();
  return new Map(all<{ card_id: number; day_key: string; league: string; player: string }>(
    `SELECT e.card_id, e.day_key, l.name league, p.name player FROM slab_equips e JOIN leagues l ON l.id = e.league_id JOIN players p ON p.id = e.player_id
     WHERE e.user_id = ? AND e.consumed_at IS NULL`, userId).map((r) => [r.card_id, r]));
}
