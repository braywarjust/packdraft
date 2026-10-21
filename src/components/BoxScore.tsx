"use client";

import type { DayInfo, DayRow } from "@/lib/league";
import type { Line } from "@/lib/scoring";
import { slotLabel } from "@/lib/scoring";
import { Fpts } from "./Fpts";
import { Headshot, InjuryTag } from "./Headshot";
import { TeamLogo } from "./TeamLogo";
import { BoostChip } from "./LineupEditor";
import { PlayerButton } from "./PlayerInspector";

/** Box score columns, ESPN order. */
export const STAT_COLS: [string, (l: Line) => number][] = [
  ["MIN", (l) => l.min], ["FGM", (l) => l.fgm], ["FGA", (l) => l.fga], ["FTM", (l) => l.ftm], ["FTA", (l) => l.fta], ["3PM", (l) => l.tpm],
  ["REB", (l) => l.reb], ["AST", (l) => l.ast], ["STL", (l) => l.stl], ["BLK", (l) => l.blk], ["TO", (l) => l.to], ["PTS", (l) => l.pts],
];

/** "L. Doncic" for tight spaces. */
export const shortName = (n: string) => {
  const parts = n.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : n;
};

/**
 * Day picker: arrows either side. Phones show just the chosen day ("Today (Wed, Oct 21)"); bigger screens show every
 * day of the week as a strip, ESPN style.
 */
export function DayStrip({ days, day, onDay, totals }: { days: DayInfo[]; day: string; onDay: (k: string) => void; totals?: Record<string, number> }) {
  const i = Math.max(0, days.findIndex((d) => d.key === day));
  const cur = days[i];
  const arrow = (dir: -1 | 1) => (
    <button type="button" disabled={!days[i + dir]} onClick={() => onDay(days[i + dir].key)} aria-label={dir < 0 ? "Previous day" : "Next day"}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-xl font-black text-brand ring-1 ring-line transition hover:bg-panel2 disabled:opacity-30">
      {dir < 0 ? "‹" : "›"}
    </button>
  );
  return (
    <div className="flex items-center gap-2">
      {arrow(-1)}
      <p className="flex-1 text-center text-base font-bold text-brand sm:hidden">{cur?.label}</p>
      <div className="hidden flex-1 gap-1 overflow-x-auto scrollbar-thin sm:flex">
        {days.map((d) => (
          <button key={d.key} type="button" onClick={() => onDay(d.key)}
            className={`min-w-[64px] flex-1 rounded-lg px-2 py-1.5 text-center transition ${d.key === day ? "bg-brand/15 ring-1 ring-brand/50" : "hover:bg-panel2"}`}>
            <span className={`block text-[10px] font-bold tracking-wider ${d.key === day ? "text-brand" : "text-zinc-500"}`}>{d.top}</span>
            <span className={`block text-lg font-black leading-tight ${d.key === day ? "text-brand" : d.past ? "text-zinc-400" : "text-white"}`}>{d.short}</span>
            {totals && <span className="block font-mono text-[11px] text-zinc-500">{totals[d.key] ? totals[d.key].toFixed(1) : "-"}</span>}
          </button>
        ))}
      </div>
      {arrow(1)}
    </div>
  );
}

/** One player row of a box score: slot (or a custom slot cell), player, opponent and status, stat line, fantasy points. */
export function BoxRow({ r, slotCell, highlight, compactName }: { r: DayRow | null; slotCell: React.ReactNode; highlight?: string; compactName?: boolean }) {
  const g = r?.game;
  const live = g?.state === "in";
  const dash = <span className="text-zinc-500">-</span>;
  return (
    <tr className={`border-t border-line/60 ${highlight ?? ""}`}>
      <td className="sticky left-0 z-10 w-[56px] min-w-[56px] bg-panel px-1.5 py-2 sm:w-[76px] sm:min-w-[76px] sm:pl-3">{slotCell}</td>
      <td className="sticky left-[56px] z-10 border-r border-line/60 bg-panel py-2 pr-2 sm:left-[76px]">
        {r ? (
          <div className="flex min-w-[150px] items-center gap-2 sm:min-w-[220px]">
            <Headshot src={r.headshot} name={r.name} size={36} />
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-sm font-semibold leading-tight text-white">
                <PlayerButton id={r.id} className="truncate">{compactName ? shortName(r.name) : <><span className="sm:hidden">{shortName(r.name)}</span><span className="hidden sm:inline">{r.name}</span></>}</PlayerButton>
                <InjuryTag injury={r.injury} />
              </p>
              <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                <TeamLogo team={r.team} size={13} />{r.team} <span className="font-semibold text-zinc-400">{r.pos.split(",").join(", ")}</span>
              </p>
              {r.boost && <p className="mt-0.5 flex gap-1"><BoostChip boost={r.boost} /></p>}
            </div>
          </div>
        ) : <span className="text-sm text-zinc-500">Empty</span>}
      </td>
      <td className="whitespace-nowrap px-2 text-xs font-semibold text-brand">{g ? g.opp : dash}</td>
      <td className={`whitespace-nowrap px-2 text-xs ${live ? "font-bold text-red-500" : g?.state === "post" ? "font-semibold text-white/75" : "text-brand"}`}>
        {g ? <>{live && "● "}{g.status}</> : ""}
      </td>
      {STAT_COLS.map(([k, f]) => (
        <td key={k} className="border-l border-line/30 px-2 text-center font-mono text-xs text-white/85 first:border-l-0">{g?.line && g.state !== "pre" ? f(g.line) : dash}</td>
      ))}
      <td className="border-l border-line/60 px-3 text-right font-mono text-sm font-black text-white">{r?.fpts != null ? <Fpts n={r.fpts} /> : dash}</td>
    </tr>
  );
}

/** Table header for BoxRow tables. */
export function BoxHead({ dayLabel, first = "Slot" }: { dayLabel: string; first?: string }) {
  return (
    <thead className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
      <tr>
        <th className="sticky left-0 z-10 bg-panel px-1.5 py-2 text-left sm:pl-3">{first}</th>
        <th className="sticky left-[56px] z-10 border-r border-line/60 bg-panel py-2 text-left sm:left-[76px]">Player</th>
        <th className="px-2 text-left">Opp</th>
        <th className="px-2 text-left">{dayLabel}</th>
        {STAT_COLS.map(([k]) => <th key={k} className="px-2 text-center">{k}</th>)}
        <th className="border-l border-line/60 px-3 text-right">Fpts</th>
      </tr>
    </thead>
  );
}

/** Starters' totals row. */
export function BoxTotals({ rows, total }: { rows: DayRow[]; total: number }) {
  const sum = (f: (l: Line) => number) => rows.reduce((s, r) => s + (r.game?.line && r.game.state !== "pre" ? f(r.game.line) : 0), 0);
  return (
    <tr className="border-t border-line bg-panel2/60 font-mono text-xs font-bold text-white">
      <td className="sticky left-0 z-10 bg-panel2 py-2" />
      <td className="sticky left-[56px] z-10 border-r border-line/60 bg-panel2 py-2 text-right font-sans text-[10px] uppercase tracking-widest text-zinc-400 sm:left-[76px]">Starters</td>
      <td /><td />
      {STAT_COLS.map(([k, f]) => <td key={k} className="px-2 text-center">{sum(f)}</td>)}
      <td className="border-l border-line/60 px-3 text-right text-sm"><Fpts n={total} /></td>
    </tr>
  );
}

export const slotPill = (slot: string) => slotLabel(slot) === "BN" ? "Bench" : slotLabel(slot);
