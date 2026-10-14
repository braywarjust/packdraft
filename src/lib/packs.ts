export type PackType = {
  id: string; name: string; price: number; cards: number; color: string; accent: string; blurb: string;
  // Rarity odds (percent). Higher packs shift weight toward the top tiers.
  odds: Record<Rarity, number>;
};
export type Rarity = "common" | "rare" | "epic" | "legendary" | "grail";

export const RARITIES: Record<Rarity, { label: string; mult: [number, number]; ring: string; text: string; printRun: number }> = {
  common: { label: "Common", mult: [0.08, 0.2], ring: "ring-slate-400", text: "text-slate-300", printRun: 999 },
  rare: { label: "Rare", mult: [0.2, 0.45], ring: "ring-sky-400", text: "text-sky-300", printRun: 299 },
  epic: { label: "Epic", mult: [0.5, 1.2], ring: "ring-fuchsia-400", text: "text-fuchsia-300", printRun: 99 },
  legendary: { label: "Legendary", mult: [1.5, 4], ring: "ring-amber-400", text: "text-amber-300", printRun: 25 },
  grail: { label: "Grail 1/1", mult: [6, 15], ring: "ring-emerald-300", text: "text-emerald-300", printRun: 1 },
};

export const PACKS: PackType[] = [
  { id: "rookie", name: "Rookie Pack", price: 25, cards: 3, color: "from-slate-500 to-slate-700", accent: "#94a3b8", blurb: "Cheap thrills. Every hit starts somewhere.",
    odds: { common: 62, rare: 27, epic: 8.5, legendary: 2.2, grail: 0.3 } },
  { id: "starter", name: "Starter Pack", price: 100, cards: 3, color: "from-sky-500 to-blue-700", accent: "#38bdf8", blurb: "Solid floor, real upside.",
    odds: { common: 56, rare: 29, epic: 11, legendary: 3.5, grail: 0.5 } },
  { id: "pro", name: "Pro Pack", price: 250, cards: 4, color: "from-emerald-500 to-teal-700", accent: "#34d399", blurb: "What weekly winners rip.",
    odds: { common: 52, rare: 30, epic: 13, legendary: 4.3, grail: 0.7 } },
  { id: "allpro", name: "All-Pro Pack", price: 500, cards: 4, color: "from-fuchsia-500 to-purple-700", accent: "#e879f9", blurb: "Boosted Epic odds.",
    odds: { common: 46, rare: 31, epic: 16, legendary: 6, grail: 1 } },
  { id: "hof", name: "Hall of Fame Pack", price: 1000, cards: 5, color: "from-amber-400 to-orange-600", accent: "#fbbf24", blurb: "Top scorer of the week gets one of these.",
    odds: { common: 40, rare: 32, epic: 18.5, legendary: 8, grail: 1.5 } },
  { id: "goat", name: "GOAT Pack", price: 5000, cards: 5, color: "from-rose-500 via-amber-400 to-emerald-400", accent: "#fb7185", blurb: "Big money. Grail chase.",
    odds: { common: 30, rare: 32, epic: 23, legendary: 12, grail: 3 } },
];
export const PACK_BY_ID: Record<string, PackType> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

export const BUYBACK_RATE = 0.9;

function expectedPerCard(odds: PackType["odds"]) {
  let ev = 0;
  for (const [r, pct] of Object.entries(odds)) {
    const [lo, hi] = RARITIES[r as Rarity].mult;
    ev += (pct / 100) * ((lo + hi) / 2);
  }
  return ev;
}

/** Scale card values so a pack returns ~92% of its price on average (like real "vending machine" packs). */
export function valueScale(pack: PackType) {
  return 0.92 / (pack.cards * expectedPerCard(pack.odds));
}

export function rollRarity(odds: PackType["odds"], r: number): Rarity {
  let acc = 0;
  const order: Rarity[] = ["grail", "legendary", "epic", "rare", "common"];
  for (const k of order) {
    acc += odds[k] / 100;
    if (r < acc) return k;
  }
  return "common";
}

export function gradeFor(r: number) {
  // PSA-style grades, gem mints are rare.
  if (r < 0.06) return 10;
  if (r < 0.3) return 9.5;
  if (r < 0.65) return 9;
  if (r < 0.88) return 8.5;
  return 8;
}

export const fmtCoins = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
