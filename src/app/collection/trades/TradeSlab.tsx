import { RARITIES } from "@/lib/packs";
import { Slab } from "@/components/Slab";
import { SlabImage, slabOf, type CardData } from "@/components/PlayerCard";

/** A small picture of any card in a trade: a Slab, a graded vault slab, or (very old cards) the player's initials. */
export function TradeThumb({ c, size = 64 }: { c: CardData; size?: number }) {
  if (c.kind === "slab") return <Slab s={slabOf(c)} size={size} />;
  if (c.slab_id) return <SlabImage id={c.slab_id} alt={c.name} height={size * 1.25} rarity={c.rarity} />;
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg bg-zinc-200 font-black text-zinc-600`} style={{ width: size, height: size }}>
      {c.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
    </span>
  );
}

/** "1.40x · +3 PTS" for a Slab's buffs, or "" when it has none. */
export function buffText(c: CardData) {
  const parts: string[] = [];
  if (c.mult != null) parts.push(`${c.mult.toFixed(2)}x`);
  for (const [k, v] of [["PTS", c.boost_pts], ["REB", c.boost_reb], ["AST", c.boost_ast]] as const) if (v) parts.push(`+${v} ${k}`);
  return parts.join(" · ");
}

export const cardLabel = (c: CardData) => `${RARITIES[c.rarity].label}${c.kind === "slab" ? ` #${c.serial}` : c.s_grade ? ` · ${c.s_company} ${c.s_grade}` : ""}`;
