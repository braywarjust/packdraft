import { RARITIES, RARITY_HEX, RARITY_ORDER, type PackType } from "@/lib/packs";

/** Stacked bar of a pack's rarity odds in tier colours. Rare tiers get a minimum sliver so they stay visible. */
export function OddsBar({ odds, className = "", height = 8 }: { odds: PackType["odds"]; className?: string; height?: number }) {
  const segs = RARITY_ORDER.filter((r) => odds[r] > 0).map((r) => ({ r, w: Math.max(odds[r], 2.5) }));
  const total = segs.reduce((s, x) => s + x.w, 0);
  return (
    <div className={`flex w-full overflow-hidden rounded-full ring-1 ring-black/30 ${className}`} style={{ height }}>
      {segs.map(({ r, w }) => (
        <span key={r} title={`${RARITIES[r].label} ${odds[r]}%`} style={{ width: `${(w / total) * 100}%`, background: RARITY_HEX[r] }} className="border-r border-black/30 last:border-0" />
      ))}
    </div>
  );
}
