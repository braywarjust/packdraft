"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { RARITIES, fmtMult, type Rarity } from "@/lib/packs";

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
/** The Fantasy Points blue, a shade deeper so it reads on the white label. */
const FPTS_BLUE = "#0e8fd6";
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
 * black type (set, player, team on the left; multiplier with the Fantasy Points logo on the right), and the card
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
  const fptMask = "url(/fantasy-points.svg) center / contain no-repeat";

  // Label type: one size, all caps, for every line (Arial caps run ~0.68em wide). It shrinks only if a line can't fit.
  const casePad = px(0.035, 3);
  const labelPad = px(0.016, 2);
  const labelIn = w - 2 * casePad - 2 * labelPad - 2 * px(0.014, 2.5);
  const name = generic ? "ANY PLAYER" : s.name.toUpperCase();
  const full = (s.team_name ?? s.team).toUpperCase();
  const club = full.length > 12 ? full.split(" ").slice(-1)[0] : full;
  const team = generic ? "GENERIC SLAB" : `${club}${s.pos ? ` · ${s.pos}` : ""}`;
  const set = `2026 PACKDRAFT ${s.immortal ? "IMMORTAL" : RARITIES[s.rarity].label.toUpperCase()}`;
  const num = generic ? "ANY" : `#${s.jersey ?? "-"}`;
  const mult = fmtMult(s.mult);
  const cw = 0.68;
  // The multiplier is the loudest thing on the slab: big blue type with the Fantasy Points logo, as tall as the label.
  const M = px(0.07, 13);
  const multW = (mult.length * 0.6 + 1.05) * M;
  const room = labelIn - multW - px(0.02, 3);
  const T = Math.max(4.5, Math.min(
    px(0.024, 5.5),
    room / (set.length * cw),
    room / (name.length * cw),
    room / ((team.length + num.length + 1) * cw),
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
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0" style={{ width: room }}>
              <p className="truncate">{set}</p>
              <p className="truncate font-bold">{name}</p>
              <p className="truncate">{team} {num}</p>
            </div>
            <span className="flex shrink-0 items-center font-black" title={`${mult} fantasy points`}
              style={{ fontSize: M, gap: M * 0.08, lineHeight: 1, letterSpacing: "-0.03em", color: FPTS_BLUE }}>
              <span aria-hidden className="shrink-0" style={{ background: FPTS_BLUE, width: M * 0.85, height: M * 0.85, mask: fptMask, WebkitMask: fptMask }} />
              {mult}
            </span>
          </div>
        </div>

        {/* Case window with the card in it */}
        <div className="relative grid min-h-0 flex-1 place-items-center"
          style={{ borderRadius: px(0.012, 2), background: "linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.06))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.55), inset 0 2px 6px rgba(0,0,0,.25)" }}>
          <div className={`relative overflow-hidden ${s.immortal ? "slab-immortal" : ""}`}
            style={{
              height: "94%", aspectRatio: "2.5 / 3.5", maxWidth: "92%", padding: px(0.014, 2), borderRadius: px(0.008, 1),
              background: s.immortal ? undefined : REFRACTOR[s.rarity], ["--glow" as string]: "rgba(255, 200, 80, .75)",
            }}>
            <div className="relative h-full w-full overflow-hidden"
              style={{
                borderRadius: px(0.004, 1),
                background: `linear-gradient(165deg, ${shade(primary, 0.1)} 0%, ${primary} 45%, ${shade(alt, -0.4)} 100%)`,
                filter: s.immortal ? "saturate(1.6) contrast(1.08)" : undefined,
              }}>
              {/* Arena light streaks */}
              <div className="absolute inset-0 opacity-20" style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,.5) 0 2px, transparent 2px 16px)" }} />
              {generic ? (
                <div className="absolute inset-x-0 top-0 grid place-items-center" style={{ bottom: "15%" }}>
                  <img src="/packdraft-logo-full.svg" alt="PackDraft" draggable={false} className="select-none" style={{ width: "80%", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.4))" }} />
                </div>
              ) : (
                <>
                  {logo && <img src={logo} alt="" draggable={false} className="absolute left-1/2 top-[3%] -translate-x-1/2 select-none opacity-25" style={{ width: "95%" }} />}
                  {s.photo && photoOk ? (
                    <img src={s.photo} alt={s.name} draggable={false} onError={() => setPhotoOk(false)}
                      className="absolute left-1/2 max-w-none -translate-x-1/2 select-none"
                      style={{ width: "170%", bottom: "14%", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))" }} />
                  ) : (
                    <span className="absolute inset-x-0 top-0 grid place-items-center font-black text-white/85" style={{ bottom: "15%", fontSize: px(0.12) }}>
                      {s.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
                    </span>
                  )}
                </>
              )}
              {/* Name strip with the team logo, inside the card */}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-[4%] px-[5%]"
                style={{ height: "15%", background: `linear-gradient(90deg, ${shade(primary, -0.5)}, ${shade(primary, -0.2)})`, borderTop: `1px solid ${shade(alt, 0.35)}` }}>
                <span className="min-w-0 flex-1 truncate font-black uppercase italic text-white"
                  style={{ fontFamily: SANS, fontSize: Math.max(5, Math.min(px(0.03), (w * 0.5) / (Math.max(name.length, 1) * 0.62))) }}>
                  {name}
                </span>
                {logo && !generic && (
                  <span className="grid shrink-0 place-items-center rounded-full" style={{ background: "#ffffff", width: px(0.056, 9), height: px(0.056, 9) }}>
                    <img src={logo} alt={s.team} draggable={false} className="select-none object-contain" style={{ width: "82%", height: "82%" }} />
                  </span>
                )}
              </div>
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
