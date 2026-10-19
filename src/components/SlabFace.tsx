"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { RARITIES, RARITY_HEX, fmtMult, fmtRange, type Rarity } from "@/lib/packs";
import { FptIcon } from "./Fpts";

export type SlabFaceData = {
  kind: "player" | "generic"; name: string; team: string; team_name?: string | null; pos: string; rarity: Rarity; mult: number;
  immortal: boolean; serial: number; jersey?: string | null; color?: string | null; alt?: string | null; photo?: string | null;
};

/** The card's refractor border per tier, like a parallel colour. Immortal swaps it for a spinning rainbow. */
const REFRACTOR: Record<Rarity, string> = {
  common: "linear-gradient(135deg, #e5e7eb, #9ca3af 40%, #f3f4f6 60%, #6b7280)",
  rare: "linear-gradient(135deg, #bfdbfe, #2563eb 40%, #dbeafe 60%, #1e3a8a)",
  epic: "linear-gradient(135deg, #f5d0fe, #9333ea 40%, #fae8ff 60%, #581c87)",
  legendary: "linear-gradient(135deg, #fecaca, #dc2626 40%, #fee2e2 60%, #7f1d1d)",
  grail: "linear-gradient(135deg, #fde68a, #d97706 40%, #fef3c7 60%, #92400e)",
};
const LABEL_RED = "#d6363c";
const POSITION: Record<string, string> = { G: "GUARD", F: "FORWARD", C: "CENTER" };
/** How strong the animated background is per tier (Immortal pushes it further). */
const FX: Record<Rarity, number> = { common: 0.3, rare: 0.4, epic: 0.5, legendary: 0.65, grail: 0.8 };
const SANS = "Arial, Helvetica, sans-serif";

/** Lighten/darken a hex colour toward white (amt > 0) or black (amt < 0). */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(ch);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * A Slab, styled like a PSA graded slab. Clear acrylic case with a white, red-bordered label across the top in plain
 * black capitals (set and tier, jersey number, player, team), and the card
 * sitting in the case window below it: a refractor border in the tier colour, the player over his team colours with
 * his team logo, and a name strip. Nothing leaves the slab's edges. Same box and outline as the slab backs (0.6h wide,
 * the slab 710/1200 of the height wide) so a reveal flips over in place. Immortal slabs get a spinning rainbow
 * refractor, a holo sheen, vibrant colour and a pulsing glow.
 */
