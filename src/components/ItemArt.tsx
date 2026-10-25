"use client";

import { useRef } from "react";
import { AnimatedLogo } from "./AnimatedLogo";
import { AcqIcon, TradeIcon } from "./Currencies";
import { useOffscreenPause } from "./useOffscreenPause";
import type { ShopItem } from "@/lib/shop";

const SPARKS: [number, number, number, number][] = [[14, 22, 7, 0], [84, 30, 5.5, 1.2], [20, 62, 5, 2.1], [82, 66, 6, .6]];

const LOOK: Record<ShopItem, { name: string; sub: string; bg: string; ring: string }> = {
  acquisition: { name: "Acquisition", sub: "1 more add", bg: "linear-gradient(135deg, #34d399 0%, #059669 48%, #064e3b 100%)", ring: "rgba(52,211,153,.9)" },
  trade: { name: "Trade", sub: "1 more trade", bg: "linear-gradient(135deg, #fbbf24 0%, #ea580c 52%, #7c2d12 100%)", ring: "rgba(251,191,36,.9)" },
};

/**
 * League Shop item art, in the style of the old League Packs: a padded foil pouch lit like a real object (bright top
 * edge, shaded sides, a glossy highlight and soft creases) with a ground shadow, a turning sunburst, the PackDraft logo,
 * the item's icon on a glowing badge, sparkles and a slow shimmer. Floats when `animate` is on and tilts toward you on
 * hover. Sized in cqw, so any box works.
 */
export function ItemArt({ item, width, height, animate = true, className = "" }: { item: ShopItem; width: number; height: number; animate?: boolean; className?: string }) {
  const look = LOOK[item];
  const Icon = item === "acquisition" ? AcqIcon : TradeIcon;
  const ref = useRef<HTMLDivElement>(null);
  useOffscreenPause(ref);
  return (
    <div ref={ref} className={`logo-host @container relative isolate shrink-0 ${className}`} style={{ width, height }}>
      <div className={`pointer-events-none absolute bottom-[-5%] left-[12%] right-[12%] h-[7%] rounded-[50%] ${animate ? "pack-ground" : ""}`}
        style={{ background: "radial-gradient(closest-side, rgba(0,0,0,.55), transparent)" }} />
      <div className={`absolute inset-0 ${animate ? "pack-bob" : ""}`}>
        <div className="pack-tilt relative h-full w-full overflow-hidden rounded-[5.5cqw]"
          style={{
            background: look.bg,
            boxShadow: "0 2cqw 4cqw rgba(0,0,0,.35), inset 0 0 0 .8cqw rgba(255,255,255,.22), inset 0 2.5cqw 3.5cqw rgba(255,255,255,.3), inset 0 -7cqw 9cqw rgba(0,0,0,.42), inset 4cqw 0 6cqw rgba(255,255,255,.1), inset -4cqw 0 6cqw rgba(0,0,0,.24)",
          }}>
          {/* Sunburst + glow */}
          <div className={`pointer-events-none absolute left-1/2 top-[50%] aspect-square w-[220%] -translate-x-1/2 -translate-y-1/2 opacity-[.12] ${animate ? "slab-rays" : ""}`}
            style={{ background: "repeating-conic-gradient(#fff 0 9deg, transparent 9deg 22.5deg)" }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(44% 44% at 50% 50%, rgba(255,255,255,.38), transparent)" }} />
          {/* Foil texture */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 1px, transparent 1px 7px)" }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(115% 85% at 50% 42%, transparent 52%, rgba(0,0,0,.3) 100%)" }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(162deg, transparent 38%, rgba(255,255,255,.09) 40%, transparent 45%), linear-gradient(24deg, transparent 60%, rgba(0,0,0,.09) 62%, transparent 67%)" }} />
          {/* Logo */}
          <AnimatedLogo className="absolute left-1/2 top-[9%] z-[60] w-[58%] -translate-x-1/2 select-none" style={{ filter: "drop-shadow(0 1.5cqw 2.5cqw rgba(0,0,0,.4))" }} />
          {/* The item's icon on a glowing badge */}
          <div className={`absolute left-1/2 top-[36%] z-40 grid aspect-square w-[46%] -translate-x-1/2 place-items-center rounded-full ${animate ? "pack-fan" : ""}`}
            style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), rgba(0,0,0,.35))", boxShadow: `0 0 0 1.2cqw rgba(255,255,255,.25), 0 0 8cqw ${look.ring}, inset 0 -2cqw 4cqw rgba(0,0,0,.35)` }}>
            <Icon className="!h-[62%] !w-[62%] text-white drop-shadow-[0_1cqw_2cqw_rgba(0,0,0,.45)]" />
          </div>
          {animate && SPARKS.map(([x, y, s, d], i) => (
            <svg key={i} viewBox="-10 -10 20 20" className="slab-twinkle pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${s}cqw`, height: `${s}cqw`, animationDelay: `${d}s` }}>
              <path d="M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z" fill="#fff" />
            </svg>
          ))}
          {/* Name band */}
          <div className="absolute inset-x-0 bottom-[8%] z-50 text-center">
            <p className="font-black uppercase leading-none tracking-tight text-white text-[12cqw]" style={{ textShadow: "0 1cqw 2.5cqw rgba(0,0,0,.5)" }}>{look.name}</p>
            <p className="mt-[1.5cqw] text-[5.5cqw] font-bold uppercase tracking-[0.2em] text-white/80">{look.sub}</p>
          </div>
          {animate && <div className="slab-shimmer pointer-events-none absolute inset-0" />}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 28% at 30% 6%, rgba(255,255,255,.4), transparent 70%)" }} />
          <div className="pack-gloss pointer-events-none absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
