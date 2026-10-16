import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { all, one, run, tx } from "./db";
import { parseSlab, scoreSlab, estimateValue } from "./slab-rules";
import type { Rarity } from "./packs";

/** Folder of slab photos. Override with SLABS_DIR in .env.local. */
export const SLABS_DIR = process.env.SLABS_DIR || path.join(os.homedir(), "NBA_Slabs_webp");

// Share of the catalog in each rarity tier, from lowest to highest score.
export const TIER_SHARE: [Rarity, number][] = [["common", 0.55], ["rare", 0.27], ["epic", 0.12], ["legendary", 0.045], ["grail", 0.015]];

export type Slab = {
  id: number; file: string; era: string; year: number; set_name: string; card_no: string | null; player: string; variant: string;
  company: string; grade: string; grade_num: number | null; cert: string; flags: string; factors: string; player_tier: string;
  player_id: number | null; score: number; rarity: Rarity; est_value: number; mkt_value: number | null; mkt_source: string | null;
  mkt_detail: string | null; mkt_at: number | null; pop: number | null; pop_higher: number | null; pop_at: number | null; card_id: number | null;
};

function listFiles(dir: string, base = ""): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, rel));
    else if (e.name.toLowerCase().endsWith(".webp")) out.push(rel);
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

let checked = false;
/** Scan the slab folder into the DB (once per server start, and whenever the file count changes). */
export function ensureCatalog() {
  if (checked) return;
  checked = true;
  if (!fs.existsSync(SLABS_DIR)) {
    console.warn(`[packdraft] slab folder not found: ${SLABS_DIR}`);
    return;
  }
  const files = listFiles(SLABS_DIR);
  const known = one<{ n: number }>("SELECT COUNT(*) n FROM slabs WHERE missing = 0")?.n ?? 0;
  if (known === files.length) return;

  const players = all<{ id: number; name: string; proj: number }>("SELECT id, name, proj FROM players WHERE active = 1 ORDER BY proj DESC");
  const stars = new Set(players.slice(0, 60).map((p) => norm(p.name)));
  const active = new Set(players.map((p) => norm(p.name)));
  const idByName = new Map(players.map((p) => [norm(p.name), p.id]));

  const rows = files.flatMap((f) => {
    const m = parseSlab(f);
    if (!m) return [];
    const s = scoreSlab(m, stars, active);
    return [{ m, s }];
  });
  // Rarity tiers are percentiles of the score so the distribution stays fixed as the folder changes.
  const sorted = [...rows].sort((a, b) => a.s.score - b.s.score);
  const rarity = new Map<string, Rarity>();
  let i = 0;
  for (const [tier, share] of TIER_SHARE) {
    const end = tier === "grail" ? sorted.length : Math.min(sorted.length, i + Math.round(share * sorted.length));
    for (; i < end; i++) rarity.set(sorted[i].m.file, tier);
  }

  tx(() => {
    run("UPDATE slabs SET missing = 1");
    for (const { m, s } of rows) {
      const flags = JSON.stringify({ auto: m.auto, mem: m.mem, rookie: m.rookie, parallel: m.parallel, numbered: m.numbered, premium: m.premium, insert: m.superInsert, blackLabel: m.blackLabel });
      run(`INSERT INTO slabs (file, era, year, set_name, card_no, player, variant, company, grade, grade_num, cert, flags, factors, player_tier, player_id, score, rarity, est_value, missing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
           ON CONFLICT(file) DO UPDATE SET era = excluded.era, year = excluded.year, set_name = excluded.set_name, card_no = excluded.card_no,
             player = excluded.player, variant = excluded.variant, company = excluded.company, grade = excluded.grade, grade_num = excluded.grade_num,
             cert = excluded.cert, flags = excluded.flags, factors = excluded.factors, player_tier = excluded.player_tier, player_id = excluded.player_id,
             score = excluded.score, rarity = excluded.rarity, est_value = excluded.est_value, missing = 0`,
        m.file, m.era, m.year, m.setName, m.cardNo, m.player, m.variant, m.company, m.grade, m.gradeNum, m.cert, flags,
        JSON.stringify(s.factors), s.playerTier, idByName.get(norm(m.player)) ?? null, s.score, rarity.get(m.file)!, estimateValue(s.score, m.cert));
    }
  });
  console.log(`[packdraft] slab catalog: ${rows.length} slabs from ${SLABS_DIR}`);
}

const TIER_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "grail"];

/** Pick an unowned slab of the given rarity whose value is near the target. Falls back to neighbouring tiers. */
export function pickSlab(rarity: Rarity, target: number, rand: () => number): Slab | null {
  const start = TIER_ORDER.indexOf(rarity);
  const order = [start, start - 1, start + 1, start - 2, start + 2].filter((x) => x >= 0 && x < TIER_ORDER.length);
  for (const t of order) {
    const near = all<Slab>(
      "SELECT * FROM slabs WHERE rarity = ? AND card_id IS NULL AND missing = 0 ORDER BY ABS(est_value - ?) LIMIT 15",
      TIER_ORDER[t], target);
    if (near.length) return near[Math.floor(rand() * near.length)];
  }
  return null;
}

export const slabValue = (s: Pick<Slab, "mkt_value" | "est_value">) => s.mkt_value ?? s.est_value;

export function slabFilePath(file: string) {
  const full = path.resolve(SLABS_DIR, file);
  if (!full.startsWith(path.resolve(SLABS_DIR) + path.sep)) throw new Error("Bad path");
  return full;
}

export function catalogStats() {
  return all<{ rarity: Rarity; n: number; owned: number; lo: number; hi: number; avg: number }>(
    `SELECT rarity, COUNT(*) n, SUM(card_id IS NOT NULL) owned, MIN(est_value) lo, MAX(est_value) hi, AVG(est_value) avg
     FROM slabs WHERE missing = 0 GROUP BY rarity`);
}
