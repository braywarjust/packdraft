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
import { RARITIES, type Rarity } from "./packs";
import { slabPlayerPhoto } from "./nba/photos";
import type { SlabData } from "@/components/Slab";

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

/** The manager's unsold slabs (graded vault slabs and new Slabs) with their base multiplier, best first. */
export function boostSlabs(userId: number) {
  const graded = all<{ card_id: number; slab_id: number; player: string; player_id: number | null; year: number | null; set_name: string | null; grade: string; company: string; rarity: string; mkt_value: number | null; est_value: number }>(
    `SELECT c.id card_id, s.id slab_id, s.player, s.player_id, s.year, s.set_name, s.grade, s.company, s.rarity, s.mkt_value, s.est_value
     FROM cards c JOIN slabs s ON s.id = c.slab_id WHERE c.user_id = ? AND c.sold = 0`, userId)
    .map((s) => ({ cardId: s.card_id, slabId: s.slab_id as number | null, playerId: s.player_id, player: s.player, label: `${s.year ?? ""} ${s.set_name ?? ""}`.trim(), grade: `${s.company} ${s.grade}`, rarity: s.rarity, value: slabValue(s), mult: slabMultiplier(slabValue(s)), slab: null as SlabData | null }));
  const slabs = all<{ id: number; player_id: number; rarity: Rarity; value: number; serial: number; name: string; team: string; pos: string; jersey: string | null; headshot: string | null; color: string | null; alt: string | null; team_name: string | null }>(
    `SELECT c.id, c.player_id, c.rarity, c.value, c.serial, p.name, p.team, p.pos, p.jersey, p.headshot, t.color, t.alt, t.name team_name
     FROM cards c JOIN players p ON p.id = c.player_id LEFT JOIN nba_teams t ON t.abbr = p.team WHERE c.user_id = ? AND c.sold = 0 AND c.kind = 'slab'`, userId)
    .map((c) => ({
      cardId: c.id, slabId: null, playerId: c.player_id, player: c.name, label: `${RARITIES[c.rarity].label} #${c.serial}`, grade: RARITIES[c.rarity].label, rarity: c.rarity as string,
      value: c.value, mult: slabMultiplier(c.value),
      slab: { name: c.name, team: c.team, team_name: c.team_name, pos: c.pos, rarity: c.rarity, serial: c.serial, jersey: c.jersey, color: c.color, alt: c.alt, photo: slabPlayerPhoto(c.name) ?? c.headshot } as SlabData,
    }));
  return [...graded, ...slabs].sort((a, b) => b.value - a.value);
}

/** Boost multiplier for one of the manager's slabs on a player (graded vault slab or new Slab). */
export function cardMultiplier(cardId: number, userId: number, playerId: number) {
  const c = one<{ kind: string | null; player_id: number; value: number; slab_id: number | null }>(
    "SELECT kind, player_id, value, slab_id FROM cards WHERE id = ? AND user_id = ? AND sold = 0", cardId, userId);
  if (!c) throw new Error("That slab isn't in your collection");
  let value: number, slabPlayer: number | null;
  if (c.kind === "slab") { value = c.value; slabPlayer = c.player_id; }
  else {
    const s = one<{ player_id: number | null; mkt_value: number | null; est_value: number }>("SELECT player_id, mkt_value, est_value FROM slabs WHERE id = ?", c.slab_id ?? 0);
    if (!s) throw new Error("That slab can't boost");
    value = slabValue(s); slabPlayer = s.player_id;
  }
  const own = slabPlayer === playerId;
  return { mult: Math.round((slabMultiplier(value) + (own ? OWN_PLAYER_BONUS : 0)) * 100) / 100, own };
}