export function SlabFace({ s, height, className = "" }: { s: SlabFaceData; height: number; className?: string }) {
  const [photoOk, setPhotoOk] = useState(true);
  const h = height;
  const box = Math.round(h * 0.6);
  const w = Math.round((h * 710) / 1200);
  const px = (k: number, min = 0) => Math.max(min, Math.round(h * k * 10) / 10);
  const generic = s.kind === "generic";
  const primary = generic ? "#1f63b5" : `#${s.color ?? "334155"}`;
  const alt = generic ? "#cc2b31" : s.alt && !/^(ffffff|000000)$/i.test(s.alt) ? `#${s.alt}` : primary;
  const logo = s.team ? `https://a.espncdn.com/i/teamlogos/nba/500/${s.team.toLowerCase()}.png` : null;

  // Label type: one size, all caps, for every line (Arial caps run ~0.68em wide). It shrinks only if a line can't fit.
  const casePad = px(0.035, 3);
  const labelPad = px(0.016, 2);
  const labelIn = w - 2 * casePad - 2 * labelPad - 2 * px(0.014, 2.5);
  // No player name anywhere on the slab: the photo and team logo say who it is.
  const team = generic ? "GENERIC SLAB" : (s.team_name ?? s.team).toUpperCase();
  const pos = generic ? "WORKS ON ANY PLAYER" : POSITION[s.pos] ?? s.pos;
  const set = `2026 PACKDRAFT ${s.immortal ? "IMMORTAL" : RARITIES[s.rarity].label.toUpperCase()}`;
  const num = generic ? "ANY" : `#${s.jersey ?? "-"}`;
  const cw = 0.68;
  const T = Math.max(4.5, Math.min(
    px(0.026, 5.5),
    labelIn / ((set.length + num.length + 1) * cw),
    labelIn / (team.length * cw),
    labelIn / (pos.length * cw),
  ));

  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: box, height: h }}>
      {/* Acrylic case */}
      <div className={`relative flex h-full flex-col overflow-hidden ${s.immortal ? "anim-glow" : ""}`}
        style={{
          width: w, borderRadius: px(0.03, 5), padding: casePad, gap: px(0.026, 3), ["--glow" as string]: "rgba(255, 190, 60, .8)",
          background: "linear-gradient(160deg, #eef0f3 0%, #c3c8cf 18%, #dfe2e6 40%, #a9afb8 72%, #e4e7eb 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.7), inset 0 0 0 3px rgba(0,0,0,.08), 0 10px 18px rgba(0,0,0,.35)",
        }}>
        {/* Top label: white with a thick red border, plain black capitals all the same size */}
        <div className="relative shrink-0 overflow-hidden uppercase"
          style={{ background: "#ffffff", color: "#000000", border: `${px(0.014, 2.5)}px solid ${LABEL_RED}`, borderRadius: px(0.006, 1), padding: labelPad, fontFamily: SANS, fontSize: T, lineHeight: 1.3, letterSpacing: "0.02em" }}>
          <div className="flex justify-between gap-1">
            <span className="truncate">{set}</span>
            <span className="shrink-0">{num}</span>
          </div>
          <p className="truncate font-bold">{team}</p>
          <p className="truncate">{pos}</p>
        </div>

        {/* Case window with the card in it */}
        <div className="relative grid min-h-0 flex-1 place-items-center"
          style={{ borderRadius: px(0.012, 2), background: "linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.06))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.55), inset 0 2px 6px rgba(0,0,0,.25)" }}>
          <div className={`relative overflow-hidden ${s.immortal ? "slab-immortal" : ""}`}
            style={{
              height: "94%", aspectRatio: "2.5 / 3.5", maxWidth: "92%", padding: px(0.014, 2), borderRadius: px(0.008, 1),
              background: s.immortal ? undefined : REFRACTOR[s.rarity], ["--glow" as string]: "rgba(255, 200, 80, .75)",
            }}>
            <div className="slab-bg relative h-full w-full overflow-hidden"
              style={{
                borderRadius: px(0.004, 1),
                ["--c1" as string]: primary, ["--c2" as string]: alt, ["--c1d" as string]: shade(primary, -0.55),
                ["--tier" as string]: RARITY_HEX[s.rarity], ["--fx" as string]: FX[s.rarity] * (s.immortal ? 1.3 : 1),
                filter: s.immortal ? "saturate(1.6) contrast(1.08)" : undefined,
              }}>
              {/* Animated background: team colours drift (slab-bg), tier-coloured rays turn, light streaks slide by */}
              <div className="slab-rays pointer-events-none absolute" />
              <div className="slab-streaks pointer-events-none absolute" />
              {generic ? (
                <div className="absolute inset-0 grid place-items-center">
                  <img src="/packdraft-logo-full.svg" alt="PackDraft" draggable={false} className="select-none" style={{ width: "82%", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }} />
                </div>
              ) : (
                <>
                  {s.photo && photoOk ? (
                    <img src={s.photo} alt={s.name} draggable={false} onError={() => setPhotoOk(false)}
                      className="absolute left-1/2 max-w-none -translate-x-1/2 select-none"
                      style={{ width: "165%", bottom: "27%", maskImage: "linear-gradient(to bottom, #000 72%, transparent 98%)", WebkitMaskImage: "linear-gradient(to bottom, #000 72%, transparent 98%)" }} />
                  ) : (
                    <span className="absolute inset-x-0 top-0 grid place-items-center font-black text-white/85" style={{ bottom: "32%", fontSize: px(0.12) }}>
                      {s.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
                    </span>
                  )}
                  {/* Big team logo under the photo */}
                  {logo && (
                    <img src={logo} alt={s.team_name ?? s.team} draggable={false} className="absolute left-1/2 -translate-x-1/2 select-none object-contain"
                      style={{ width: "62%", height: "36%", bottom: "-1%", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.55))" }} />
                  )}
                </>
              )}
              {s.immortal && <div className="slab-holo pointer-events-none absolute inset-0" />}
            </div>
          </div>
        </div>

        {/* Acrylic glare over the whole slab */}
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, rgba(255,255,255,.16) 0%, transparent 20%, transparent 66%, rgba(255,255,255,.12) 82%, transparent 100%)" }} />
      </div>
    </div>
  );
}

/** The slab's multiplier, shown under it: a pulsing Fantasy Points logo with the multiplier in Fantasy Points blue. */
export function SlabMult({ mult, range, size = 14, className = "" }: { mult: number; range?: [number, number]; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center font-semibold leading-none text-fpts ${className}`} style={{ fontSize: size, gap: size * 0.25 }} title={`${fmtMult(mult)} fantasy points`}>
      <span className="fpts-pulse inline-flex"><FptIcon tone="blue" className="!align-middle" /></span>
      {range ? fmtRange(range) : fmtMult(mult)}
    </span>
  );
}
