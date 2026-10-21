import crypto from "node:crypto";
import { all, one, run, tx, User } from "./db";
import { PACK_BY_ID, RARITIES, REROLL_FEE, Rarity, fmtCoins } from "./packs";
import { postSystem } from "./league";
import { ensureSlabCards, insertSlab, leaguePool, pickPlayer, rollLoot, rollSlab, slabPool, slabValue } from "./slab-cards";
import { ensureBoosts } from "./boost";
import { slabPlayerPhoto } from "./nba/photos";

/**
 * A card in someone's collection. New cards are Slabs (kind 'slab'): an active player at a tier. Older cards are
 * real graded slabs from the photo vault (slab_id) or, from the very first build, generated art.
 */
export type Card = {
  id: number; player_id: number; slab_id: number | null; kind: string | null; name: string; pos: string; team: string; rarity: Rarity; grade: number;
  serial: number; print_run: number; value: number; sold: number; created_at: number; team_name: string | null; photo: string | null;
  /** Fantasy points multiplier stamped on a Slab (1.10–2.00), if it rolled one. */
  mult: number | null;
  /** Stat boost a Slab rolled (null when it has none): added to his box score when his game ends. */
  boost_pts: number | null; boost_reb: number | null; boost_ast: number | null;
  headshot: string | null; jersey: string | null; color: string | null; alt: string | null; logo: string | null;
  // Graded slab details (null otherwise)
  s_year: number | null; s_set: string | null; s_no: string | null; s_variant: string | null; s_company: string | null; s_grade: string | null;
  s_cert: string | null; s_flags: string | null; s_factors: string | null; s_source: string | null; s_detail: string | null;
  s_est: number | null; s_pop: number | null; s_pop_higher: number | null;
};
const CARD_SELECT = `SELECT c.*, COALESCE(s.player, p.name) name, COALESCE(p.pos, '') pos, COALESCE(p.team, '') team, p.headshot, p.jersey, t.color, t.alt, t.logo,
  t.name team_name, s.year s_year, s.set_name s_set, s.card_no s_no, s.variant s_variant, s.company s_company, s.grade s_grade, s.cert s_cert, s.flags s_flags,
  s.factors s_factors, s.mkt_source s_source, s.mkt_detail s_detail, s.est_value s_est, s.pop s_pop, s.pop_higher s_pop_higher
  FROM cards c LEFT JOIN slabs s ON s.id = c.slab_id LEFT JOIN players p ON p.id = COALESCE(s.player_id, c.player_id) LEFT JOIN nba_teams t ON t.abbr = p.team`;

/** Cards matching a WHERE clause, with the best player photo (the big NBA.com one when the name matches, else ESPN's). */
export function cardsWhere(where: string, ...params: (string | number)[]) {
  ensureSlabCards();
  return all<Card>(`${CARD_SELECT} WHERE ${where}`, ...params).map((c) => ({ ...c, photo: slabPlayerPhoto(c.name ?? "") ?? c.headshot }));
}

const rand = () => crypto.randomInt(0, 1_000_000) / 1_000_000;

/**
 * Rip a League Pack. Its slabs come from that league's pool (the players rostered in it right now). Packs bought or won
 * in a league open there; packs from before League Packs (no league) open in whichever league you rip them in.
 */
