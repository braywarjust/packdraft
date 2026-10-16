// Slab Boost: the daily game you play with your own slabs.
//
// Every day you fill 3 boost slots. Each slot is a player in a real NBA game that day plus one of your slabs.
// When the game is played, his DraftKings-style fantasy points × the slab's multiplier pay you Pack Points
// (live while he plays, credited when his game goes final). Better slabs = bigger multipliers:
//
//   multiplier = 1 + 0.5 × log10(slab market value / 25), from 1.00× up to 3.00×
//     $25 → 1.00×   $250 → 1.50×   $2,500 → 2.00×   $25,000 → 2.50×
//   + 0.50× when the slab is OF the player you picked (own-player bonus)
//
// The value is the slab's market price (eBay/Courtyard when known, else the estimate), so the multiplier is
// backed by the market. A slab can boost one slot a day. Picks lock when that player's game tips off.
// Rough economy: three good picks (~45 fpts each) on mid slabs (~1.4×) pay ~190 Pack Points a day.
import { all, one, run, Game, Player } from "./db";
import { fpts, Line, statLine } from "./scoring";
import { slabValue } from "./slabs";
import { etDate } from "./nba/espn";

export const BOOST_SLOTS = 3;
export const OWN_PLAYER_BONUS = 0.5;
const SCORING = "dk";

export function slabMultiplier(value: number) {
  return Math.round(Math.min(3, Math.max(1, 1 + 0.5 * Math.log10(Math.max(1, value) / 25))) * 100) / 100;
}

let ready = false;
function ensure() {
  if (ready) return;
  run(`CREATE TABLE IF NOT EXISTS boost_picks (
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, date_et TEXT NOT NULL, slot INTEGER NOT NULL,
    player_id INTEGER NOT NULL, card_id INTEGER NOT NULL, mult REAL NOT NULL, fpts REAL, pp INTEGER,
    credited_at INTEGER, created_at INTEGER NOT NULL,
    UNIQUE (user_id, date_et, slot), UNIQUE (user_id, date_et, card_id))`);
  ready = true;
}

export type BoostPick = { id: number; user_id: number; date_et: string; slot: number; player_id: number; card_id: number; mult: number; fpts: number | null; pp: number | null; credited_at: number | null };

const gameFor = (date: string, team: string) =>
  one<Game>("SELECT * FROM games WHERE date_et = ? AND (home = ? OR away = ?) ORDER BY start_ts LIMIT 1", date, team, team);
const started = (g: Game | undefined) => !!g && (g.state !== "pre" || g.start_ts <= Date.now());

/** Players with a game on `date`, best projected first. */
export function boostPlayers(date = etDate()) {
  const games = all<Game>("SELECT * FROM games WHERE date_et = ?", date);
  const teams = new Map<string, Game>();
  for (const g of games) { teams.set(g.home, g); teams.set(g.away, g); }
  return all<Player>("SELECT * FROM players WHERE active = 1 ORDER BY proj_dk DESC")
    .filter((p) => teams.has(p.team))
    .map((p) => {
      const g = teams.get(p.team)!;
      return { ...p, game: g, opp: g.home === p.team ? `vs ${g.away}` : `@ ${g.home}`, locked: started(g) };
    });
}

/** The user's unsold slabs with their boost multiplier (before any own-player bonus). */
export function boostSlabs(userId: number) {
  return all<{ card_id: number; slab_id: number; player: string; player_id: number | null; year: number | null; set_name: string | null; grade: string; company: string; rarity: string; mkt_value: number | null; est_value: number }>(
    `SELECT c.id card_id, s.id slab_id, s.player, s.player_id, s.year, s.set_name, s.grade, s.company, s.rarity, s.mkt_value, s.est_value
     FROM cards c JOIN slabs s ON s.id = c.slab_id WHERE c.user_id = ? AND c.sold = 0`, userId)
    .map((s) => ({ ...s, value: slabValue(s), mult: slabMultiplier(slabValue(s)) }))
    .sort((a, b) => b.value - a.value);
}

export function multiplierFor(cardId: number, playerId: number) {
  const s = one<{ player_id: number | null; mkt_value: number | null; est_value: number }>(
    "SELECT s.player_id, s.mkt_value, s.est_value FROM cards c JOIN slabs s ON s.id = c.slab_id WHERE c.id = ?", cardId);
  if (!s) throw new Error("Slab not found");
  return Math.round((slabMultiplier(slabValue(s)) + (s.player_id === playerId ? OWN_PLAYER_BONUS : 0)) * 100) / 100;
}

export function todaysPicks(userId: number, date = etDate()) {
  ensure();
  return all<BoostPick>("SELECT * FROM boost_picks WHERE user_id = ? AND date_et = ? ORDER BY slot", userId, date);
}

