import crypto from "node:crypto";
import { all, one, run, tx, Player, User } from "./db";
import { PACK_BY_ID, RARITIES, Rarity, gradeFor, rollRarity, valueScale, fmtCoins } from "./packs";
import { postSystem } from "./league";

export type Card = {
  id: number; player_id: number; name: string; pos: string; team: string; rarity: Rarity; grade: number;
  serial: number; print_run: number; value: number; sold: number; created_at: number;
};

const GRADE_MULT: Record<number, number> = { 10: 1.5, 9.5: 1.15, 9: 1, 8.5: 0.9, 8: 0.8 };
const rand = () => crypto.randomInt(0, 1_000_000) / 1_000_000;

export function openPack(userId: number, packId: number): Card[] {
  const user = one<User>("SELECT * FROM users WHERE id = ?", userId)!;
  const created = tx(() => {
    const up = one<{ id: number; pack_type: string; opened_at: number | null; user_id: number }>(
      "SELECT * FROM user_packs WHERE id = ? AND user_id = ?", packId, userId);
    if (!up) throw new Error("Pack not found");
    if (up.opened_at) throw new Error("Already opened");
    const pack = PACK_BY_ID[up.pack_type];
    const players = all<Player>("SELECT * FROM players ORDER BY adp");
    const scale = valueScale(pack);
    const ids: number[] = [];
    for (let i = 0; i < pack.cards; i++) {
      const rarity = rollRarity(pack.odds, rand());
      const poolSize = rarity === "grail" || rarity === "legendary" ? 40 : rarity === "epic" ? 100 : players.length;
      const player = players[Math.floor(Math.pow(rand(), 1.3) * poolSize)];
      const grade = gradeFor(rand());
      const [lo, hi] = RARITIES[rarity].mult;
      const value = Math.max(1, Math.round(pack.price * scale * (lo + (hi - lo) * rand()) * GRADE_MULT[grade]));
      const printRun = RARITIES[rarity].printRun;
      const serial = 1 + Math.floor(rand() * printRun);
      const r = run(
        "INSERT INTO cards (user_id, pack_id, player_id, rarity, grade, serial, print_run, value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        userId, packId, player.id, rarity, grade, serial, printRun, value, Date.now(),
      );
      ids.push(Number(r.lastInsertRowid));
    }
    run("UPDATE user_packs SET opened_at = ? WHERE id = ?", Date.now(), packId);
    return ids;
  });
  const cards = all<Card>(
    `SELECT c.*, p.name, p.pos, p.team FROM cards c JOIN players p ON p.id = c.player_id WHERE c.id IN (${created.map(() => "?").join(",")}) ORDER BY c.id`,
    ...created,
  );
  // Brag about big pulls in every league the user is in.
  const big = cards.filter((c) => c.rarity === "legendary" || c.rarity === "grail" || c.rarity === "epic");
  if (big.length) {
    const leagues = all<{ league_id: number }>("SELECT DISTINCT league_id FROM teams WHERE user_id = ?", userId);
    for (const c of big) {
      const msg = `🔥 ${user.name} pulled a ${RARITIES[c.rarity].label.toUpperCase()} ${c.name} (Grade ${c.grade}, #${c.serial}/${c.print_run}) worth ${fmtCoins(c.value)}!`;
      for (const l of leagues) postSystem(l.league_id, msg);
    }
  }
  return cards;
}

export function userCards(userId: number) {
  return all<Card>(
    "SELECT c.*, p.name, p.pos, p.team FROM cards c JOIN players p ON p.id = c.player_id WHERE c.user_id = ? AND c.sold = 0 ORDER BY c.value DESC",
    userId,
  );
}

export function unopenedPacks(userId: number) {
  return all<{ id: number; pack_type: string; source: string; created_at: number }>(
    "SELECT * FROM user_packs WHERE user_id = ? AND opened_at IS NULL ORDER BY created_at DESC", userId);
}
