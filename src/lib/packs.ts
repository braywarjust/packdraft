export type PackType = {
  id: string; name: string; price: number; cards: number; color: string; accent: string; blurb: string;
  /** "case" = the multi-slab Mega Pack (wide crate art). Everything is called a pack in the UI. */
  kind?: "pack" | "case";
  // Rarity odds (percent). Higher packs shift weight toward the top tiers.
  odds: Record<Rarity, number>;
};
export type Rarity = "common" | "rare" | "epic" | "legendary" | "grail";

export const RARITIES: Record<Rarity, { label: string; mult: [number, number]; ring: string; text: string; printRun: number }> = {
  common: { label: "Common", mult: [0.6, 1.4], ring: "ring-slate-400", text: "text-zinc-700", printRun: 999 },
  rare: { label: "Rare", mult: [0.6, 1.4], ring: "ring-blue-500", text: "text-blue-400", printRun: 299 },
  epic: { label: "Epic", mult: [0.6, 1.4], ring: "ring-purple-500", text: "text-purple-400", printRun: 99 },
  legendary: { label: "Mythic", mult: [1, 3], ring: "ring-red-500", text: "text-red-500", printRun: 25 },
  grail: { label: "Immortal", mult: [6, 15], ring: "ring-sky-200", text: "text-sky-200", printRun: 1 },
};

/** Solid tier colours (match the rarity badges) and what each tier means in hobby terms. */
// Internal keys stay common/rare/epic/legendary/grail; shown as Common, Rare, Epic, Mythic, Immortal.
export const RARITY_HEX: Record<Rarity, string> = { common: "#64748b", rare: "#2563eb", epic: "#9333ea", legendary: "#dc2626", grail: "#bae6fd" };
export const RARITY_BLURB: Record<Rarity, string> = {
  common: "The everyday slab. Clean team colours, no frills.",
  rare: "A slow-turning sunburst and a light shimmer.",
  epic: "Twinkling stars around the player.",
  legendary: "A pulsing glow around the frame and a sky full of stars.",
  grail: "Everything at once: a turning icy-blue frame, a frost sheen and sparkles. The rarest slab there is.",
};
export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "grail"];

// Packs drop Slabs of active NBA players. A slab's value is fixed by its tier and how good the player is (slab-cards.ts),
// so odds are set per pack to keep the average return near 90% (simulated against the player pool: 89-100%).
export const PACKS: PackType[] = [
  { id: "rookie", name: "Rookie Pack", price: 25, cards: 1, color: "from-slate-500 to-slate-700", accent: "#94a3b8", blurb: "Cheap thrills. Every hit starts somewhere.",
    odds: { common: 94.4, rare: 5, epic: 0.5, legendary: 0.09, grail: 0.01 } },
  { id: "starter", name: "Starter Pack", price: 100, cards: 1, color: "from-sky-500 to-blue-700", accent: "#38bdf8", blurb: "Solid floor, real upside.",
    odds: { common: 50, rare: 42, epic: 7, legendary: 0.95, grail: 0.05 } },
  { id: "pro", name: "Pro Pack", price: 250, cards: 1, color: "from-emerald-500 to-teal-700", accent: "#34d399", blurb: "What weekly winners rip.",
    odds: { common: 20, rare: 48, epic: 27, legendary: 4.85, grail: 0.15 } },
  { id: "allpro", name: "All-Pro Pack", price: 500, cards: 1, color: "from-fuchsia-500 to-purple-700", accent: "#e879f9", blurb: "Boosted Epic odds.",
    odds: { common: 2, rare: 36, epic: 46, legendary: 15.6, grail: 0.4 } },
  { id: "hof", name: "Hall of Fame Pack", price: 1000, cards: 1, color: "from-amber-400 to-orange-600", accent: "#fbbf24", blurb: "Top scorer of the week gets one of these.",
    odds: { common: 0, rare: 15, epic: 40, legendary: 44, grail: 1 } },
  { id: "goat", name: "GOAT Pack", price: 2500, cards: 1, color: "from-rose-500 via-amber-400 to-emerald-400", accent: "#fb7185", blurb: "Big money. Mythic chase.",
    odds: { common: 0, rare: 0, epic: 10, legendary: 82, grail: 8 } },
  { id: "megacase", name: "Mega Pack", price: 10000, cards: 5, kind: "case", color: "from-zinc-900 via-amber-500 to-zinc-900", accent: "#f5c15c", blurb: "Five slabs, all Epic or better. The big rip.",
    odds: { common: 0, rare: 0, epic: 12, legendary: 83, grail: 5 } },
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

/** "8.5%", or "1 in 25,000" for odds too small to read as a percentage. */
export function fmtOdds(pct: number) {
  if (!pct) return "-";
  if (pct >= 0.01) return `${pct}%`;
  return `1 in ${Math.round(100 / pct).toLocaleString("en-US")}`;
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