/** Set (or change) a slot. Both the old and the new player must not have tipped off yet. */
export function setPick(userId: number, slot: number, playerId: number, cardId: number) {
  ensure();
  const date = etDate();
  if (slot < 0 || slot >= BOOST_SLOTS) throw new Error("Bad slot");
  const p = one<Player>("SELECT * FROM players WHERE id = ? AND active = 1", playerId);
  if (!p) throw new Error("Player not found");
  const g = gameFor(date, p.team);
  if (!g) throw new Error(`${p.name} doesn't play today`);
  if (started(g)) throw new Error(`${p.name}'s game has already tipped off`);
  const card = one<{ id: number }>("SELECT id FROM cards WHERE id = ? AND user_id = ? AND sold = 0 AND slab_id IS NOT NULL", cardId, userId);
  if (!card) throw new Error("That slab isn't in your collection");
  const existing = one<BoostPick>("SELECT * FROM boost_picks WHERE user_id = ? AND date_et = ? AND slot = ?", userId, date, slot);
  if (existing) {
    const old = one<Player>("SELECT * FROM players WHERE id = ?", existing.player_id);
    if (old && started(gameFor(date, old.team))) throw new Error("That slot is locked: its game has started");
  }
  const clash = one<BoostPick>("SELECT * FROM boost_picks WHERE user_id = ? AND date_et = ? AND slot != ? AND (card_id = ? OR player_id = ?)", userId, date, slot, cardId, playerId);
  if (clash) throw new Error(clash.card_id === cardId ? "That slab is already boosting another slot today" : `${p.name} is already in another slot`);
  const mult = multiplierFor(cardId, playerId);
  run(`INSERT INTO boost_picks (user_id, date_et, slot, player_id, card_id, mult, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, date_et, slot) DO UPDATE SET player_id = excluded.player_id, card_id = excluded.card_id, mult = excluded.mult`,
    userId, date, slot, playerId, cardId, mult, Date.now());
}

export function clearPick(userId: number, slot: number) {
  ensure();
  const date = etDate();
  const existing = one<BoostPick>("SELECT * FROM boost_picks WHERE user_id = ? AND date_et = ? AND slot = ?", userId, date, slot);
  if (!existing) return;
  const p = one<Player>("SELECT * FROM players WHERE id = ?", existing.player_id);
  if (p && started(gameFor(date, p.team))) throw new Error("That slot is locked: its game has started");
  run("DELETE FROM boost_picks WHERE id = ?", existing.id);
}

/** Live view of a user's picks for a day; also pays out any pick whose game is final (once). */
export function boostLive(userId: number, date = etDate()) {
  const picks = todaysPicks(userId, date).map((k) => {
    const p = one<Player>("SELECT * FROM players WHERE id = ?", k.player_id)!;
    const slab = one<{ player: string; year: number | null; set_name: string | null; grade: string; company: string; rarity: string; slab_id: number }>(
      "SELECT s.player, s.year, s.set_name, s.grade, s.company, s.rarity, s.id slab_id FROM cards c JOIN slabs s ON s.id = c.slab_id WHERE c.id = ?", k.card_id);
    const g = gameFor(date, p.team);
    const row = g ? one<{ stats: string }>("SELECT stats FROM player_games WHERE game_id = ? AND player_id = ?", g.id, p.id) : undefined;
    const line = row ? (JSON.parse(row.stats) as Line) : null;
    const raw = line ? fpts(line, SCORING) : 0;
    const pp = Math.max(0, Math.round(raw * k.mult * 10) / 10);
    const final = !!g && g.state === "post" && !!g.box_at;
    if (final && !k.credited_at) {
      const paid = Math.round(pp);
      const r = run("UPDATE boost_picks SET fpts = ?, pp = ?, credited_at = ? WHERE id = ? AND credited_at IS NULL", raw, paid, Date.now(), k.id);
      if (Number(r.changes) > 0 && paid > 0) run("UPDATE users SET coins = coins + ? WHERE id = ?", paid, userId);
    }
    return {
      slot: k.slot, mult: k.mult, cardId: k.card_id, ownBonus: slab ? one<{ x: number }>("SELECT 1 x FROM slabs WHERE id = ? AND player_id = ?", slab.slab_id, p.id) != null : false,
      player: { id: p.id, name: p.name, pos: p.pos, team: p.team, headshot: p.headshot },
      slab: slab ? { id: slab.slab_id, label: `${slab.year ?? ""} ${slab.set_name ?? ""} ${slab.player}`.trim(), grade: `${slab.company} ${slab.grade}`, rarity: slab.rarity } : null,
      game: g ? { state: g.state, detail: g.detail ?? "", start: g.start_ts, label: g.home === p.team ? `vs ${g.away}` : `@ ${g.home}`, score: `${g.away} ${g.away_score} – ${g.home} ${g.home_score}` } : null,
      locked: started(g), final, credited: !!k.credited_at || final,
      line: line ? statLine(line) : "", stats: line, fpts: Math.round(raw * 10) / 10, pp,
    };
  });
  return { date, picks, total: Math.round(picks.reduce((s, p) => s + p.pp, 0) * 10) / 10 };
}

/** Days played and Pack Points earned, newest first. */
export function boostHistory(userId: number) {
  ensure();
  return all<{ date_et: string; pp: number; picks: number; pending: number }>(
    `SELECT date_et, COALESCE(SUM(pp), 0) pp, COUNT(*) picks, SUM(credited_at IS NULL) pending FROM boost_picks
     WHERE user_id = ? GROUP BY date_et ORDER BY date_et DESC LIMIT 14`, userId);
}

/** Pay every pending pick whose game is final (called from the background loop). */
export function boostPayouts() {
  ensure();
  for (const r of all<{ user_id: number; date_et: string }>("SELECT DISTINCT user_id, date_et FROM boost_picks WHERE credited_at IS NULL")) boostLive(r.user_id, r.date_et);
}
