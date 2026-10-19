// Slab boosts: once a day, each fantasy team can back ONE of its players with one of the manager's slabs.
// That player's fantasy points for that day's game are multiplied (so the boost counts in the matchup and in
// the Pack Points it pays). Better slabs = bigger multipliers, backed by the slab's market value:
//
//   multiplier = 1 + 0.5 × log10(slab market value / 25), from 1.00× up to 3.00×
//     $25 → 1.00×   $250 → 1.50×   $2,500 → 2.00×   $25,000 → 2.50×
//   + 0.50× when the slab is OF the boosted player (own-player bonus)
//
// A "day" is the date of the game for real leagues and the game number (G1, G2…) for simulated weeks.
// The boost locks when the player's game tips off. The rules live in league.ts (setBoost / teamWeek).
import { all, one, run } from "./db";
import { slabValue } from "./slabs";

export const OWN_PLAYER_BONUS = 0.5;

export function slabMultiplier(value: number) {
  return Math.round(Math.min(3, Math.max(1, 1 + 0.5 * Math.log10(Math.max(1, value) / 25))) * 100) / 100;
}

let ready = false;
export function ensureBoosts() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS league_boosts (
    league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL, day_key TEXT NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL, mult REAL NOT NULL, own INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, PRIMARY KEY (team_id, day_key))`);
  ready = true;
}

export type Boost = { league_id: number; team_id: number; user_id: number; day_key: string; player_id: number; card_id: number; mult: number; own: number; slab_id: number };

/** A team's boosts, keyed by `${playerId}|${dayKey}`. */
export function teamBoosts(teamId: number) {
  ensureBoosts();
  const rows = all<Boost>("SELECT b.*, c.slab_id FROM league_boosts b JOIN cards c ON c.id = b.card_id WHERE b.team_id = ?", teamId);
  return new Map(rows.map((b) => [`${b.player_id}|${b.day_key}`, b]));
}

/** The manager's unsold slabs with their base multiplier, best first. */
export function boostSlabs(userId: number) {
  return all<{ card_id: number; slab_id: number; player: string; player_id: number | null; year: number | null; set_name: string | null; grade: string; company: string; rarity: string; mkt_value: number | null; est_value: number }>(
    `SELECT c.id card_id, s.id slab_id, s.player, s.player_id, s.year, s.set_name, s.grade, s.company, s.rarity, s.mkt_value, s.est_value
     FROM cards c JOIN slabs s ON s.id = c.slab_id WHERE c.user_id = ? AND c.sold = 0`, userId)
    .map((s) => ({ cardId: s.card_id, slabId: s.slab_id, playerId: s.player_id, player: s.player, label: `${s.year ?? ""} ${s.set_name ?? ""}`.trim(), grade: `${s.company} ${s.grade}`, rarity: s.rarity, value: slabValue(s), mult: slabMultiplier(slabValue(s)) }))
    .sort((a, b) => b.value - a.value);
}

export function cardMultiplier(cardId: number, userId: number, playerId: number) {
  const s = one<{ player_id: number | null; mkt_value: number | null; est_value: number }>(
    "SELECT s.player_id, s.mkt_value, s.est_value FROM cards c JOIN slabs s ON s.id = c.slab_id WHERE c.id = ? AND c.user_id = ? AND c.sold = 0", cardId, userId);
  if (!s) throw new Error("That slab isn't in your collection");
  const own = s.player_id === playerId;
  return { mult: Math.round((slabMultiplier(slabValue(s)) + (own ? OWN_PLAYER_BONUS : 0)) * 100) / 100, own };
}
