import crypto from "node:crypto";
import { all, one, run, tx, User } from "./db";
import { PACK_BY_ID, RARITIES, Rarity, rollRarity, valueScale, fmtCoins } from "./packs";
import { postSystem } from "./league";
import { ensureCatalog, pickSlab, slabValue } from "./slabs";
import { refreshMarket } from "./market";

/** A card in someone's collection. New cards are real slabs (slab_id set); a few early cards are generated art. */
export type Card = {
  id: number; player_id: number; slab_id: number | null; name: string; pos: string; team: string; rarity: Rarity; grade: number;
  serial: number; print_run: number; value: number; sold: number; created_at: number;
  headshot: string | null; jersey: string | null; color: string | null; alt: string | null; logo: string | null;
  // Slab details (null for generated cards)
  s_year: number | null; s_set: string | null; s_no: string | null; s_variant: string | null; s_company: string | null; s_grade: string | null;
  s_cert: string | null; s_flags: string | null; s_factors: string | null; s_source: string | null; s_detail: string | null;
  s_est: number | null; s_pop: number | null; s_pop_higher: number | null;
};
const CARD_SELECT = `SELECT c.*, COALESCE(s.player, p.name) name, COALESCE(p.pos, '') pos, COALESCE(p.team, '') team, p.headshot, p.jersey, t.color, t.alt, t.logo,
  s.year s_year, s.set_name s_set, s.card_no s_no, s.variant s_variant, s.company s_company, s.grade s_grade, s.cert s_cert, s.flags s_flags,
  s.factors s_factors, s.mkt_source s_source, s.mkt_detail s_detail, s.est_value s_est, s.pop s_pop, s.pop_higher s_pop_higher
  FROM cards c LEFT JOIN slabs s ON s.id = c.slab_id LEFT JOIN players p ON p.id = COALESCE(s.player_id, c.player_id) LEFT JOIN nba_teams t ON t.abbr = p.team`;

const rand = () => crypto.randomInt(0, 1_000_000) / 1_000_000;

export async function openPack(userId: number, packId: number): Promise<Card[]> {
  ensureCatalog();
  const user = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
  const picked = tx(() => {
    const up = one<{ id: number; pack_type: string; opened_at: number | null; user_id: number }>(
      "SELECT * FROM user_packs WHERE id = ? AND user_id = ?", packId, userId);
    if (!up) throw new Error("Pack not found");
    if (up.opened_at) throw new Error("Already opened");
    const pack = PACK_BY_ID[up.pack_type];
    const scale = valueScale(pack);
    const out: { cardId: number; slabId: number }[] = [];
    for (let i = 0; i < pack.cards; i++) {
      const rarity = rollRarity(pack.odds, rand());
      const [lo, hi] = RARITIES[rarity].mult;
      const target = pack.price * scale * (lo + (hi - lo) * rand());
      const slab = pickSlab(rarity, target, rand);
      if (!slab) throw new Error("The vault is empty! Sell some cards back to restock it.");
      const gradeNum = slab.grade_num ?? 0;
      const r = run(
        "INSERT INTO cards (user_id, pack_id, player_id, slab_id, rarity, grade, serial, print_run, value, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)",
        userId, packId, slab.player_id ?? 0, slab.id, slab.rarity, gradeNum, slabValue(slab), Date.now());
      const cardId = Number(r.lastInsertRowid);
      run("UPDATE slabs SET card_id = ? WHERE id = ?", cardId, slab.id);
      out.push({ cardId, slabId: slab.id });
    }
    run("UPDATE user_packs SET opened_at = ? WHERE id = ?", Date.now(), packId);
    return out;
  });

  // Price each pulled slab against the real market (when eBay keys are set), then lock in that value.
  await refreshMarket(picked.map((p) => p.slabId));
  for (const p of picked) {
    const s = one<{ mkt_value: number | null; est_value: number }>("SELECT mkt_value, est_value FROM slabs WHERE id = ?", p.slabId)!;
    run("UPDATE cards SET value = ? WHERE id = ?", slabValue(s), p.cardId);
  }

  const ids = picked.map((p) => p.cardId);
  const cards = all<Card>(`${CARD_SELECT} WHERE c.id IN (${ids.map(() => "?").join(",")}) ORDER BY c.id`, ...ids);
  const big = cards.filter((c) => c.rarity === "legendary" || c.rarity === "grail" || c.rarity === "epic");
  if (big.length) {
    const leagues = all<{ league_id: number }>("SELECT DISTINCT league_id FROM teams WHERE user_id = ?", userId);
    for (const c of big) {
      const msg = `🔥 ${user.name} pulled a ${RARITIES[c.rarity].label.toUpperCase()}: ${c.s_year} ${c.s_set} ${c.name}${c.s_variant ? ` ${c.s_variant}` : ""} ${c.s_company} ${c.s_grade} worth ${fmtCoins(c.value)}!`;
      for (const l of leagues) postSystem(l.league_id, msg);
    }
  }
  return cards;
}

export function userCards(userId: number) {
  return all<Card>(`${CARD_SELECT} WHERE c.user_id = ? AND c.sold = 0 ORDER BY c.value DESC`, userId);
}

export function unopenedPacks(userId: number) {
  return all<{ id: number; pack_type: string; source: string; created_at: number }>(
    "SELECT * FROM user_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY created_at DESC", userId);
}

/** Sold cards go back into the vault so someone else can pull that slab. */
export function releaseSlab(cardId: number) {
  run("UPDATE slabs SET card_id = NULL WHERE card_id = ?", cardId);
}
