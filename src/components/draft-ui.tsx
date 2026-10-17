"use client";

import { TeamBadge, type BrandLite } from "./TeamBadge";
import { TeamLogo } from "./TeamLogo";
import { useMemo, useState } from "react";
import { Headshot, InjuryTag } from "./Headshot";

export type BoardTeam = { id: number; name: string; owner: string; color: string; cpu?: boolean; brand?: BrandLite };
export type BoardPick = { overall: number; round: number; team_id: number; name: string; pos: string; team: string; is_keeper?: number };
export type PoolPlayer = { id: number; name: string; pos: string; team: string; adp: number; proj: number; headshot?: string | null; injury?: string | null };

const POS_BG: Record<string, string> = {
  G: "bg-sky-500/25 border-sky-400/40", F: "bg-emerald-500/25 border-emerald-400/40", C: "bg-amber-500/25 border-amber-400/40",
};

export function DraftBoard({ order, picks, rounds, currentOverall, myTeamId }: {
  order: BoardTeam[]; picks: BoardPick[]; rounds: number; currentOverall?: number | null; myTeamId?: number | null;
}) {
  const n = order.length;
  const byOverall = new Map(picks.map((p) => [p.overall, p]));
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div className="grid min-w-[760px] gap-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(92px, 1fr))` }}>
        {order.map((t) => (
          <div key={t.id} className={`truncate rounded-lg px-2 py-1.5 text-center text-xs font-bold ${t.id === myTeamId ? "bg-brand/20 text-brand" : "bg-panel2"}`}>
            {t.brand ? <TeamBadge brand={t.brand} size={16} className="mr-1 -mt-0.5 align-middle" /> : <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: t.color }} />}{t.name}
          </div>
        ))}
        {Array.from({ length: rounds }).flatMap((_, r) =>
          order.map((t, i) => {
            const idx = r % 2 === 0 ? i : n - 1 - i;
            const overall = r * n + idx + 1;
            const p = byOverall.get(overall);
            const isNow = overall === currentOverall;
            return (
              <div key={`${r}-${i}`} className={`h-14 rounded-lg border p-1.5 text-[11px] leading-tight ${p ? POS_BG[p.pos] : "border-line/50 bg-ink/40"} ${isNow ? "anim-glow border-brand" : ""}`} style={isNow ? ({ "--glow": "rgba(255,37,54,0.45)" } as React.CSSProperties) : undefined}>
                {p ? (
                  <>
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="text-zinc-700">{p.pos} · {p.team}{p.is_keeper ? " · K" : ""}</p>
                  </>
                ) : (
                  <p className="text-zinc-400">{r + 1}.{String(idx + 1).padStart(2, "0")}{isNow ? " ⏱" : ""}</p>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

export function PlayerPool({ players, canPick, onPick, queue, onQueue, busy }: {
  players: PoolPlayer[]; canPick: boolean; onPick: (id: number) => void; queue?: number[]; onQueue?: (id: number, add: boolean) => void; busy?: boolean;
}) {
  const [pos, setPos] = useState("ALL");
  const [q, setQ] = useState("");
  const list = useMemo(
    () => players.filter((p) => (pos === "ALL" || p.pos === pos) && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 120),
    [players, pos, q],
  );
  return (
    <div className="card flex h-[520px] flex-col p-3">
      <div className="mb-2 flex flex-wrap gap-1">
        {["ALL", "G", "F", "C"].map((p) => (
          <button key={p} onClick={() => setPos(p)} className={`tab px-2 py-1 text-xs ${pos === p ? "tab-active" : ""}`}>{p}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input ml-auto w-32 py-1 text-xs" />
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-panel2">
            <span className="w-7 text-xs text-zinc-400">{p.adp}</span>
            <Headshot src={p.headshot ?? null} name={p.name} size={28} />
            <span className={`pos pos-${p.pos}`}>{p.pos}</span>
            <span className="flex-1 truncate font-medium">{p.name} <InjuryTag injury={p.injury ?? null} /> <TeamLogo team={p.team} size={14} className="mx-0.5 -mt-0.5 align-middle" /><span className="text-xs text-zinc-400">{p.team}</span></span>
            <span className="font-mono text-xs text-zinc-500">{p.proj.toFixed(1)}</span>
            {onQueue && (
              <button title="Queue" onClick={() => onQueue(p.id, !queue?.includes(p.id))} className={`text-xs ${queue?.includes(p.id) ? "text-amber-600" : "text-zinc-400 hover:text-zinc-700"}`}>★</button>
            )}
            <button disabled={!canPick || busy} onClick={() => onPick(p.id)} className="btn-lime px-2 py-0.5 text-xs">Draft</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
