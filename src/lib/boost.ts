// Slab boosts: each night, every player on your fantasy team with a game can carry one of your Slabs. His fantasy points
// for that game are multiplied by the slab's multiplier (so the boost counts in the matchup and in the Pack Points it
// pays). A player slab only works on its own player; a generic slab works on anyone. A slab can boost one player per
// night, across all your leagues.
//
// A "night" is the date of the game for real leagues and the game number (G1, G2…) for simulated weeks.
// The boost locks when the player's game tips off. The rules live in league.ts (setBoost / teamWeek).
// Boosts set before the redesign (one per team per day, old graded slabs) were copied over and still count.
import { all, one, run } from "./db";
import { ensureSlabCards } from "./slab-cards";
import type { Rarity } from "./packs";
import { slabPlayerPhoto } from "./nba/photos";

let ready = false;
export function ensureBoosts() {
  if (ready) return;
  ensureSlabCards();
  run(`CREATE TABLE IF NOT EXISTS slab_boosts (
    league_id INTEGER NOT NULL, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL, day_key TEXT NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL, mult REAL NOT NULL, own INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, PRIMARY KEY (team_id, day_key, player_id))`);
  const old = one<{ n: number }>("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table' AND name = 'league_boosts'")?.n;
  if (old && !one("SELECT 1 FROM meta WHERE key = 'boosts_v2'")) {
    run("INSERT OR IGNORE INTO slab_boosts SELECT league_id, team_id, user_id, day_key, player_id, card_id, mult, own, created_at FROM league_boosts");
    run("INSERT OR IGNORE INTO meta (key, value) VALUES ('boosts_v2', '1')");
  }
  ready = true;
}

export type Boost = { league_id: number; team_id: number; user_id: number; day_key: string; player_id: number; card_id: number; mult: number; own: number; slab_id: number | null };

/** A team's boosts, keyed by `${playerId}|${dayKey}`. */
export function teamBoosts(teamId: number) {
  ensureBoosts();
  const rows = all<Boost>("SELECT b.*, c.slab_id FROM slab_boosts b LEFT JOIN cards c ON c.id = b.card_id WHERE b.team_id = ?", teamId);
  return new Map(rows.map((b) => [`${b.player_id}|${b.day_key}`, b]));
}

export type BoostSlab = {
  cardId: number; playerId: number | null; player: string; team: string; pos: string; rarity: Rarity; mult: number; immortal: boolean;
  value: number; serial: number; color: string | null; alt: string | null; logo: string | null; jersey: string | null; photo: string | null;
};

/** The manager's unsold Slabs, biggest multiplier first. */
export function boostSlabs(userId: number): BoostSlab[] {
  ensureSlabCards();
  return all<{ id: number; player_id: number; kind: string; rarity: Rarity; mult: number; immortal: number; value: number; serial: number; name: string | null; team: string | null; pos: string | null; headshot: string | null; jersey: string | null; color: string | null; alt: string | null; logo: string | null }>(
    `SELECT c.id, c.player_id, c.kind, c.rarity, c.mult, c.immortal, c.value, c.serial, p.name, p.team, p.pos, p.headshot, p.jersey, t.color, t.alt, t.logo
     FROM cards c LEFT JOIN players p ON p.id = c.player_id AND c.kind = 'player' LEFT JOIN nba_teams t ON t.abbr = p.team
     WHERE c.user_id = ? AND c.sold = 0 AND c.kind IS NOT NULL ORDER BY c.mult DESC, c.value DESC`, userId)
    .map((c) => ({
      cardId: c.id, playerId: c.kind === "player" ? c.player_id : null, player: c.name ?? "Any Player", team: c.team ?? "", pos: c.pos ?? "",
      rarity: c.rarity, mult: c.mult, immortal: !!c.immortal, value: c.value, serial: c.serial, color: c.color, alt: c.alt, logo: c.logo,
      jersey: c.jersey, photo: c.kind === "player" && c.name ? slabPlayerPhoto(c.name) ?? c.headshot : null,
    }));
}

/** The multiplier a slab gives this player, or an error if it doesn't fit him. */
export function cardMultiplier(cardId: number, userId: number, playerId: number) {
  ensureSlabCards();
  const c = one<{ kind: string | null; player_id: number; mult: number | null; name: string | null }>(
    "SELECT c.kind, c.player_id, c.mult, p.name FROM cards c LEFT JOIN players p ON p.id = c.player_id WHERE c.id = ? AND c.user_id = ? AND c.sold = 0", cardId, userId);
  if (!c) throw new Error("That slab isn't in your collection");
  if (!c.kind || !c.mult) throw new Error("Old graded slabs can't boost any more. Use a player or generic Slab");
  if (c.kind === "player" && c.player_id !== playerId) throw new Error(`That slab only boosts ${c.name ?? "its own player"}`);
  return { mult: c.mult, own: c.kind === "player" };
}
