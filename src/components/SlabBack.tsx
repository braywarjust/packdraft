/* eslint-disable @next/next/no-img-element */
import { RARITY_HEX, type Rarity } from "@/lib/packs";

/**
 * The face-down slab shown before a reveal. Same box as <SlabImage height={h}> (0.6h wide) and the same slab shape
 * as the 1200×1200 scans: the slab is 710/1200 of the height wide, full height, with ~18/1200 rounded corners.
 * No words: a fine diamond pattern, a big faded PackDraft mark, the full logo, and a border in the rarity colour.
 */
export function SlabBack({ height, rarity, className = "" }: { height: number; rarity: Rarity; className?: string }) {
  const h = height;
  const w = Math.round(h * 0.6);
  const sw = Math.round((h * 710) / 1200);
  const r = Math.max(4, Math.round((h * 18) / 1200));
  const border = Math.max(4, Math.round(h * 0.03));
  const color = RARITY_HEX[rarity];
  const mark = "url(/packdraft-logo-simple.svg) center / contain no-repeat";
  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: w, height: h }}>
      <div className="relative h-full overflow-hidden"
        style={{
          width: sw, borderRadius: r, border: `${border}px solid ${color}`,
          background: `linear-gradient(160deg, #182238, #0d1322 70%)`,
          boxShadow: `0 10px 18px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.08)`,
        }}>
        {/* Fine diamond pattern */}
        <div className="absolute inset-0 opacity-[0.09]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 12px), repeating-linear-gradient(-45deg, #fff 0 1px, transparent 1px 12px)" }} />
        {/* Soft rarity glow from the centre */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(60% 45% at 50% 50%, ${color}40, transparent 70%)` }} />
        {/* Big faded mark behind the logo */}
        <div className="absolute left-1/2 top-1/2 bg-[#fff] opacity-[0.08]"
          style={{ width: sw * 1.35, height: (sw * 1.35 * 167) / 311, transform: "translate(-50%, -50%) rotate(-8deg)", mask: mark, WebkitMask: mark }} />
        {/* Thin inner frame in the rarity colour */}
        <div className="absolute rounded-[3px]" style={{ inset: Math.round(h * 0.035), border: `1px solid ${color}66` }} />
        {/* The logo */}
        <img src="/packdraft-logo-full.svg" alt="" draggable={false}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none"
          style={{ width: sw * 0.72 }} />
        {/* Acrylic sheen, like the real slabs */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,.14) 0%, transparent 28%, transparent 62%, rgba(255,255,255,.06) 80%, transparent 100%)" }} />
      </div>
    </div>
  );
}
