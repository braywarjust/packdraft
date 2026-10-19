"use client";

import type { PackType } from "@/lib/packs";
import { useRef } from "react";
import { Rays, Slab } from "./Slab";
import { PACK_FACES } from "@/lib/pack-faces";
import { useOffscreenPause } from "./useOffscreenPause";
import { AnimatedLogo } from "./AnimatedLogo";

const SPARKS: [number, number, number, number][] = [[14, 22, 7, 0], [84, 30, 5.5, 1.2], [20, 62, 5, 2.1], [82, 66, 6, .6]];


/**
 * Animated pack art: a padded foil pouch in the pack's colours, lit like a real object (a bright top edge, shaded sides
 * and bottom, a pillowed middle, a glossy highlight and a couple of soft creases) with a ground shadow under it. Inside:
 * a turning sunburst, the PackDraft logo (which plays its own animation on hover, see AnimatedLogo), a square slab
 * (five for the Mega Pack, a crate with a lid) gently bobbing, sparkles, a slow shimmer and the pack's name. It floats a
 * little when `animate` is on and tilts toward you on hover. Sized in cqw, so any box works.
 */
export function PackArt({ p, width, height, animate = true, className = "" }: { p: PackType; width: number; height: number; animate?: boolean; className?: string }) {
  const isCase = p.kind === "case";
  const faces = PACK_FACES[p.id] ?? PACK_FACES.rookie;
  // The fan box is 36% (Mega) or 33% of the pack height; the cover slabs fill it.
  const coverSize = Math.max(8, Math.round(height * (isCase ? 0.36 : 0.33)));
  // One slab on single packs, the full five-slab fan on the Mega Pack.
  const fan = isCase ? [-26, -13, 0, 13, 26] : [0];
  const ref = useRef<HTMLDivElement>(null);
  useOffscreenPause(ref);
  return (
    <div ref={ref} className={`logo-host @container relative shrink-0 ${className}`} style={{ width, height }}>
      {/* Ground shadow: stays put while the pack floats, which is what makes it read as a real object */}
      <div className={`pointer-events-none absolute bottom-[-5%] left-[12%] right-[12%] h-[7%] rounded-[50%] ${animate ? "pack-ground" : ""}`}
        style={{ background: "radial-gradient(closest-side, rgba(0,0,0,.55), transparent)" }} />
      <div className={`absolute inset-0 ${animate ? "pack-bob" : ""}`}>
        <div className={`pack-tilt relative h-full w-full overflow-hidden bg-gradient-to-br ${p.color} ${isCase ? "rounded-[5cqw]" : "rounded-[5.5cqw]"}`}
          style={{
            boxShadow: "0 2cqw 4cqw rgba(0,0,0,.35), inset 0 0 0 .8cqw rgba(255,255,255,.22), inset 0 2.5cqw 3.5cqw rgba(255,255,255,.3), inset 0 -7cqw 9cqw rgba(0,0,0,.42), inset 4cqw 0 6cqw rgba(255,255,255,.1), inset -4cqw 0 6cqw rgba(0,0,0,.24)",
          }}>
          {/* Sunburst + glow */}
          <Rays cy={46} opacity={0.1} spin={animate} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(44% 44% at 50% 46%, rgba(255,255,255,.38), transparent)" }} />
          {/* Foil texture */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 1px, transparent 1px 7px)" }} />
          {/* Padded, pillowed body: darker toward the edges, with a couple of soft foil creases */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(115% 85% at 50% 42%, transparent 52%, rgba(0,0,0,.3) 100%)" }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(162deg, transparent 38%, rgba(255,255,255,.09) 40%, transparent 45%), linear-gradient(24deg, transparent 60%, rgba(0,0,0,.09) 62%, transparent 67%), linear-gradient(98deg, transparent 18%, rgba(255,255,255,.06) 20%, transparent 24%)" }} />
          {/* Crate lid on the Mega Pack */}
          {isCase && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[22%]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,.08) 80%, rgba(0,0,0,.25))", boxShadow: "0 .8cqw 1.5cqw rgba(0,0,0,.25)" }} />
          )}
          {/* Logo */}
          <AnimatedLogo className={`absolute left-1/2 z-20 -translate-x-1/2 select-none ${isCase ? "top-[7%] w-[38%]" : "top-[10%] w-[58%]"}`}
            style={{ filter: "drop-shadow(0 1.5cqw 2.5cqw rgba(0,0,0,.4))" }} />
          {/* Fan of slabs */}
          <div className={`absolute inset-x-0 ${isCase ? "top-[30%] h-[36%]" : "top-[37%] h-[33%]"}`}>
            {fan.map((deg, i) => (
              // Offsets use left/translate/rotate (not transform) so the bobbing animation's transform doesn't wipe them.
              <div key={i} className={`absolute top-0 aspect-square h-full ${animate ? "pack-fan" : ""}`}
                style={{ left: `calc(50% + ${deg * (isCase ? 1.15 : 1.6)}cqw)`, translate: "-50% 0", rotate: `${deg * 0.8}deg`, transformOrigin: "50% 100%", animationDelay: `${i * 0.35}s`, zIndex: 40 - Math.abs(deg) }}>
                <Slab s={{ ...faces[i % faces.length].player, rarity: faces[i % faces.length].rarity }} size={coverSize} className="drop-shadow-[0_2cqw_3cqw_rgba(0,0,0,.4)]" />
              </div>
            ))}
          </div>
          {/* Sparkles */}
          {animate && SPARKS.map(([x, y, s, d], i) => (
            <svg key={i} viewBox="-10 -10 20 20" className="slab-twinkle pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${s}cqw`, height: `${s}cqw`, animationDelay: `${d}s` }}>
              <path d="M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z" fill="#fff" />
            </svg>
          ))}
          {/* Name band */}
          {/* Above the cover slabs (z-50), so their drop shadow never darkens the name */}
          <div className={`absolute inset-x-0 z-50 text-center ${isCase ? "bottom-[7%]" : "bottom-[9%]"}`}>
            <p className={`font-black uppercase leading-none tracking-tight text-white ${isCase ? "text-[11cqw]" : "text-[13cqw]"}`} style={{ textShadow: "0 1cqw 2.5cqw rgba(0,0,0,.5)" }}>
              {p.name.replace(" Pack", "")}
            </p>
            <p className="mt-[1.5cqw] flex items-center justify-center gap-[1.5cqw] text-[5.5cqw] font-bold uppercase tracking-[0.2em] text-white/80">
              <span className="pack-icon-glyph inline-block" style={{ width: "6cqw", height: "5.6cqw" }} />{p.cards} slab{p.cards > 1 ? "s" : ""}
            </p>
          </div>
          {animate && <div className="slab-shimmer pointer-events-none absolute inset-0" />}
          {/* Glossy highlight: a soft glare up top and a specular streak, which slides a little on hover */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 28% at 30% 6%, rgba(255,255,255,.4), transparent 70%)" }} />
          <div className="pack-gloss pointer-events-none absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
