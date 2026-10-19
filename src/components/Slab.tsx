"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { useOffscreenPause } from "./useOffscreenPause";
import { RARITIES, RARITY_HEX, type Rarity } from "@/lib/packs";

export type SlabData = {
  name: string; team: string; team_name?: string | null; pos: string; rarity: Rarity; serial?: number;
  jersey?: string | null; color?: string | null; alt?: string | null; photo?: string | null;
};

/**
 * Big sunburst for the turning rays: drawn around the centre of a box twice the card's size, so the box can spin in
 * place (an HTML transform the GPU handles, instead of re-drawing the SVG every frame) and still cover the corners.
 */
export const RAYS_BIG = Array.from({ length: 16 }, (_, i) => {
  const a = (i * Math.PI) / 8, b = a + Math.PI / 16;
  const p = (t: number) => `${(50 + 75 * Math.cos(t)).toFixed(2)} ${(50 + 75 * Math.sin(t)).toFixed(2)}`;
  return `M50 50L${p(a)}L${p(b)}Z`;
}).join("");

/** A turning sunburst centred at (50%, cy%) of its card. */
export function Rays({ cy = 40, opacity, spin }: { cy?: number; opacity: number; spin: boolean }) {
  return (
    <div className={`pointer-events-none absolute ${spin ? "slab-rays" : ""}`} style={{ width: "200%", height: "200%", left: "-50%", top: `${cy - 100}%` }} aria-hidden>
      <svg viewBox="0 0 100 100" className="h-full w-full"><path d={RAYS_BIG} fill="#fff" opacity={opacity} /></svg>
    </div>
  );
}

/** Metallic frame per tier; Immortal's frame is a turning rainbow (slab-frame-immortal). */
const FRAME: Record<Rarity, string> = {
  common: "linear-gradient(145deg, #e2e8f0, #64748b 45%, #cbd5e1 70%, #475569)",
  rare: "linear-gradient(145deg, #bfdbfe, #2563eb 45%, #93c5fd 70%, #1e3a8a)",
  epic: "linear-gradient(145deg, #f5d0fe, #9333ea 45%, #e9d5ff 70%, #581c87)",
  legendary: "linear-gradient(145deg, #fecaca, #dc2626 45%, #fca5a5 70%, #7f1d1d)",
  grail: "",
};
const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3, grail: 4 };

// Fixed spots (percent of the slab) for the tier effects, so server and client render the same thing.
const STARS: [number, number, number, number][] = [[12, 18, 4.2, 0], [84, 14, 3.4, 0.7], [76, 40, 2.8, 1.5], [18, 46, 3, 2.1], [52, 9, 2.6, 1.1], [90, 58, 2.4, 2.6], [8, 66, 2.6, 0.4]];

/** Lighten (amt > 0) or darken (amt < 0) a hex colour. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r}, ${g}, ${b})`;
}

function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <svg viewBox="-10 -10 20 20" className="slab-twinkle pointer-events-none absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${size}cqw`, height: `${size}cqw`, animationDelay: `${delay}s` }}>
      <path d="M0-10C1-3 3-1 10 0C3 1 1 3 0 10C-1 3-3 1-10 0C-3-1-1-3 0-10Z" fill="#fff" />
    </svg>
  );
}

/**
 * A basketball: shaded leather, curved seams and a highlight, with a soft shadow. It turns slowly on its own, and when
 * its slab or pack is hovered (any `.bball-host`) it dribbles: one even bounce with squash and stretch and a spin.
 */
function Ball({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`bball ${/\babsolute\b/.test(className) ? "" : "relative"} ${className}`} style={style} aria-hidden>
      <span className="bball-shadow" />
      <span className="bball-body">
        <svg viewBox="0 0 40 40" className="bball-spin h-full w-full overflow-visible">
          <defs>
            <radialGradient id="bball-leather" cx="34%" cy="28%" r="78%">
              <stop offset="0" stopColor="#ffb36b" /><stop offset=".42" stopColor="#f97316" /><stop offset=".85" stopColor="#c2410c" /><stop offset="1" stopColor="#7c2d12" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="20" r="18.6" fill="url(#bball-leather)" stroke="#431407" strokeWidth="1.1" />
          <g fill="none" stroke="#3b1206" strokeWidth="1.5" strokeLinecap="round">
            <path d="M20 1.6V38.4" /><path d="M1.6 20H38.4" />
            <path d="M7.2 6.4C14.2 12.6 14.2 27.4 7.2 33.6" /><path d="M32.8 6.4C25.8 12.6 25.8 27.4 32.8 33.6" />
          </g>
          <ellipse cx="13" cy="10.5" rx="6.5" ry="3.4" fill="#fff" opacity=".32" transform="rotate(-32 13 10.5)" />
        </svg>
      </span>
    </span>
  );
}

