export type PackType = {
  id: string; name: string; price: number; cards: number; color: string; accent: string; blurb: string;
  /** "case" = the multi-slab Mega Pack (wide crate art). Everything is called a pack in the UI. */
  kind?: "pack" | "case";
  /** Multiplier-tier odds for player slabs (percent). Higher packs shift weight toward the big multipliers. */
  odds: Record<Rarity, number>;
  /** Percent of slabs that are generic (any-player) slabs instead of player slabs. */
  generic: number;
  /** Percent of slabs that drop with the Immortal certification. */
  immortal: number;
};
// Tier keys: common/rare/epic/legendary/grail. A player slab's tier is its multiplier range (1.10X up to 10X); generic slabs
// only come in the bottom three tiers. Old graded slabs (pre-redesign) keep their tier as a value band.
export type Rarity = "common" | "rare" | "epic" | "legendary" | "grail";

export const RARITIES: Record<Rarity, { label: string; ring: string; text: string }> = {
  common: { label: "Common", ring: "ring-slate-400", text: "text-zinc-700" },
  rare: { label: "Rare", ring: "ring-blue-500", text: "text-blue-400" },
  epic: { label: "Epic", ring: "ring-purple-500", text: "text-purple-400" },
  legendary: { label: "Mythic", ring: "ring-red-500", text: "text-red-500" },
  grail: { label: "Grail", ring: "ring-amber-300", text: "text-amber-300" },
};

/**
 * Fantasy points multiplier range per tier. Every slab rolls its own exact multiplier inside its tier's range (to the
 * hundredth, like 3.33X), weighted toward the low end, so the same player can drop in many versions and the top of a
 * range is the one to chase. A perfect 10.00X is the rarest roll there is.
 */
export const PLAYER_RANGE: Record<Rarity, [number, number]> = {
  common: [1.1, 1.99], rare: [2, 2.99], epic: [3, 4.49], legendary: [4.5, 7.49], grail: [7.5, 10],
};
/** Generic slabs work on anyone, so they stay small. */
export const GENERIC_RANGE: Partial<Record<Rarity, [number, number]>> = { common: [1.01, 1.14], rare: [1.15, 1.29], epic: [1.3, 1.5] };
/** Tier odds for generic slabs (percent), the same in every pack. */
export const GENERIC_ODDS: Partial<Record<Rarity, number>> = { common: 70, rare: 25, epic: 5 };
/** "10X", "3.30X", "1.25X". */
export const fmtMult = (m: number) => (Math.abs(m - Math.round(m)) < 0.001 ? `${Math.round(m)}X` : `${m.toFixed(2)}X`);
/** "4.50–7.49X". */
export const fmtRange = ([lo, hi]: [number, number]) => `${lo.toFixed(2)}–${fmtMult(hi)}`;

/** Solid tier colours (match the rarity badges) and what each tier means. */
export const RARITY_HEX: Record<Rarity, string> = { common: "#64748b", rare: "#2563eb", epic: "#9333ea", legendary: "#dc2626", grail: "#f5b70a" };
export const RARITY_BLURB: Record<Rarity, string> = {
  common: "Player slabs from 1.10X to 1.99X, plus generics that work on anyone. The bread and butter of every rip.",
  rare: "Player slabs from 2.00X to 2.99X.",
  epic: "Player slabs from 3.00X to 4.49X, and the best generics, up to 1.50X.",
  legendary: "Player slabs from 4.50X to 7.49X. Mostly role players; a Mythic star is a real pull.",
  grail: "Player slabs from 7.50X all the way to 10X, almost never on a superstar. A perfect 10X is the rarest roll there is.",
};
export const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary", "grail"];

// Slab values are fixed per tier and player (see slab-cards.ts), so odds are set per pack to keep the average return
// near 90% of the price (simulated against the starter pool: 87-101%).
export const PACKS: PackType[] = [
  { id: "rookie", name: "Rookie Pack", price: 25, cards: 1, color: "from-slate-500 to-slate-700", accent: "#94a3b8", blurb: "Cheap thrills. Mostly generics.",
    generic: 60, immortal: 0.5, odds: { common: 88, rare: 10.5, epic: 1.3, legendary: 0.18, grail: 0.02 } },
  { id: "starter", name: "Starter Pack", price: 100, cards: 1, color: "from-sky-500 to-blue-700", accent: "#38bdf8", blurb: "Solid floor, real upside.",
    generic: 40, immortal: 1, odds: { common: 50, rare: 35, epic: 12, legendary: 2.7, grail: 0.3 } },
  { id: "pro", name: "Pro Pack", price: 250, cards: 1, color: "from-emerald-500 to-teal-700", accent: "#34d399", blurb: "What weekly winners rip.",
    generic: 25, immortal: 1.5, odds: { common: 25, rare: 40, epic: 27, legendary: 7, grail: 1 } },
  { id: "allpro", name: "All-Pro Pack", price: 500, cards: 1, color: "from-fuchsia-500 to-purple-700", accent: "#e879f9", blurb: "Boosted Epic odds.",
    generic: 10, immortal: 2, odds: { common: 3, rare: 38, epic: 43, legendary: 14.2, grail: 1.8 } },
  { id: "hof", name: "Hall of Fame Pack", price: 1000, cards: 1, color: "from-amber-400 to-orange-600", accent: "#fbbf24", blurb: "Top scorer of the week gets one of these.",
    generic: 0, immortal: 3, odds: { common: 0, rare: 20, epic: 45, legendary: 31, grail: 4 } },
  { id: "goat", name: "GOAT Pack", price: 2500, cards: 1, color: "from-rose-500 via-amber-400 to-emerald-400", accent: "#fb7185", blurb: "Big money. 10X chase.",
    generic: 0, immortal: 5, odds: { common: 0, rare: 0, epic: 30, legendary: 56, grail: 14 } },
  { id: "megacase", name: "Mega Pack", price: 10000, cards: 5, kind: "case", color: "from-zinc-900 via-amber-500 to-zinc-900", accent: "#f5c15c", blurb: "Five player slabs, all 3X or better.",
    generic: 0, immortal: 5, odds: { common: 0, rare: 0, epic: 40, legendary: 49, grail: 11 } },
];
export const PACK_BY_ID: Record<string, PackType> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

export const BUYBACK_RATE = 0.9;

/** "8.5%", or "1 in 25,000" for odds too small to read as a percentage. */
export function fmtOdds(pct: number) {
  if (!pct) return "-";
  if (pct >= 0.01) return `${pct}%`;
  return `1 in ${Math.round(100 / pct).toLocaleString("en-US")}`;
}

export function rollRarity(odds: Partial<Record<Rarity, number>>, r: number): Rarity {
  let acc = 0;
  const order: Rarity[] = ["grail", "legendary", "epic", "rare", "common"];
  for (const k of order) {
    acc += (odds[k] ?? 0) / 100;
    if (r < acc) return k;
  }
  return "common";
}

/** Plain-text Pack Points (for confirm dialogs, chat messages, titles). In JSX use <Coins n={...} />. */
export const fmtCoins = (n: number) => `${Math.round(n).toLocaleString("en-US")} Pack Points`;
