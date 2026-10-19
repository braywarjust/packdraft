"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { RARITIES, RARITY_HEX, fmtMult, type Rarity } from "@/lib/packs";

export type SlabFaceData = {
  kind: "player" | "generic"; name: string; team: string; team_name?: string | null; pos: string; rarity: Rarity; mult: number;
  immortal: boolean; serial: number; jersey?: string | null; color?: string | null; alt?: string | null; photo?: string | null;
};

const ROMAN: [number, string][] = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function roman(n: number) {
  if (!n) return "0";
  let s = "";
  for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; }
  return s;
}

/** Metallic edge per tier (the outer frame). Immortal swaps it for a cycling rainbow. */
const EDGE: Record<Rarity, string> = {
  common: "linear-gradient(145deg, #cbd5e1, #64748b 45%, #e2e8f0 70%, #475569)",
  rare: "linear-gradient(145deg, #93c5fd, #1d4ed8 45%, #bfdbfe 70%, #1e3a8a)",
  epic: "linear-gradient(145deg, #e9d5ff, #7e22ce 45%, #f5d0fe 70%, #581c87)",
  legendary: "linear-gradient(145deg, #fecaca, #b91c1c 45%, #fee2e2 70%, #7f1d1d)",
  grail: "linear-gradient(145deg, #fef3c7, #d97706 40%, #fffbeb 62%, #b45309 80%, #fde68a)",
};
const GOLD = "#e8c872";

/** Lighten/darken a hex colour toward white (amt > 0) or black (amt < 0). */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * A Slab: a tarot-style card. Same box and card shape as the slab backs (0.6h wide, the card itself 710/1200 of the
 * height wide) so a reveal flips over in place. Roman numeral of his jersey up top, the player in an arched window over
 * his team colours, and a name plaque. Two badges sit on the card's edge, partly off it: the team logo (top left) and
 * the multiplier with the Fantasy Points logo (bottom centre). Immortal slabs get a cycling rainbow edge, a holo sheen,
 * boosted colour and a pulsing glow.
 */
