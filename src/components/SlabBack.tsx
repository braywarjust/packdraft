/* eslint-disable @next/next/no-img-element */
import type { Rarity } from "@/lib/packs";

/**
 * The face-down slab shown before a reveal: Brayden's per-rarity slab back art (public/slab-backs/<rarity>.webp,
 * named by the internal keys, so legendary = Mythic and grail = Immortal). The art is 1200×1200 with the slab
 * centred at full height, the same framing as the slab scans, so it sits in the same box as <SlabImage height={h}>
 * (0.6h wide) and the flip turns over in place.
 */
export function SlabBack({ height, rarity, className = "" }: { height: number; rarity: Rarity; className?: string }) {
  const h = height;
  return (
    <div className={`relative ${className}`} style={{ width: Math.round(h * 0.6), height: h }}>
      <img src={`/slab-backs/${rarity}.webp`} alt="" draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover object-center"
        style={{ filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.18))" }} />
    </div>
  );
}
