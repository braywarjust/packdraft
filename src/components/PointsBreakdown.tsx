"use client";

import { useEffect } from "react";
import type { DayInfo, DayRow } from "@/lib/league";
import { STATS, fpts, scoringLabel, weightsOf, type Line } from "@/lib/scoring";
import { XIcon } from "./Icons";
import { Fpts } from "./Fpts";
import { Headshot } from "./Headshot";
import { useScrollLock } from "./useScrollLock";

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${num(Math.abs(n))}`;

/**
 * How a player's fantasy points for one day add up (Update 4.2): every stat the league scores, times its points, from
 * his live box score. The row comes from the roster board's props, so it keeps counting while the page auto-refreshes.
 */
export function PointsBreakdown({ r, day, scoring, onClose }: { r: DayRow; day: DayInfo | undefined; scoring: string; onClose: () => void }) {
  useScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const g = r.game;
  const line = g?.line && g.state !== "pre" ? g.line : null;
  const w = weightsOf(scoring);
  const rows = line ? STATS.filter(([k]) => k !== "dd" && k !== "td" && w[k]).map(([k, abbr, name]) => {
    const v = (line as Line)[k as keyof Line] || 0;
    return { abbr, name, v, each: w[k]!, pts: v * w[k]! };
  }) : [];
  // Double-double / triple-double bonus, scored the same way as lib/scoring fpts().
  let bonus: { label: string; pts: number } | null = null;
  if (line && (w.dd || w.td)) {
    const doubles = [line.pts, line.reb, line.ast, line.stl, line.blk].filter((x) => x >= 10).length;
    if (doubles >= 3 && w.td) bonus = { label: "Triple-double", pts: w.td };
    else if (doubles >= 2 && w.dd) bonus = { label: "Double-double", pts: w.dd };
  }
  const base = line ? fpts(line, scoring) : 0;
  // Games played with an old slab equipped (before 4.0-R) keep their boost; show it so the total still adds up.
  const extra = r.fpts != null ? Math.round((r.fpts - base) * 100) / 100 : 0;
  const total = r.fpts ?? 0;
  const live = g?.state === "in";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${r.name} fantasy points`}>
        <div className="flex items-center gap-3 border-b border-line/60 p-4">
          <Headshot src={r.headshot} name={r.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-white">{r.name}</p>
            <p className="truncate text-xs text-zinc-500">
              {day?.label}{g ? <> · {g.opp} · <span className={live ? "font-bold text-red-500" : ""}>{live && "● "}{g.status}</span></> : " · No game"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="hit press text-zinc-400" aria-label="Close"><XIcon /></button>
        </div>

        {!line ? (
          <p className="p-6 text-center text-sm text-zinc-500">{g ? "His game hasn't started yet. Points add up here as he plays." : "He doesn't play this day."}</p>
        ) : (
          <div className="p-4">
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <tr><th className="pb-2 text-left">Stat</th><th className="pb-2 text-center">Stat line</th><th className="pb-2 text-center">Pts each</th><th className="pb-2 text-right">Fpts</th></tr>
              </thead>
              <tbody className="font-mono">
                {rows.map((x) => (
                  <tr key={x.abbr} className={`border-t border-line/40 ${x.v ? "" : "text-zinc-500"}`}>
                    <td className="py-1.5 font-sans"><b className={x.v ? "text-white" : ""}>{x.abbr}</b> <span className="text-xs text-zinc-500 max-sm:hidden">{x.name}</span></td>
                    <td className="py-1.5 text-center">{x.v}</td>
                    <td className="py-1.5 text-center">× {signed(x.each)}</td>
                    <td className={`py-1.5 text-right font-bold ${x.pts > 0 ? "text-white" : x.pts < 0 ? "text-red-400" : ""}`}>{signed(x.pts)}</td>
                  </tr>
                ))}
                {bonus && (
                  <tr className="border-t border-line/40">
                    <td className="py-1.5 font-sans font-bold text-white" colSpan={3}>{bonus.label} bonus</td>
                    <td className="py-1.5 text-right font-bold text-white">{signed(bonus.pts)}</td>
                  </tr>
                )}
                {extra !== 0 && (
                  <tr className="border-t border-line/40">
                    <td className="py-1.5 font-sans font-bold text-white" colSpan={3}>Slab boost <span className="text-xs font-normal text-zinc-500">(from before 4.0)</span></td>
                    <td className="py-1.5 text-right font-bold text-white">{signed(extra)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-line">
                  <td className="pt-2 text-xs font-bold uppercase tracking-widest text-zinc-400" colSpan={3}>Total</td>
                  <td className="pt-2 text-right font-mono text-lg font-black text-white"><Fpts n={total} live /></td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs text-zinc-500">
              {scoringLabel(scoring)}{live ? " · updates live as he plays" : ""}{r.slot === "BN" ? " · He's on the bench this day, so these points don't count for your team." : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
