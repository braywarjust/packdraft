import crypto from "node:crypto";
import { all, one, run, tx, User } from "./db";
import { PACK_BY_ID, RARITIES, Rarity, TRADE_UP, TRADE_UP_COUNT, fmtCoins } from "./packs";
import { postSystem } from "./league";
import { ensureSlabCards, nextSerial, rollSlab, slabPool } from "./slab-cards";
import { popularity, slabPrice } from "./slab-market";
import { slabPlayerPhoto } from "./nba/photos";
import { immortalArt } from "./immortal-art";

/**
 * A card in someone's collection. New cards are Slabs (kind 'slab'): an active player at a tier. Older cards are
 * real graded slabs from the photo vault (slab_id) or, from the very first build, generated art.
 */
export type Card = {
  id: number; player_id: number; slab_id: number | null; kind: string | null; name: string; pos: string; team: string; rarity: Rarity; grade: number;
  serial: number; print_run: number; value: number; sold: number; created_at: number; team_name: string | null; photo: string | null;
  /** Immortal variant close-up (immortal-art.ts), when this is an Immortal of a player who has one. */
  action?: string | null;
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
  return all<Card>(`${CARD_SELECT} WHERE ${where}`, ...params).map((c) => ({
    ...c, photo: slabPlayerPhoto(c.name ?? "") ?? c.headshot, action: c.kind === "slab" && c.rarity === "grail" ? immortalArt(c.player_id) : null,
  }));
}

const rand = () => crypto.randomInt(0, 1_000_000) / 1_000_000;

export async function openPack(userId: number, packId: number): Promise<Card[]> {
  ensureSlabCards();
  const user = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
  const pool = slabPool();
  if (!pool.length) throw new Error("No NBA rosters loaded yet");
  const ids = tx(() => {
    const up = one<{ id: number; pack_type: string; opened_at: number | null; user_id: number }>(
      "SELECT * FROM user_packs WHERE id = ? AND user_id = ?", packId, userId);
    if (!up) throw new Error("Pack not found");
    if (up.opened_at) throw new Error("Already opened");
    const pack = PACK_BY_ID[up.pack_type];
    const out: number[] = [];
    for (let i = 0; i < pack.cards; i++) {
      const s = rollSlab(pack, pool, rand);
      const r = run(
        `INSERT INTO cards (user_id, pack_id, player_id, slab_id, rarity, grade, serial, print_run, value, kind, created_at)
         VALUES (?, ?, ?, NULL, ?, 0, ?, 0, ?, 'slab', ?)`,
        userId, packId, s.playerId, s.rarity, nextSerial(s.playerId, s.rarity), s.value, Date.now());
      out.push(Number(r.lastInsertRowid));
    }
    run("UPDATE user_packs SET opened_at = ? WHERE id = ?", Date.now(), packId);
    return out;
  });

  const cards = cardsWhere(`c.id IN (${ids.map(() => "?").join(",")}) ORDER BY c.id`, ...ids);
  const big = cards.filter((c) => c.rarity === "legendary" || c.rarity === "grail");
  if (big.length && !user.is_tester) {
    const leagues = all<{ league_id: number }>("SELECT DISTINCT league_id FROM teams WHERE user_id = ?", userId);
    for (const c of big) {
      const msg = `${user.name} pulled ${c.rarity === "grail" ? "an" : "a"} ${RARITIES[c.rarity].label.toUpperCase()} ${c.name} slab worth ${fmtCoins(c.value)}!`;
      for (const l of leagues) postSystem(l.league_id, msg);
    }
  }
  return cards;
}

/**
 * Trade five of your Slabs of one tier (plus the fee) for one Slab of the next tier up. If all five are the same player
 * you get him again a tier higher; otherwise the new slab's player is drawn like a pack pull. The five are used up
 * (sold = 2, so they leave the collection but stay on record).
 */
export function tradeUp(userId: number, cardIds: number[]) {
  ensureSlabCards();
  const ids = [...new Set(cardIds)];
  if (ids.length !== TRADE_UP_COUNT) throw new Error(`Pick exactly ${TRADE_UP_COUNT} slabs`);
  const user = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
  const newId = tx(() => {
    const cards = all<{ id: number; player_id: number; rarity: Rarity }>(
      `SELECT id, player_id, rarity FROM cards WHERE user_id = ? AND sold = 0 AND kind = 'slab' AND id IN (${ids.map(() => "?").join(",")})`, userId, ...ids);
    if (cards.length !== TRADE_UP_COUNT) throw new Error("Those slabs aren't all in your collection");
    const tier = cards[0].rarity;
    if (cards.some((c) => c.rarity !== tier)) throw new Error("All five slabs need to be the same rarity");
    const step = TRADE_UP[tier];
    if (!step) throw new Error(`${RARITIES[tier].label} is the top rarity, so it can't be traded up`);
    const coins = one<{ coins: number }>("SELECT coins FROM users WHERE id = ?", userId)!.coins;
    if (coins < step.fee) throw new Error(`Trading up to ${RARITIES[step.to].label} costs ${fmtCoins(step.fee)}`);
    const pool = slabPool();
    const same = cards.every((c) => c.player_id === cards[0].player_id);
    let pick = same ? pool.find((p) => p.id === cards[0].player_id) : undefined;
    if (!pick) {
      const w = pool.map((p) => Math.max(3, p.proj) ** 0.7 * Math.sqrt(popularity(p.name)));
      let x = rand() * w.reduce((s, v) => s + v, 0);
      pick = pool[pool.length - 1];
      for (let i = 0; i < pool.length; i++) if ((x -= w[i]) <= 0) { pick = pool[i]; break; }
    }
    run(`UPDATE cards SET sold = 2 WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
    run("UPDATE users SET coins = coins - ? WHERE id = ?", step.fee, userId);
    const r = run(
      `INSERT INTO cards (user_id, pack_id, player_id, slab_id, rarity, grade, serial, print_run, value, kind, created_at)
       VALUES (?, 0, ?, NULL, ?, 0, ?, 0, ?, 'slab', ?)`,
      userId, pick.id, step.to, nextSerial(pick.id, step.to), slabPrice(step.to, pick.idx), Date.now());
    return Number(r.lastInsertRowid);
  });
  const card = cardsWhere("c.id = ?", newId)[0];
  if ((card.rarity === "legendary" || card.rarity === "grail") && !user.is_tester) {
    const msg = `${user.name} traded up five slabs into ${card.rarity === "grail" ? "an" : "a"} ${RARITIES[card.rarity].label.toUpperCase()} ${card.name} worth ${fmtCoins(card.value)}!`;
    for (const l of all<{ league_id: number }>("SELECT DISTINCT league_id FROM teams WHERE user_id = ?", userId)) postSystem(l.league_id, msg);
  }
  return card;
}

export function userCards(userId: number) {
  return cardsWhere("c.user_id = ? AND c.sold = 0 ORDER BY c.value DESC", userId);
}

export function unopenedPacks(userId: number) {
  return all<{ id: number; pack_type: string; source: string; created_at: number }>(
    "SELECT * FROM user_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY created_at DESC", userId);
}

/** Sold cards go back into the vault so someone else can pull that slab. */
export function releaseSlab(cardId: number) {
  run("UPDATE slabs SET card_id = NULL WHERE card_id = ?", cardId);
}
