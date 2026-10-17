export type PackType = {
  id: string; name: string; price: number; cards: number; color: string; accent: string; blurb: string;
  /** "case" = the multi-slab Mega Case (wider box art, featured in the shop). */
  kind?: "pack" | "case";
  // Rarity odds (percent). Higher packs shift weight toward the top tiers.
  odds: Record<Rarity, number>;
};
export type Rarity = "common" | "rare" | "epic" | "legendary" | "grail";

export const RARITIES: Record<Rarity, { label: string; mult: [number, number]; ring: string; text: string; printRun: number }> = {
  common: { label: "Base", mult: [0.08, 0.2], ring: "ring-slate-400", text: "text-zinc-700", printRun: 999 },
  rare: { label: "Chase", mult: [0.2, 0.45], ring: "ring-sky-400", text: "text-sky-700", printRun: 299 },
  epic: { label: "Short Print", mult: [0.5, 1.2], ring: "ring-fuchsia-400", text: "text-fuchsia-600", printRun: 99 },
  legendary: { label: "Case Hit", mult: [1.5, 4], ring: "ring-amber-400", text: "text-amber-600", printRun: 25 },
  grail: { label: "Grail", mult: [6, 15], ring: "ring-emerald-300", text: "text-emerald-700", printRun: 1 },
};

export const PACKS: PackType[] = [
  { id: "rookie", name: "Rookie Pack", price: 25, cards: 1, color: "from-slate-500 to-slate-700", accent: "#94a3b8", blurb: "Cheap thrills. Every hit starts somewhere.",
    odds: { common: 90, rare: 8.5, epic: 1.3, legendary: 0.18, grail: 0.02  } },
  { id: "starter", name: "Starter Pack", price: 100, cards: 1, color: "from-sky-500 to-blue-700", accent: "#38bdf8", blurb: "Solid floor, real upside.",
    odds: { common: 70, rare: 23, epic: 5.6, legendary: 1.2, grail: 0.2  } },
  { id: "pro", name: "Pro Pack", price: 250, cards: 1, color: "from-emerald-500 to-teal-700", accent: "#34d399", blurb: "What weekly winners rip.",
    odds: { common: 52, rare: 30, epic: 13, legendary: 4.3, grail: 0.7 } },
  { id: "allpro", name: "All-Pro Pack", price: 500, cards: 1, color: "from-fuchsia-500 to-purple-700", accent: "#e879f9", blurb: "Boosted Short Print odds.",
    odds: { common: 40, rare: 33, epic: 19, legendary: 7, grail: 1  } },
  { id: "hof", name: "Hall of Fame Pack", price: 1000, cards: 1, color: "from-amber-400 to-orange-600", accent: "#fbbf24", blurb: "Top scorer of the week gets one of these.",
    odds: { common: 28, rare: 34, epic: 25, legendary: 11, grail: 2  } },
  { id: "goat", name: "GOAT Pack", price: 2500, cards: 1, color: "from-rose-500 via-amber-400 to-emerald-400", accent: "#fb7185", blurb: "Big money. Grail chase.",
    odds: { common: 5, rare: 25, epic: 37, legendary: 25, grail: 8  } },
  { id: "megacase", name: "Mega Case", price: 10000, cards: 5, kind: "case", color: "from-zinc-900 via-amber-500 to-zinc-900", accent: "#f5c15c", blurb: "Five slabs, zero commons. The big rip.",
    odds: { common: 0, rare: 12, epic: 42, legendary: 34, grail: 12 } },
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

/** Plain-text Pack Points (for confirm dialogs, chat messages, titles). In JSX use <Coins n={...} />. */
export const fmtCoins = (n: number) => `${Math.round(n).toLocaleString("en-US")} Pack Points`;
