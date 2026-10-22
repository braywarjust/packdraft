"use client";

import Link from "next/link";
import { useState } from "react";
import { TeamBadge, type BrandLite } from "./TeamBadge";

export type FullRow = {
  id: number; brand: BrandLite; rank: number; w: number; l: number; t: number; pct: number; gb: number;
  pf: number; pa: number; streak: string; moves: number; playoffPct: number; clinch: string | null;
};
export type StatRow = { id: number; brand: BrandLite; fgm: number; fga: number; ftm: number; fta: number; tpm: number; reb: number; ast: number; stl: number; blk: number; to: number; pts: number };

const GLOSSARY = [["x", "Clinched playoffs"], ["z", "Clinched bye"], ["*", "Clinched No. 1 seed"], ["e", "Eliminated"]];
const pct = (n: number) => n.toFixed(3).replace(/^0/, "");

/** Expands the League home standings into ESPN's full table plus season team stats, in place (no separate page). */
export function FullStandings({ leagueId, rows, stats, myTeamId, playoffTeams }: {
  leagueId: number; rows: FullRow[]; stats: StatRow[] | null; myTeamId: number | null; playoffTeams: number;
}) {
  const [open, setOpen] = useState(false);
  const th = "px-2 py-1.5 text-right text-[10px] font-black uppercase tracking-widest text-zinc-500";
  const td = "px-2 py-1.5 text-right font-mono";
  return (
    <div className="mt-3">
      <button onClick={() => setOpen(!open)} className="w-full rounded-xl bg-ink/60 py-2 text-center text-xs font-bold text-fpts ring-1 ring-white/5 hover:bg-panel2">
        {open ? "Hide full standings ▴" : "Full standings & team stats ▾"}
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <div className="overflow-x-auto rounded-xl bg-ink/60 ring-1 ring-white/5">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line">
                <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Team</th>
                {["W", "L", "T", "Pct", "GB", "PF", "PA", "Strk", "Moves", "Playoff %"].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`border-b border-line/40 last:border-0 ${r.id === myTeamId ? "bg-white/5 font-bold" : ""} ${r.rank === playoffTeams ? "border-b-2 border-b-amber-400/50" : ""}`}>
                    <td className="px-2 py-1.5">
                      <Link href={`/league/${leagueId}/team/${r.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                        <span className="w-4 text-right font-mono text-xs text-zinc-500">{r.rank}</span>
                        <span className="w-3 font-mono text-xs font-black text-amber-400">{r.clinch ?? ""}</span>
                        <TeamBadge brand={r.brand} size={22} />
                        <span className="truncate text-white">{r.brand.name}</span>
                      </Link>
                    </td>
                    <td className={td}>{r.w}</td><td className={td}>{r.l}</td><td className={td}>{r.t}</td>
                    <td className={td}>{pct(r.pct)}</td>
                    <td className={td}>{r.gb === 0 ? "--" : r.gb.toFixed(1).replace(/\.0$/, "")}</td>
                    <td className={td}>{r.pf.toFixed(1)}</td><td className={td}>{r.pa.toFixed(1)}</td>
                    <td className={`${td} ${r.streak.startsWith("W") ? "text-emerald-600" : r.streak.startsWith("L") ? "text-red-600" : "text-zinc-500"}`}>{r.streak}</td>
                    <td className={td}>{r.moves}</td>
                    <td className={`${td} ${r.playoffPct >= 99.95 ? "text-emerald-600" : r.playoffPct <= 0.05 ? "text-zinc-500" : "text-white"}`}>{r.playoffPct.toFixed(r.playoffPct % 1 ? 1 : 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            {GLOSSARY.map(([k, v]) => <span key={k}><b className="font-mono text-amber-400">{k}</b> {v}</span>)}
            <span>Top {playoffTeams} make the playoffs (gold line). Playoff % plays out the rest of the season 2,000 times.</span>
          </p>
          {stats && (
            <div>
              <h4 className="mb-2 text-sm font-bold">Season team stats <span className="text-[11px] font-normal text-zinc-500">from starters only</span></h4>
              <div className="overflow-x-auto rounded-xl bg-ink/60 ring-1 ring-white/5">
                <table className="w-full min-w-[640px] text-sm">
                  <thead><tr className="border-b border-line">
                    <th className="px-2 py-1.5 text-left text-[10px] font-black uppercase tracking-widest text-zinc-500">Team</th>
                    {["FGM", "FGA", "FTM", "FTA", "3PM", "REB", "AST", "STL", "BLK", "TO", "PTS"].map((h) => <th key={h} className={th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.id} className={`border-b border-line/40 last:border-0 ${s.id === myTeamId ? "bg-white/5 font-bold" : ""}`}>
                        <td className="px-2 py-1.5"><span className="flex min-w-0 items-center gap-2"><TeamBadge brand={s.brand} size={20} /><span className="truncate text-white">{s.brand.abbr}</span></span></td>
                        {[s.fgm, s.fga, s.ftm, s.fta, s.tpm, s.reb, s.ast, s.stl, s.blk, s.to, s.pts].map((v, i) => <td key={i} className={td}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