/**
 * A Slab: a square, casino-thumbnail-style card. The player over his team colours with a sunburst behind him, a big
 * faded team logo, a crisp team logo badge, his name, and a frame in the tier colour. Rarer tiers stack on smooth,
 * low-key animation: Rare turns the sunburst and adds a shimmer, Epic adds twinkling stars, Mythic fills in more stars
 * and pulses a glow, Immortal shifts colour through a rainbow frame and holo sheen on top of all of it.
 * Everything is sized in cqw, so it scales to any `size`.
 */
export function Slab({ s, size, className = "" }: { s: SlabData; size: number; className?: string }) {
  const [photoOk, setPhotoOk] = useState(true);
  const r = RANK[s.rarity];
  const tier = RARITY_HEX[s.rarity];
  const primary = `#${s.color ?? "334155"}`;
  const alt = s.alt && !/^(ffffff|000000)$/i.test(s.alt) ? `#${s.alt}` : shade(primary, -0.5);
  const logo = s.team ? `https://a.espncdn.com/i/teamlogos/nba/500/${s.team.toLowerCase()}.png` : null;
  const club = s.team_name ? s.team_name.split(" ").slice(-1)[0] : s.team;
  const ref = useRef<HTMLDivElement>(null);
  useOffscreenPause(ref);

  return (
    <div ref={ref} className={`bball-host @container relative shrink-0 ${className}`} style={{ width: size, height: size, ["--glow" as string]: `${tier}99` }}>
      {/* Pulsing glow (Mythic+): its own layer, so only its opacity animates and nothing inside the card repaints */}
      {r >= 3 && <div className="slab-glow-layer pointer-events-none absolute inset-0 rounded-[9cqw]" />}
      <div className="relative h-full w-full overflow-hidden rounded-[9cqw] p-[2.2cqw]"
        style={{ background: FRAME[s.rarity] || "#f472b6", boxShadow: "0 8px 18px rgba(0,0,0,.35)" }}>
        {/* Immortal's rainbow frame: a conic gradient spun as a layer behind the card */}
        {r === 4 && <div className="slab-frame-spin pointer-events-none absolute" />}
        <div className={`relative h-full w-full overflow-hidden rounded-[7cqw] ${r === 4 ? "slab-vivid" : ""}`}
          style={{ background: `linear-gradient(160deg, ${shade(primary, 0.35)} 0%, ${primary} 38%, ${shade(alt, -0.2)} 72%, ${shade(alt, -0.6)} 100%)` }}>
          {/* Sunburst (turns from Rare up) + glow */}
          <Rays cy={40} opacity={0.08 + r * 0.02} spin={r >= 1} />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(46% 46% at 50% 40%, rgba(255,255,255,.3), transparent)" }} />
          {/* Big faded team logo behind the player */}
          {logo && <img src={logo} alt="" draggable={false} className="pointer-events-none absolute left-1/2 top-[6%] w-[78%] -translate-x-1/2 select-none opacity-20" />}
          {/* Tier effects behind the player */}
          {r >= 2 && STARS.slice(0, r >= 3 ? 7 : 4).map(([x, y, sz, d], i) => <Star key={i} x={x} y={y} size={sz} delay={d} />)}
          {/* The player */}
          {s.photo && photoOk ? (
            <img src={s.photo} alt={s.name} draggable={false} onError={() => setPhotoOk(false)}
              className="pointer-events-none absolute bottom-[19%] left-1/2 w-[112%] max-w-none -translate-x-1/2 select-none"
              style={{ filter: "drop-shadow(0 1.5cqw 2.5cqw rgba(0,0,0,.45))", maskImage: "linear-gradient(to bottom, #000 80%, transparent 99%)", WebkitMaskImage: "linear-gradient(to bottom, #000 80%, transparent 99%)" }} />
          ) : (
            <span className="absolute inset-x-0 top-[12%] text-center text-[26cqw] font-black text-white/80">{s.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span>
          )}
          {/* Shimmer from Rare up; holo for Immortal */}
          {r >= 1 && <div className="slab-shimmer pointer-events-none absolute inset-0" />}
          {r === 4 && <div className="slab-holo pointer-events-none absolute inset-0" />}
          {/* Team logo badge and tier pill */}
          {logo && (
            <span className="absolute left-[5%] top-[5%] grid h-[17cqw] w-[17cqw] place-items-center rounded-full shadow-[0_1cqw_2cqw_rgba(0,0,0,.35)]" style={{ background: "#ffffff" }}>
              <img src={logo} alt={s.team} draggable={false} className="h-[78%] w-[78%] select-none object-contain" />
            </span>
          )}
          <span className="absolute right-[5%] top-[5%] rounded-full px-[3cqw] py-[1cqw] text-[5cqw] font-black uppercase leading-none tracking-wide shadow-[0_1cqw_2cqw_rgba(0,0,0,.35)]"
            style={{ background: r === 4 ? "linear-gradient(90deg,#f472b6,#fbbf24,#34d399,#38bdf8)" : tier, color: r === 4 ? "#000" : "#fff" }}>
            {RARITIES[s.rarity].label}
          </span>
          {/* Name band */}
          <div className="absolute inset-x-0 bottom-0 px-[6cqw] pb-[4.5cqw] pt-[9cqw]" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.55) 45%)" }}>
            <p className="truncate text-[9cqw] font-black leading-[1.05] text-white" style={{ textShadow: "0 1cqw 2cqw rgba(0,0,0,.5)" }}>{s.name}</p>
            <p className="truncate text-[5cqw] font-bold uppercase tracking-wide text-white/80">
              {club}{s.pos ? ` · ${s.pos}` : ""}{s.jersey ? ` · #${s.jersey}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The face-down slab: the same square and frame as a Slab, in deep ink with a soft glow of the tier colour, a slowly
 * turning sunburst, the logo and a basketball. The rim is the tier colour (and glows from Mythic up), so a big pull
 * still teases before the flip.
 */
export function SlabCover({ rarity, size, className = "" }: { rarity: Rarity; size: number; className?: string }) {
  const r = RANK[rarity];
  const tier = RARITY_HEX[rarity];
  const ref = useRef<HTMLDivElement>(null);
  useOffscreenPause(ref);
  return (
    <div ref={ref} className={`bball-host @container relative shrink-0 ${className}`} style={{ width: size, height: size, ["--glow" as string]: `${tier}99` }}>
      {r >= 3 && <div className="slab-glow-layer pointer-events-none absolute inset-0 rounded-[9cqw]" />}
      <div className="relative h-full w-full overflow-hidden rounded-[9cqw] p-[2.2cqw]"
        style={{ background: `linear-gradient(145deg, ${shade(tier, 0.5)}, ${tier} 45%, ${shade(tier, 0.3)} 70%, ${shade(tier, -0.45)})`, boxShadow: "0 8px 18px rgba(0,0,0,.35)" }}>
        <div className="relative h-full w-full overflow-hidden rounded-[7cqw]" style={{ background: `radial-gradient(75% 75% at 50% 42%, ${shade(tier, -0.35)} 0%, #121a2b 62%, #0a0f1a 100%)` }}>
          <Rays cy={50} opacity={0.08} spin />
          <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(44% 44% at 50% 50%, rgba(255,255,255,.2), transparent)" }} />
          <div className="absolute inset-0 opacity-[.08]" style={{ backgroundImage: "repeating-linear-gradient(135deg, #fff 0 1px, transparent 1px 9px)" }} />
          <img src="/packdraft-logo-full.svg" alt="" draggable={false} className="absolute left-1/2 top-[42%] w-[62%] -translate-x-1/2 -translate-y-1/2 select-none"
            style={{ filter: "drop-shadow(0 2cqw 3cqw rgba(0,0,0,.45))" }} />
          <Ball className="absolute bottom-[10%] left-[41.5%] h-[17cqw] w-[17cqw]" />
          <div className="slab-shimmer pointer-events-none absolute inset-0" />
        </div>
      </div>
    </div>
  );
}

export { Ball as SlabBall };