export function SlabFace({ s, height, className = "" }: { s: SlabFaceData; height: number; className?: string }) {
  const [photoOk, setPhotoOk] = useState(true);
  const h = height;
  const box = Math.round(h * 0.6);
  const w = Math.round((h * 710) / 1200);
  const px = (k: number, min = 0) => Math.max(min, Math.round(h * k * 10) / 10);
  const generic = s.kind === "generic";
  const tier = RARITY_HEX[s.rarity];
  const primary = generic ? tier : `#${s.color ?? "334155"}`;
  const secondary = generic ? "#0f172a" : `#${s.alt && s.alt.toLowerCase() !== "ffffff" ? s.alt : "0f172a"}`;
  const pad = px(0.02, 3);
  const logo = s.team ? `https://a.espncdn.com/i/teamlogos/nba/500/${s.team.toLowerCase()}.png` : null;
  const serif = "ui-serif, Georgia, 'Times New Roman', serif";
  const tiny = h < 180;
  // Name on two lines: first name small, last name as big as fits. Generic slabs read "Any / Player".
  const parts = generic ? ["Any", "Player"] : s.name.split(" ");
  const first = parts.length > 1 ? parts[0] : "";
  const last = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  const inner = w - 2 * pad - px(0.05);
  const fit = (text: string, max: number, k = 0.86) => Math.max(6, Math.min(h * max, inner / (Math.max(text.length, 1) * k)));
  const club = s.team_name ? s.team_name.split(" ").slice(-1)[0] : s.team;
  const sub = generic ? `Generic · ${RARITIES[s.rarity].label}` : `${club} · ${s.pos}`;
  const numeral = s.immortal ? "IMMORTAL" : generic ? "★" : roman(Number(s.jersey ?? 0) || 0);
  const fptMask = "url(/fantasy-points.svg) center / contain no-repeat";
  const onTier = s.rarity === "grail" ? "#1c1300" : "#fff";
  const logoSize = px(0.19, 26);
  const pillH = px(0.095, 16);

  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: box, height: h }}>
      <div className={`relative h-full overflow-hidden ${s.immortal ? "slab-immortal" : ""}`}
        style={{
          width: w, borderRadius: px(0.04, 6), padding: pad,
          background: s.immortal ? undefined : EDGE[s.rarity],
          boxShadow: s.immortal ? undefined : "0 10px 18px rgba(0,0,0,.35)",
          ["--glow" as string]: "rgba(255, 200, 80, .75)",
        }}>
        {/* Card body */}
        <div className="relative flex h-full flex-col overflow-hidden"
          style={{
            borderRadius: px(0.03, 4), background: `linear-gradient(170deg, ${shade(primary, -0.35)}, #0b1020 75%)`,
            filter: s.immortal ? "saturate(1.6) contrast(1.08)" : undefined,
          }}>
          {/* Inner gold rule */}
          <div className="pointer-events-none absolute" style={{ inset: px(0.014, 2), border: `1px solid ${GOLD}88`, borderRadius: px(0.024, 3) }} />

          {/* Numeral (kept clear of the logo badge on the left) */}
          <div className="relative flex shrink-0 items-center justify-center gap-1" style={{ height: px(0.085), paddingLeft: px(0.1), paddingRight: px(0.02), color: GOLD, fontFamily: serif }}>
            <span style={{ fontSize: px(0.026, 5) }}>✦</span>
            <span className="truncate font-bold" style={{ fontSize: fit(numeral, 0.046, 1.05), letterSpacing: "0.14em" }}>{numeral}</span>
            <span style={{ fontSize: px(0.026, 5) }}>✦</span>
          </div>

          {/* Arched window */}
          <div className="relative mx-auto shrink-0 overflow-hidden"
            style={{
              width: "86%", height: "60%", borderRadius: `${w}px ${w}px ${px(0.012, 2)}px ${px(0.012, 2)}px`,
              border: `${px(0.006, 1)}px solid ${GOLD}`,
              background: `radial-gradient(90% 70% at 50% 35%, ${shade(primary, 0.15)}, ${primary} 45%, ${shade(secondary === "#0f172a" ? primary : secondary, -0.45)} 100%)`,
            }}>
            {/* Sunburst */}
            <div className="absolute inset-0 opacity-25"
              style={{ background: "repeating-conic-gradient(from 0deg at 50% 38%, rgba(255,255,255,.55) 0deg 4deg, transparent 4deg 14deg)" }} />
            {generic ? (
              <div className="absolute inset-0 grid place-items-center">
                <div className="bg-white" style={{ width: "72%", height: "40%", mask: "url(/packdraft-logo-simple.svg) center / contain no-repeat", WebkitMask: "url(/packdraft-logo-simple.svg) center / contain no-repeat", opacity: 0.92 }} />
              </div>
            ) : (
              <>
                {logo && <img src={logo} alt="" draggable={false} className="absolute left-1/2 top-[6%] -translate-x-1/2 select-none opacity-20" style={{ width: "92%" }} />}
                {s.photo && photoOk ? (
                  <img src={s.photo} alt={s.name} draggable={false} onError={() => setPhotoOk(false)}
                    className="absolute bottom-0 left-1/2 max-w-none -translate-x-1/2 select-none"
                    style={{ width: "150%", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.55))" }} />
                ) : (
                  <span className="absolute inset-0 grid place-items-center font-black text-white/85" style={{ fontSize: px(0.16) }}>
                    {s.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
                  </span>
                )}
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/4" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.45))" }} />
          </div>

          {/* Name plaque; the bottom is left free for the multiplier badge */}
          <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center text-center" style={{ fontFamily: serif, paddingBottom: pillH * 0.45, paddingInline: px(0.025) }}>
            {first && !tiny && (
              <p className="w-full truncate uppercase leading-none" style={{ fontSize: fit(first, 0.03), color: `${GOLD}ee`, letterSpacing: "0.12em" }}>{first}</p>
            )}
            <p className="w-full truncate font-bold uppercase leading-tight text-white" style={{ fontSize: fit(tiny ? s.name : last, 0.056), letterSpacing: "0.04em" }}>
              {tiny && !generic ? s.name : last}
            </p>
            {!tiny && (
              <p className="w-full truncate uppercase leading-none" style={{ fontSize: fit(sub, 0.026, 0.95), color: "#cbd5e1cc", letterSpacing: "0.14em" }}>{sub}</p>
            )}
          </div>

          {/* Corner pips */}
          {!tiny && (
            <>
              <span className="absolute font-bold" style={{ left: px(0.03), bottom: px(0.022), fontSize: px(0.024, 6), color: `${GOLD}aa`, fontFamily: serif }}>#{s.serial}</span>
              <span className="absolute font-bold" style={{ right: px(0.03), bottom: px(0.022), fontSize: px(0.024, 6), color: `${GOLD}aa`, fontFamily: serif }}>{RARITIES[s.rarity].label.toUpperCase()}</span>
            </>
          )}

          {/* Sheen; Immortal gets a moving holo layer */}
          <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,.16) 0%, transparent 28%, transparent 62%, rgba(255,255,255,.07) 80%, transparent 100%)" }} />
          {s.immortal && <div className="slab-holo pointer-events-none absolute inset-0" />}
        </div>
      </div>

      {/* Team logo badge, hanging off the top-left corner */}
      <div className="absolute z-10 grid place-items-center rounded-full"
        style={{
          width: logoSize, height: logoSize, left: (box - w) / 2 - logoSize * 0.28, top: -logoSize * 0.22,
          background: "radial-gradient(circle at 35% 30%, #ffffff, #e2e8f0 70%, #cbd5e1)",
          border: `${px(0.01, 2)}px solid ${generic ? GOLD : primary}`, boxShadow: `0 0 0 ${px(0.004, 1)}px ${GOLD}, 0 4px 10px rgba(0,0,0,.45)`,
        }}>
        {generic ? (
          <img src="/packdraft-logo-full.svg" alt="PackDraft" draggable={false} className="select-none object-contain" style={{ width: "80%" }} />
        ) : logo ? (
          <img src={logo} alt={s.team} title={s.team_name ?? s.team} draggable={false} className="select-none object-contain" style={{ width: "76%", height: "76%" }} />
        ) : (
          <span className="font-black text-zinc-900" style={{ fontSize: logoSize * 0.3 }}>{s.team}</span>
        )}
      </div>

      {/* Multiplier badge: Fantasy Points logo + multiplier, hanging off the bottom edge */}
      <div className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center rounded-full font-black"
        title={`${fmtMult(s.mult)} fantasy points`}
        style={{
          height: pillH, bottom: -pillH * 0.4, paddingInline: pillH * 0.32, gap: pillH * 0.16, fontSize: pillH * 0.56, color: onTier,
          background: `linear-gradient(180deg, ${shade(tier, 0.35)}, ${tier} 55%, ${shade(tier, -0.35)})`,
          border: `${px(0.008, 1.5)}px solid ${GOLD}`, boxShadow: `0 0 ${px(0.035)}px ${tier}aa, 0 4px 10px rgba(0,0,0,.5)`, letterSpacing: "-0.02em",
        }}>
        <span aria-hidden className="shrink-0" style={{ width: pillH * 0.62, height: pillH * 0.62, background: onTier, mask: fptMask, WebkitMask: fptMask }} />
        {fmtMult(s.mult)}
      </div>
    </div>
  );
}
