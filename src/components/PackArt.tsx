"use client";
/* eslint-disable @next/next/no-img-element */

import { RARITY_HEX, RARITY_ORDER, type PackType } from "@/lib/packs";
import { SlabBall } from "./Slab";

/** Sunburst wedges behind the pack art. */
const RAYS = Array.from({ length: 14 }, (_, i) => {
  const a = (i * Math.PI) / 7, b = a + Math.PI / 14;
  const p = (t: number) => `${(50 + 95 * Math.cos(t)).toFixed(2)} ${(46 + 95 * Math.sin(t)).toFixed(2)}`;
  return `M50 46L${p(a)}L${p(b)}Z`;
}).join("");
const SPARKS: [number, number, number, number][] = [[14, 22, 7, 0], [84, 30, 5.5, 1.2], [20, 62, 5, 2.1], [82, 66, 6, .6]];

/** The best tier a pack can drop (its chase), for the mini slabs peeking out of it. */
const chase = (p: PackType) => [...RARITY_ORDER].reverse().find((r) => p.odds[r] > 0) ?? "common";

function MiniSlab({ color, className = "", style }: { color: string; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`absolute aspect-square rounded-[18%] p-[5%] shadow-[0_2cqw_4cqw_rgba(0,0,0,.45)] ${className}`}
      style={{ background: `linear-gradient(145deg, #fff, ${color} 55%, #0f172a)`, ...style }}>
      <div className="grid h-full w-full place-items-center rounded-[14%]" style={{ background: "linear-gradient(140deg, #0b4ea2, #0253a4 50%, #8f1d22)" }}>
        <SlabBall className="h-[50%] w-[50%]" />
      </div>
    </div>
  );
}

/**
 * Animated pack art: a foil pack in the pack's colours with crimped seals, a turning sunburst, the PackDraft logo, a fan
 * square slab (five for the Mega Pack) gently bobbing out of it, twinkling sparkles, a slow foil shimmer and the pack's name. The whole pack
 * floats a little when `animate` is on. The Mega Pack is a wider crate holding five. Sized in cqw, so any box works.
 */
export function PackArt({ p, width, height, animate = true, className = "" }: { p: PackType; width: number; height: number; animate?: boolean; className?: string }) {
  const isCase = p.kind === "case";
  const top = RARITY_HEX[chase(p)];
  // One slab on single packs, the full five-slab fan on the Mega Pack.
  const fan = isCase ? [-26, -13, 0, 13, 26] : [0];
  return (
    <div className={`bball-host @container relative shrink-0 ${className}`} style={{ width, height }}>
      <div className={`absolute inset-0 ${animate ? "pack-bob" : ""}`} style={{ filter: "drop-shadow(0 3cqw 4cqw rgba(0,0,0,.45))" }}>
        <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${p.color} ${isCase ? "rounded-[8cqw]" : "rounded-[7cqw]"}`}
          style={{ boxShadow: "inset 0 0 0 1.2cqw rgba(255,255,255,.18), inset 0 -6cqw 10cqw rgba(0,0,0,.35)" }}>
          {/* Sunburst + glow */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <radialGradient id={`pg-${p.id}`} cx="50%" cy="46%" r="50%"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
            </defs>
            <g className={animate ? "slab-rays" : ""} style={{ transformOrigin: "50px 46px" }} fill="#fff" opacity=".1"><path d={RAYS} /></g>
            <circle cx="50" cy="46" r="44" fill={`url(#pg-${p.id})`} />
          </svg>
          {/* Foil texture */}
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 1px, transparent 1px 7px)" }} />
          {/* Crimped seals */}
          {!isCase && (
            <>
              <div className="absolute inset-x-0 top-0 h-[5.5%]" style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,.5) 0 4%, rgba(0,0,0,.12) 4% 8%)" }} />
              <div className="absolute inset-x-0 bottom-0 h-[5.5%]" style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,.5) 0 4%, rgba(0,0,0,.12) 4% 8%)" }} />
            </>
          )}
          {/* Logo */}
          <img src="/packdraft-logo-full.svg" alt="" draggable={false} className={`absolute left-1/2 -translate-x-1/2 select-none ${isCase ? "top-[7%] w-[38%]" : "top-[10%] w-[58%]"}`}
            style={{ filter: "drop-shadow(0 1.5cqw 2.5cqw rgba(0,0,0,.4))" }} />
          {/* Fan of slabs */}
          <div className={`absolute inset-x-0 ${isCase ? "top-[30%] h-[36%]" : "top-[37%] h-[33%]"}`}>
            {fan.map((deg, i) => (
              // Offsets use left/translate/rotate (not transform) so the bobbing animation's transform doesn't wipe them.
              <div key={i} className={`absolute top-0 aspect-square h-full ${animate ? "pack-fan" : ""}`}
                style={{ left: `calc(50% + ${deg * (isCase ? 1.15 : 1.6)}cqw)`, translate: "-50% 0", rotate: `${deg * 0.8}deg`, transformOrigin: "50% 100%", animationDelay: `${i * 0.35}s`, zIndex: 40 - Math.abs(deg) }}>
                <MiniSlab color={i === Math.floor(fan.length / 2) ? top : "#cbd5e1"} className="inset-0" />
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
          <div className={`absolute inset-x-0 text-center ${isCase ? "bottom-[7%]" : "bottom-[9%]"}`}>
            <p className={`font-black uppercase leading-none tracking-tight text-white ${isCase ? "text-[11cqw]" : "text-[13cqw]"}`} style={{ textShadow: "0 1cqw 2.5cqw rgba(0,0,0,.5)" }}>
              {p.name.replace(" Pack", "")}
            </p>
            <p className="mt-[1.5cqw] text-[5.5cqw] font-bold uppercase tracking-[0.2em] text-white/80">{p.cards} slab{p.cards > 1 ? "s" : ""}</p>
          </div>
          {animate && <div className="slab-shimmer pointer-events-none absolute inset-0" />}
        </div>
      </div>
    </div>
  );
}
