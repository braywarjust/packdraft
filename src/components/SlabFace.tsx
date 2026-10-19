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
  const tiny = h < 180;
  const primary = generic ? "#1f63b5" : `#${s.color ?? "334155"}`;
  const alt = generic ? "#cc2b31" : s.alt && !/^(ffffff|000000)$/i.test(s.alt) ? `#${s.alt}` : primary;
  const logo = s.team ? `https://a.espncdn.com/i/teamlogos/nba/500/${s.team.toLowerCase()}.png` : null;
  const fptMask = "url(/fantasy-points.svg) center / contain no-repeat";

  // Label sizing: every line shrinks to fit the room it has (Arial caps run ~0.68em wide).
  const casePad = px(0.035, 3);
  const labelPad = px(0.016, 2);
  const labelIn = w - 2 * casePad - 2 * labelPad - px(0.016, 3);
  const line = px(0.029, 6);
  const fit = (text: string, max: number, room: number) => Math.max(4.5, Math.min(max, room / (Math.max(text.length, 1) * 0.68)));
  const name = generic ? "ANY PLAYER" : s.name.toUpperCase();
  const full = (s.team_name ?? s.team).toUpperCase();
  const club = full.length > 14 ? full.split(" ").slice(-1)[0] : full;
  const team = generic ? "GENERIC SLAB" : `${club}${s.pos ? ` · ${s.pos}` : ""}`;
  const set = `2026 PACKDRAFT ${s.immortal ? "IMMORTAL" : RARITIES[s.rarity].label.toUpperCase()}`;
  const multSize = line * 1.45;
  const multW = (fmtMult(s.mult).length * 0.62 + 1.3) * multSize;

  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: box, height: h }}>
      {/* Acrylic case */}
      <div className={`relative flex h-full flex-col overflow-hidden ${s.immortal ? "anim-glow" : ""}`}
        style={{
          width: w, borderRadius: px(0.03, 5), padding: casePad, gap: px(0.026, 3), ["--glow" as string]: "rgba(255, 190, 60, .8)",
          background: "linear-gradient(160deg, #eef0f3 0%, #c3c8cf 18%, #dfe2e6 40%, #a9afb8 72%, #e4e7eb 100%)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.7), inset 0 0 0 3px rgba(0,0,0,.08), 0 10px 18px rgba(0,0,0,.35)",
        }}>
        {/* Top label: white with a red border, plain black type */}
        <div className="relative shrink-0 overflow-hidden"
          style={{ background: "#ffffff", color: "#000000", border: `${px(0.008, 1.5)}px solid ${LABEL_RED}`, borderRadius: px(0.006, 1), padding: labelPad, fontFamily: SANS, lineHeight: 1.2 }}>
          {!tiny && (
            <div className="flex justify-between gap-1" style={{ fontSize: fit(set, line, labelIn * 0.8) }}>
              <span className="truncate">{set}</span>
              <span className="shrink-0">{generic ? "ANY" : `#${s.jersey ?? "-"}`}</span>
            </div>
          )}
          <p className="truncate font-bold" style={{ fontSize: fit(name, line * 1.2, labelIn) }}>{name}</p>
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: fit(team, line, labelIn - multW) }}>{team}</p>
              {!tiny && <p className="truncate" style={{ fontSize: fit("FPTS BOOST", line * 0.8, labelIn - multW) }}>FPTS BOOST</p>}
            </div>
            <p className="flex shrink-0 items-center font-black" style={{ fontSize: multSize, gap: line * 0.16, lineHeight: 1 }}>
              <span aria-hidden className="shrink-0" style={{ background: "#000000", width: line * 1.05, height: line * 1.05, mask: fptMask, WebkitMask: fptMask }} />
              {fmtMult(s.mult)}
            </p>
          </div>
          {!tiny && (
            <div className="flex items-end justify-between" style={{ marginTop: line * 0.25 }}>
              {/* Barcode */}
              <span className="block" style={{ width: "34%", height: line * 0.85, background: "repeating-linear-gradient(90deg, #000 0 1px, transparent 1px 2px, #000 2px 4px, transparent 4px 5px, #000 5px 6px, transparent 6px 8px)" }} />
              <img src="/packdraft-logo-full.svg" alt="" draggable={false} className="select-none" style={{ height: line * 1.2 }} />
              <span style={{ fontSize: line * 0.8, width: "34%", textAlign: "right" }}>{String(s.serial).padStart(6, "0")}</span>
            </div>
          )}
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