export async function openPack(userId: number, packId: number, leagueId: number): Promise<Card[]> {
  ensureSlabCards();
  const user = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
  if (!one("SELECT 1 FROM teams WHERE league_id = ? AND user_id = ?", leagueId, userId)) throw new Error("Join this league to open its packs");
  const pool = leaguePool(leagueId);
  if (!pool.length) throw new Error("This league's pack pool is empty until the draft fills its rosters");
  const ids = tx(() => {
    const up = one<{ id: number; pack_type: string; opened_at: number | null; user_id: number; league_id: number | null }>(
      "SELECT * FROM user_packs WHERE id = ? AND user_id = ?", packId, userId);
    if (!up) throw new Error("Pack not found");
    if (up.opened_at) throw new Error("Already opened");
    if (up.league_id != null && up.league_id !== leagueId) throw new Error("That pack belongs to another league. Open it there");
    const pack = PACK_BY_ID[up.pack_type];
    const out: number[] = [];
    for (let i = 0; i < pack.cards; i++) {
      const s = rollSlab(pack, pool, rand);
      out.push(insertSlab(userId, packId, s.playerId, s.rarity, s.value, s));
    }
    run("UPDATE user_packs SET opened_at = ?, league_id = ? WHERE id = ?", Date.now(), leagueId, packId);
    return out;
  });

  const cards = cardsWhere(`c.id IN (${ids.map(() => "?").join(",")}) ORDER BY c.id`, ...ids);
  const big = cards.filter((c) => c.rarity === "legendary" || c.rarity === "grail" || (c.mult != null && c.boost_pts != null));
  if (big.length && !user.is_tester) {
    for (const c of big) {
      const both = c.mult != null && c.boost_pts != null ? " with a multiplier AND a stat boost" : "";
      postSystem(leagueId, `${user.name} pulled ${c.rarity === "grail" ? "an" : "a"} ${RARITIES[c.rarity].label.toUpperCase()} ${c.name} slab${both}!`);
    }
  }
  return cards;
}

/**
 * Re-roll a slab: pay the tier's fee and the slab becomes a different player at the same rarity, picked the same way
 * packs pick (leaning a little toward better, popular players), with a fresh roll (multiplier and/or stat boost). The old slab is gone
 * (cards.sold = 4).
 */
export function rerollSlab(userId: number, cardId: number) {
  ensureSlabCards();
  const user = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
  const newId = tx(() => {
    const c = one<{ id: number; player_id: number; rarity: Rarity }>(
      "SELECT id, player_id, rarity FROM cards WHERE id = ? AND user_id = ? AND sold = 0 AND kind = 'slab'", cardId, userId);
    if (!c) throw new Error("That slab isn't in your collection");
    ensureBoosts();
    if (one("SELECT 1 FROM slab_equips WHERE consumed_at IS NULL AND card_id = ?", cardId)) throw new Error("That slab is equipped for a game. Unequip it first");
    const fee = REROLL_FEE[c.rarity];
    const coins = one<{ coins: number }>("SELECT coins FROM users WHERE id = ?", userId)!.coins;
    if (coins < fee) throw new Error(`Re-rolling a ${RARITIES[c.rarity].label} slab costs ${fmtCoins(fee)}`);
    const pick = pickPlayer(slabPool().filter((p) => p.id !== c.player_id), rand);
    const loot = rollLoot(c.rarity, pick.proj, rand);
    run("UPDATE cards SET sold = 4 WHERE id = ?", cardId);
    run("DELETE FROM profile_featured WHERE card_id = ?", cardId);
    run("UPDATE users SET coins = coins - ? WHERE id = ?", fee, userId);
    return insertSlab(userId, 0, pick.id, c.rarity, slabValue(c.rarity, pick.idx, loot), loot);
  });
  const card = cardsWhere("c.id = ?", newId)[0];
  if ((card.rarity === "legendary" || card.rarity === "grail") && !user.is_tester) {
    const msg = `${user.name} re-rolled ${card.rarity === "grail" ? "an" : "a"} ${RARITIES[card.rarity].label.toUpperCase()} slab into ${card.name}!`;
    for (const l of all<{ league_id: number }>("SELECT DISTINCT league_id FROM teams WHERE user_id = ?", userId)) postSystem(l.league_id, msg);
  }
  return card;
}

export function userCards(userId: number) {
  return cardsWhere("c.user_id = ? AND c.sold = 0 ORDER BY c.value DESC", userId);
}

export type UnopenedPack = { id: number; pack_type: string; source: string; created_at: number; league_id: number | null };
/** Unopened packs: all of them, or the ones that can be opened in one league (its own plus packs with no league). */
export function unopenedPacks(userId: number, leagueId?: number) {
  if (leagueId != null)
    return all<UnopenedPack>("SELECT * FROM user_packs WHERE user_id = ? AND opened_at IS NULL AND (league_id = ? OR league_id IS NULL) ORDER BY created_at DESC", userId, leagueId);
  return all<UnopenedPack>("SELECT * FROM user_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY created_at DESC", userId);
}

/** Sold cards go back into the vault so someone else can pull that slab. */
export function releaseSlab(cardId: number) {
  run("UPDATE slabs SET card_id = NULL WHERE card_id = ?", cardId);
}
