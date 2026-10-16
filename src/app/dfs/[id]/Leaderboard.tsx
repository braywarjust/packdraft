"use client";

import { useEffect, useState } from "react";

type Entry = { id: number; name: string; mine: boolean; pts: number; remain: number;
  players: { slot: string; name: string; pos: string; team: string; pts: number; g: number; clock: string; line: string; salary: number }[] };
type G = { id: string; away: string; home: string; as: number; hs: number; state: string; detail: string | null };

export function Leaderboard({ contestId }: { contestId: number }) {
  const [d, setD] = useState<{ status: string; progress: number | null; entries: Entry[]; games: G[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      const r = await fetch(`/api/dfs/${contestId}`, { cache: "no-store" });
      if (!r.ok || stop) return;
      const j = await r.json();
      setD(j);
      if (j.status === "live") setTimeout(load, j.progress != null ? 2000 : 15000);
    };
    load();
    return () => { stop = true; };
  }, [contestId]);
  if (!d) return <p className="text-zinc-500">Loading…</p>;
  return (
    <div className="space-y-3">
      {d.games.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {d.games.map((g) => (
            <div key={g.id} className="card shrink-0 px-3 py-2 text-xs">
              <p className="flex justify-between gap-3"><span>{g.away}</span><span className="font-mono font-bold">{g.state === "pre" ? "" : g.as}</span></p>
              <p className="flex justify-between gap-3"><span>{g.home}</span><span className="font-mono font-bold">{g.state === "pre" ? "" : g.hs}</span></p>
              <p className={g.state === "in" ? "text-red-600" : "text-zinc-400"}>{g.detail}</p>
            </div>
          ))}
        </div>
      )}
      {d.status === "live" && d.progress != null && (
        <div className="h-2 overflow-hidden rounded-full bg-panel2"><div className="h-full bg-gradient-to-r from-brand to-red-800" style={{ width: `${(d.progress ?? 0) * 100}%` }} /></div>
      )}
      {d.status === "final" && <p className="text-sm text-emerald-600">Final! Prize packs are in the winners&apos; vending machine inventory.</p>}
      <div className="card divide-y divide-line/60">
        {d.entries.map((e, i) => (
          <div key={e.id} className={e.mine ? "bg-brand/10" : ""}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span className="w-8 text-lg font-black text-zinc-500">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span>
              <span className="flex-1 font-semibold">{e.name}{e.mine && " (you)"}</span>
              {d.status === "live" && <span className="text-xs text-zinc-400">+{e.remain.toFixed(1)} proj left</span>}
              <span className="w-20 text-right font-mono text-lg font-black">{e.pts.toFixed(2)}</span>
            </button>
            {open === e.id && (
              <ul className="grid gap-1 px-4 pb-3 text-sm sm:grid-cols-3">
                {e.players.map((p) => (
                  <li key={p.slot} className="flex justify-between rounded bg-ink/60 px-2 py-1">
                    <span className="min-w-0"><span className={`pos pos-${p.pos} mr-1`}>{p.slot.replace(/\d$/, "")}</span>{p.name}
                      <span className="block truncate text-[10px] text-zinc-400">{p.clock}{p.line ? ` · ${p.line}` : ""}</span></span>
                    <span className="font-mono">{p.pts.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
